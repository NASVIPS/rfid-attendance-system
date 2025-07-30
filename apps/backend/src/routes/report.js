// rfid-attendance-system/apps/backend/src/routes/report.js
import express from 'express';
import ExcelJS from 'exceljs';
import createError from 'http-errors';

import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';
import { getReport } from '../services/reportService.js'; // Correct service import

const router = express.Router();

/**
 * GET /api/report
 * Query params: from, to (YYYY-MM-DD), sectionId (optional), subjectId (optional), courseId (optional)
 * Returns JSON array of attendance rows.
 * @access Private (TEACHER, ADMIN, PCOORD)
 */
router.get(
  '/', // Changed path from '/:sectionId' to '/'
  authenticateToken,
  authorizeRoles(['TEACHER', 'ADMIN', 'PCOORD']),
  async (req, res, next) => {
    // Get sectionId from query, not path
    const { sectionId, from, to, subjectId, courseId } = req.query;

    if (!from || !to) {
      return next(createError(400, '`from` and `to` query parameters are required'));
    }

    // sectionId is now optional. If provided, parse it.
    const parsedSectionId = sectionId ? parseInt(sectionId) : undefined;
    if (sectionId && isNaN(parsedSectionId)) { // If sectionId was provided but is not a valid number
        return next(createError(400, 'Invalid sectionId provided.'));
    }

    // Construct filters object for getReport service
    const filters = {
        sectionId: parsedSectionId, // Pass as number or undefined
        from,
        to,
        subjectId: subjectId ? parseInt(subjectId) : undefined, // Pass as number or undefined
        courseId: courseId ? parseInt(courseId) : undefined,     // Pass as number or undefined
    };

    try {
      const report = await getReport(req.app.locals.prisma, filters); // Pass filters object
      res.json({ report });
    } catch (error) {
      console.error('Error in GET /api/report:', error);
      next(error);
    }
  }
);

/**
 * GET /api/report/export.xlsx
 * Query params: from, to, sectionId (optional), subjectId (optional), courseId (optional)
 * Streams down an Excel file.
 * @access Private (TEACHER, ADMIN, PCOORD)
 */
router.get(
  '/export.xlsx', // Changed path from '/export-report/:sectionId' to '/export.xlsx'
  authenticateToken,
  authorizeRoles(['TEACHER', 'ADMIN', 'PCOORD']),
  async (req, res, next) => {
    // Get sectionId from query, not path
    const { sectionId, from, to, subjectId, courseId } = req.query;

    if (!from || !to) {
      return next(createError(400, '`from` and `to` query parameters are required'));
    }

    const parsedSectionId = sectionId ? parseInt(sectionId) : undefined;
    if (sectionId && isNaN(parsedSectionId)) { // If sectionId was provided but is not a valid number
        return next(createError(400, 'Invalid sectionId provided.'));
    }

    const filters = {
        sectionId: parsedSectionId,
        from,
        to,
        subjectId: subjectId ? parseInt(subjectId) : undefined,
        courseId: courseId ? parseInt(courseId) : undefined,
    };

    try {
      const report = await getReport(req.app.locals.prisma, filters); // Pass filters object

      // Build workbook
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Attendance');

      sheet.columns = [
        { header: 'S. No.',        key: 'sno',          width: 6  },
        { header: 'Name',          key: 'name',         width: 30 },
        { header: 'Enrollment No.',key: 'enrollmentNo', width: 20 },
        { header: 'Present',       key: 'presentCount', width: 10 },
        { header: 'Absent',        key: 'absentCount',  width: 10 },
        { header: 'Total Classes Occurred', key: 'totalClassesOccurred', width: 20 }, // NEW Column
        { header: '%',             key: 'percentage',   width: 8  }
      ];

      report.forEach((row, idx) => {
        sheet.addRow({
          sno:           idx + 1,
          name:          row.name,
          enrollmentNo:  row.enrollmentNo,
          presentCount:  row.presentCount,
          absentCount:   row.absentCount,
          totalClassesOccurred: row.totalClassesOccurred, // NEW Data
          percentage:    row.percentage
        });
      });

      // Set headers and stream
      // Adjust filename to be more generic since sectionId is optional
      const filename = `attendance_report_${from}_${to}${parsedSectionId ? '_section_' + parsedSectionId : ''}.xlsx`;
      res
        .status(200)
        .set({
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`
        });

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error in GET /api/report/export.xlsx:', error);
      next(error);
    }
  }
);

export default router;