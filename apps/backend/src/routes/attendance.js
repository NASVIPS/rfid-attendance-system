// rfid-attendance-system/apps/backend/src/routes/attendance.js
import express from 'express';
import createError from 'http-errors';
import ExcelJS from 'exceljs';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';
import {
  getAttendanceSnapshot,
  getTeacherAttendanceByClassAndDate,
  getAttendanceReportForSession,
  getAggregatedAttendanceReport,
} from '../services/attendanceService.js';

const router = express.Router();

/**
 * GET /api/attendance/snapshot/:sessionId
 * Real-time attendance snapshot for a session
 */
router.get(
  '/snapshot/:sessionId',
  authenticateToken,
  authorizeRoles(['TEACHER', 'PCOORD', 'ADMIN']),
  async (req, res, next) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      return next(createError(400, 'Invalid session ID.'));
    }

    try {
      const snapshot = await getAttendanceSnapshot(sessionId);
      res.json(snapshot);
    } catch (error) {
      console.error(`Error fetching attendance snapshot for session ${sessionId}:`, error);
      next(error);
    }
  }
);

/**
 * GET /api/attendance/teacher-report
 * Attendance logs for teacher's class on specified date
 */
router.get(
  '/teacher-report',
  authenticateToken,
  authorizeRoles(['TEACHER', 'ADMIN', 'PCOORD']),
  async (req, res, next) => {
    const { facultyId, role } = req.user;
    const { subjectId, sectionId, date } = req.query;

    let targetFacultyId = facultyId;
    if ((role === 'ADMIN' || role === 'PCOORD') && req.query.facultyId) {
      targetFacultyId = parseInt(req.query.facultyId);
    }
    if (!targetFacultyId) {
      return next(createError(403, 'Forbidden: faculty profile required or facultyId must be specified.'));
    }
    if (!subjectId || !sectionId || !date) {
      return next(createError(400, 'subjectId, sectionId and date are required query parameters.'));
    }
    if (isNaN(parseInt(subjectId)) || isNaN(parseInt(sectionId))) {
      return next(createError(400, 'Invalid subjectId or sectionId.'));
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return next(createError(400, 'Date must be in YYYY-MM-DD format.'));
    }

    try {
      const filters = {
        subjectId: parseInt(subjectId, 10),
        sectionId: parseInt(sectionId, 10),
        date,
      };
      const attendanceRecords = await getTeacherAttendanceByClassAndDate(targetFacultyId, filters);
      res.json(attendanceRecords);
    } catch (error) {
      console.error(`Error fetching teacher attendance report for faculty ${targetFacultyId}:`, error);
      next(error);
    }
  }
);

/**
 * GET /api/attendance/export-session/:sessionId/excel
 * Export live session attendance with all students (present and absent) and summary.
 * Columns: S. No., Student Name, Enrollment No., Status (Present/Absent), Scanned At (for present only)
 */
router.get(
  '/export-session/:sessionId/excel',
  authenticateToken,
  authorizeRoles(['TEACHER', 'ADMIN', 'PCOORD']),
  async (req, res, next) => {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      return next(createError(400, 'Invalid session ID.'));
    }

    try {
      const { presentStudents, absentStudents, totalStudentsInSessionSection, presentCount, absentCount } = await getAttendanceSnapshot(sessionId);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(`Session ${sessionId} Attendance`);

      // Add Summary Row
      sheet.addRow(['Attendance Summary']);
      sheet.addRow([`Total Students in Section: ${totalStudentsInSessionSection}`]);
      sheet.addRow([`Present: ${presentCount}`]);
      sheet.addRow([`Absent: ${absentCount}`]);
      sheet.addRow([]); // Blank row for spacing

      // Add column headers
      sheet.columns = [
        { header: 'S. No.', key: 'sno', width: 6 },
        { header: 'Student Name', key: 'name', width: 30 },
        { header: 'Enrollment No.', key: 'enrollmentNo', width: 20 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Scanned At', key: 'scannedAt', width: 18 }, // Only for present students
      ];

      // Combine present and absent students for unified display, sorted by name
      const allStudentsForReport = [...presentStudents, ...absentStudents].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      allStudentsForReport.forEach((student, idx) => {
        sheet.addRow({
          sno: idx + 1,
          name: student.name,
          enrollmentNo: student.enrollmentNo,
          status: student.status,
          scannedAt: student.timestamp ? new Date(student.timestamp).toLocaleTimeString() : 'N/A',
        });
      });

      const fileName = `attendance_session_report_${sessionId}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error(`Error exporting attendance for session ${sessionId}:`, error);
      next(createError(500, 'Failed to export Excel report.'));
    }
  }
);

/**
 * GET /api/attendance/export-report/:sectionId
 * Export detailed attendance aggregated report with columns:
 * S. No., Student Name, Enrollment No., Present, Absent, Total Classes, %
 * Query params: from, to, optional subjectId
 */
router.get(
  '/export-report/:sectionId',
  authenticateToken,
  authorizeRoles(['TEACHER', 'PCOORD', 'ADMIN']),
  async (req, res, next) => {
    const sectionId = parseInt(req.params.sectionId);
    const { from, to, subjectId } = req.query;

    if (isNaN(sectionId) || !from || !to) {
      return next(createError(400, "'sectionId', 'from', and 'to' are required query parameters."));
    }

    try {
      const report = await getAggregatedAttendanceReport({
        sectionId,
        from,
        to,
        subjectId: subjectId ? parseInt(subjectId, 10) : undefined,
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Attendance Report');

      sheet.columns = [
        { header: 'S. No.', key: 'sno', width: 6 },
        { header: 'Student Name', key: 'name', width: 30 },
        { header: 'Enrollment No.', key: 'enrollmentNo', width: 20 },
        { header: 'Present', key: 'presentCount', width: 10 },
        { header: 'Absent', key: 'absentCount', width: 10 },
        { header: 'Total Classes', key: 'totalClassesOccurred', width: 18 },
        { header: '% Attendance', key: 'percentage', width: 12 },
      ];

      report.forEach((student, idx) => {
        sheet.addRow({
          sno: idx + 1,
          name: student.name,
          enrollmentNo: student.enrollmentNo,
          presentCount: student.presentCount,
          absentCount: student.absentCount,
          totalClassesOccurred: student.totalClassesOccurred,
          percentage: student.percentage,
        });
      });

      const fileName = `attendance_report_section_${sectionId}_${from}_to_${to}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error(`Error exporting attendance report for section ${sectionId}:`, error);
      next(createError(500, 'Failed to export Excel report.'));
    }
  }
);

export default router;