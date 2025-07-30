// rfid-attendance-system/apps/backend/src/services/attendanceService.js
import createError from 'http-errors';
import prisma from './prisma.js';
import WebSocket from 'ws'; // Import WebSocket

/**
 * Processes an RFID scan for attendance logging.
 * @param {string} rfidUid - The RFID UID scanned.
 * @param {string} deviceMacAddress - The MAC address of the device that scanned.
 * @param {number} sessionId - The ID of the active class session.
 * @returns {Promise<Object>} The created AttendanceLog object.
 */
async function processRfidScan(rfidUid, deviceMacAddress, sessionId) {
  if (!rfidUid || !deviceMacAddress || !sessionId) {
    throw createError(400, 'RFID UID, device MAC address, and session ID are required.');
  }

  // 1. Verify the device exists (optional, but good for error messages)
  const device = await prisma.device.findUnique({
    where: { macAddr: deviceMacAddress }, // Using macAddr as per your schema
  });

  if (!device) {
    throw createError(404, 'Device not found in database.');
  }

  // REMOVED: Check for device.currentTeacherId.
  // The ESP32 is now responsible for ensuring it is authenticated before sending student scans.
  // The backend will trust the ESP32's local authentication state.

  // 2. Verify the session is active
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      subjectInst: {
        include: {
          faculty: true, // Include faculty for potential future checks
          subject: true,
          section: true
        }
      }
    }
  });

  if (!session || session.isClosed) {
    throw createError(400, 'Session is not active or does not exist.');
  }

  // 3. Identify the student
  const student = await prisma.student.findFirst({
    where: { rfidUid: rfidUid },
  });

  if (!student) {
    throw createError(404, 'Student with this RFID UID not found.');
  }

  // 4. Check for duplicate attendance for this session and student
  const existingAttendance = await prisma.attendanceLog.findFirst({
    where: {
      sessionId: sessionId,
      studentId: student.id,
      status: 'PRESENT', // Assuming only 'PRESENT' logs are unique per session
    },
  });

  if (existingAttendance) {
    throw createError(409, 'Student already marked present for this session.');
  }

  // 5. Log attendance
  const newAttendance = await prisma.attendanceLog.create({
    data: {
      sessionId: sessionId,
      studentId: student.id,
      timestamp: new Date(), // FIX: Changed to 'timestamp' as per schema
      status: 'PRESENT',
      deviceMacAddress: deviceMacAddress, // Store which device recorded it
      deviceId: device.id // Link to the device ID
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          enrollmentNo: true,
          rfidUid: true,
        },
      },
    },
  });

  return newAttendance;
}

/**
 * Retrieves a real-time list of attendance logs for a given session,
 * and also includes all students in the section to identify absentees.
 * @param {number} sessionId - The ID of the session.
 * @returns {Promise<Object>} An object containing lists of present and absent students, and counts.
 */
async function getAttendanceSnapshot(sessionId) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      subjectInst: {
        select: {
          sectionId: true,
        },
      },
    },
  });

  if (!session) {
    throw createError(404, 'Session not found.');
  }

  const sectionId = session.subjectInst.sectionId;

  // Get all students in the session's section
  const allStudentsInSection = await prisma.student.findMany({
    where: { sectionId: sectionId },
    select: { id: true, name: true, enrollmentNo: true },
    orderBy: { name: 'asc' },
  });

  // Get all attendance logs for the current session
  const presentLogs = await prisma.attendanceLog.findMany({
    where: { sessionId: sessionId, status: 'PRESENT' },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          enrollmentNo: true,
          rfidUid: true,
        },
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  const presentStudentIds = new Set(presentLogs.map(log => log.student.id));

  const presentStudents = presentLogs.map(log => ({
    id: log.student.id,
    name: log.student.name,
    enrollmentNo: log.student.enrollmentNo,
    timestamp: log.timestamp,
    status: 'PRESENT',
  }));

  const absentStudents = allStudentsInSection
    .filter(student => !presentStudentIds.has(student.id))
    .map(student => ({
      id: student.id,
      name: student.name,
      enrollmentNo: student.enrollmentNo,
      status: 'ABSENT',
    }));

  return {
    presentStudents,
    absentStudents,
    totalStudentsInSessionSection: allStudentsInSection.length,
    presentCount: presentStudents.length,
    absentCount: absentStudents.length,
  };
}


/**
 * Provides a detailed attendance report based on subject, section, and date range filters.
 * @param {object} filters - Filters for the report (subjectId, sectionId, startDate, endDate).
 * @returns {Promise<Array<Object>>} Detailed attendance report.
 */
async function getDetailedAttendanceReport(filters) {
  const { subjectId, sectionId, startDate, endDate } = filters;

  const whereClause = {
    subjectInst: {
      subjectId: subjectId ? parseInt(subjectId) : undefined,
      sectionId: sectionId ? parseInt(sectionId) : undefined,
    },
    startAt: {
      gte: startDate ? new Date(startDate) : undefined,
      lte: endDate ? new Date(endDate) : undefined,
    },
  };

  const sessions = await prisma.classSession.findMany({
    where: whereClause,
    include: {
      subjectInst: {
        include: {
          subject: true,
          section: true,
          faculty: true,
        },
      },
      logs: {
        include: {
          student: {
            select: { id: true, name: true, enrollmentNo: true },
          },
        },
      },
    },
    orderBy: { startAt: 'desc' },
  });

  return sessions;
}

/**
 * Get teacher's attendance report for a specific class and date.
 * @param {number} subjectId
 * @param {number} sectionId
 * @param {string} date - YYYY-MM-DD
 */
async function getTeacherAttendanceByClassAndDate(subjectId, sectionId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const sessions = await prisma.classSession.findMany({
    where: {
      subjectInst: {
        subjectId: parseInt(subjectId),
        sectionId: parseInt(sectionId),
      },
      startAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      logs: {
        include: {
          student: {
            select: { id: true, name: true, enrollmentNo: true, rfidUid: true },
          },
        },
      },
      subjectInst: {
        include: {
          subject: true,
          section: true,
        },
      },
    },
    orderBy: { startAt: 'asc' },
  });

  return sessions;
}


/**
 * Gathers comprehensive attendance logs for a single session, often used for exports.
 * @param {number} sessionId - The ID of the session.
 * @returns {Promise<Object>} Session details with all attendance logs.
 */
async function getAttendanceReportForSession(sessionId) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      subjectInst: {
        include: {
          subject: true,
          section: true,
          faculty: true,
        },
      },
      logs: {
        include: {
          student: {
            select: { id: true, name: true, enrollmentNo: true, rfidUid: true },
          },
        },
        orderBy: { timestamp: 'asc' }, // FIX: Changed to 'timestamp'
      },
    },
  });

  if (!session) {
    throw createError(404, 'Session not found.');
  }

  return session;
}

/**
 * Generates a summarized attendance report for a section over a date range,
 * including present/absent counts and percentages per student, with optional subject filtering.
 * @param {object} filters - Filters for the report (sectionId, startDate, endDate, subjectId).
 * @returns {Promise<Array<Object>>} Aggregated attendance report.
 */
async function getAggregatedAttendanceReport(filters) {
  const { sectionId, startDate, endDate, subjectId } = filters;

  const start = startDate ? new Date(startDate) : undefined;
  if (start) start.setHours(0, 0, 0, 0);
  const end = endDate ? new Date(endDate) : undefined;
  if (end) end.setHours(23, 59, 59, 999);

  // 1. Get all students in the specified section
  const studentsInSection = await prisma.student.findMany({
    where: { sectionId: parseInt(sectionId) },
    select: { id: true, name: true, enrollmentNo: true },
    orderBy: { name: 'asc' },
  });

  if (studentsInSection.length === 0) {
    return []; // No students in this section
  }

  // 2. Get all relevant sessions for the section and date range, optionally by subject
  const sessionWhereClause = {
    subjectInst: {
      sectionId: parseInt(sectionId),
      subjectId: subjectId ? parseInt(subjectId) : undefined,
    },
    startAt: {
      gte: start,
      lte: end,
    },
    isClosed: true, // Only count closed sessions for reports
  };

  const relevantSessions = await prisma.classSession.findMany({
    where: sessionWhereClause,
    select: { id: true, subjectInstId: true },
  });

  const sessionIds = relevantSessions.map(s => s.id);
  const totalClasses = relevantSessions.length; // Total classes for the criteria

  if (totalClasses === 0) {
    // If no classes were held, all students have 0% attendance
    return studentsInSection.map(student => ({
      studentId: student.id,
      name: student.name,
      enrollmentNo: student.enrollmentNo,
      presentCount: 0,
      absentCount: 0,
      attendancePercentage: 0,
      totalClasses: 0,
    }));
  }

  // 3. Get all attendance logs for these sessions
  const attendanceLogs = await prisma.attendanceLog.findMany({
    where: {
      sessionId: { in: sessionIds },
      status: 'PRESENT',
    },
    select: { sessionId: true, studentId: true },
  });

  // Aggregate attendance for each student
  const studentAttendanceMap = new Map();
  studentsInSection.forEach(student => {
    studentAttendanceMap.set(student.id, {
      studentId: student.id,
      name: student.name,
      enrollmentNo: student.enrollmentNo,
      presentCount: 0,
      absentCount: 0,
      attendancePercentage: 0,
      totalClasses: totalClasses,
    });
  });

  attendanceLogs.forEach(log => {
    const studentData = studentAttendanceMap.get(log.studentId);
    if (studentData) {
      studentData.presentCount++;
    }
  });

  // Calculate absent count and percentage
  const aggregatedReport = Array.from(studentAttendanceMap.values()).map(studentData => {
    studentData.absentCount = studentData.totalClasses - studentData.presentCount;
    studentData.attendancePercentage =
      studentData.totalClasses > 0
        ? parseFloat(((studentData.presentCount / studentData.totalClasses) * 100).toFixed(2))
        : 0;
    return studentData;
  });

  return aggregatedReport;
}


export {
  processRfidScan,
  getAttendanceSnapshot,
  getDetailedAttendanceReport,
  getTeacherAttendanceByClassAndDate,
  getAttendanceReportForSession,
  getAggregatedAttendanceReport,
};