// rfid-attendance-system/apps/backend/src/services/reportService.js
import createError from 'http-errors';
import prisma from './prisma.js'; // Ensure prisma is imported here

/**
 * Fetch per-student attendance report for a section over a date range,
 * optionally filtered by subject and course.
 *
 * @param {object} prisma        - The Prisma client instance.
 * @param {object} filters       - Filters: { sectionId?: number, subjectId?: number, courseId?: number, from: Date, to: Date }
 * @returns {Promise<Array<{
 * studentId: number,
 * name: string,
 * enrollmentNo: string,
 * presentCount: number,
 * absentCount: number,
 * totalClassesOccurred: number, // Total sessions for this subject/section in range
 * percentage: number
 * }>>}
 */
export async function getReport(prisma, filters) { // Changed signature to accept single filters object
  const { sectionId, subjectId, courseId, from, to } = filters;

  // 1) Parse & validate inputs
  // Make sectionIdNum optional; it will be undefined if sectionId is empty string or null
  const sectionIdNum = sectionId ? Number(sectionId) : undefined;
  const subjectIdNum = subjectId ? Number(subjectId) : undefined;
  const courseIdNum = courseId ? Number(courseId) : undefined;
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Validate only if sectionId is NOT provided
  if (
    isNaN(fromDate.getTime()) ||
    isNaN(toDate.getTime()) ||
    fromDate > toDate
  ) {
    throw createError(400, 'Invalid date range provided.');
  }
  // Validate sectionIdNum only if it was provided and is NaN
  if (sectionId && isNaN(sectionIdNum)) {
      throw createError(400, 'Invalid sectionId provided.');
  }


  // Normalize to full days
  fromDate.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone issues with date ranges
  toDate.setUTCHours(23, 59, 59, 999); // Use UTC to avoid timezone issues with date ranges

  // 2) Load all students. Filter by sectionId only if it's provided.
  const students = await prisma.student.findMany({
    where: {
      ...(sectionIdNum !== undefined && { sectionId: sectionIdNum }) // Conditionally add sectionId filter
    },
    select: {
      id: true,
      name: true,
      enrollmentNo: true
    }
  });

  // If no students match the criteria (e.g., sectionId is provided but no students in it)
  if (students.length === 0) {
    return [];
  }

  // 3) Count total closed sessions in the range for that section/subject/course
  // This represents "Total Classes Occurred"
  let sessionWhereClause = {
    isClosed: true,
    startAt: { gte: fromDate, lte: toDate },
    subjectInst: {
      ...(sectionIdNum !== undefined && { sectionId: sectionIdNum }), // Conditionally filter by sectionId
      ...(subjectIdNum !== undefined && { subjectId: subjectIdNum }), // Conditionally filter by subjectId
    }
  };

  if (courseIdNum) {
    sessionWhereClause.subjectInst.section = {
        semester: {
            courseId: courseIdNum
        }
    };
  }

  const totalClassesOccurred = await prisma.classSession.count({
    where: sessionWhereClause
  });

  // 4) Tally presents per student via groupBy
  let attendanceLogWhereClause = {
    status: 'PRESENT',
    timestamp: { gte: fromDate, lte: toDate },
    session: {
      subjectInst: {
        ...(sectionIdNum !== undefined && { sectionId: sectionIdNum }), // Conditionally filter by sectionId
        ...(subjectIdNum !== undefined && { subjectId: subjectIdNum }), // Conditionally filter by subjectId
      }
    }
  };

  if (courseIdNum) {
    attendanceLogWhereClause.session.subjectInst.section = {
        semester: {
            course: { id: courseIdNum }
        }
    };
  }

  const presentGroups = await prisma.attendanceLog.groupBy({
    by: ['studentId'],
    where: attendanceLogWhereClause,
    _count: { studentId: true }
  });

  // Map studentId → presentCount
  const presentMap = Object.fromEntries(
    presentGroups.map((g) => [g.studentId, g._count.studentId])
  );

  // 5) Build report rows
  const report = students.map((s) => {
    const presentCount = presentMap[s.id] || 0;
    const absentCount  = totalClassesOccurred - presentCount;
    const percentage =
      totalClassesOccurred > 0 ? (presentCount / totalClassesOccurred) * 100 : 0;

    return {
      studentId:    s.id,
      name:         s.name,
      enrollmentNo: s.enrollmentNo,
      presentCount,
      absentCount,
      totalClassesOccurred, // NEW: Total classes occurred
      percentage:   Math.round(percentage * 100) / 100  // two decimals
    };
  });

  // 6) Sort by student name
  report.sort((a, b) => a.name.localeCompare(b.name));

  return report;
}