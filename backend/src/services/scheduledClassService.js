// rfid-attendance-system/apps/backend/src/services/scheduledClassService.js
import createError from 'http-errors';
import prisma from './prisma.js'; // Ensure prisma is imported

/**
 * Creates a new scheduled class entry and ensures a corresponding SubjectInstance exists.
 * @param {object} data - Data for the new scheduled class: { dayOfWeek, startTime, endTime, subjectInstanceId, facultyId? }
 * @returns {Promise<Object>} The created ScheduledClass object.
 */
async function createScheduledClass(data) {
  const { dayOfWeek, startTime, endTime, subjectInstanceId, facultyId } = data;

  if (!dayOfWeek || !startTime || !endTime || !subjectInstanceId) {
    throw createError(400, 'Day of week, start/end time, and subject instance ID are required.');
  }

  const parsedSubjectInstanceId = parseInt(subjectInstanceId);
  if (isNaN(parsedSubjectInstanceId)) {
    throw createError(400, 'Invalid Subject Instance ID provided.');
  }

  // OPTIMIZATION 1: Move SubjectInstance fetch outside transaction to reduce transaction time
  const subjectInstance = await prisma.subjectInstance.findUnique({
    where: { id: parsedSubjectInstanceId },
    select: {
      subjectId: true,
      sectionId: true,
      facultyId: true
    }
  });

  if (!subjectInstance) {
    throw createError(404, 'Subject Instance not found. Cannot schedule class.');
  }

  const derivedSubjectId = subjectInstance.subjectId;
  const derivedSectionId = subjectInstance.sectionId;
  const derivedFacultyId = facultyId ? parseInt(facultyId) : subjectInstance.facultyId;

  if (isNaN(derivedFacultyId)) {
    throw createError(400, 'Invalid facultyId provided or derived.');
  }

  // OPTIMIZATION 2: Check for duplicates outside transaction
  const existingScheduledClass = await prisma.scheduledClass.findUnique({
    where: {
      dayOfWeek_subjectId_sectionId_startTime_endTime: {
        dayOfWeek,
        subjectId: derivedSubjectId,
        sectionId: derivedSectionId,
        startTime,
        endTime
      },
    },
  });

  if (existingScheduledClass) {
    throw createError(409, 'A class is already scheduled for this subject, section, day, and time slot.');
  }

  try {
    // OPTIMIZATION 3: Use transaction with increased timeout and minimal operations
    const newScheduledClass = await prisma.$transaction(async (tx) => {
      // Only the create operation inside transaction now
      const createdClass = await tx.scheduledClass.create({
        data: {
          dayOfWeek,
          startTime,
          endTime,
          subject: { connect: { id: derivedSubjectId } },
          section: { connect: { id: derivedSectionId } },
          faculty: derivedFacultyId ? { connect: { id: derivedFacultyId } } : undefined,
          subjectInst: { connect: { id: parsedSubjectInstanceId } },
        },
        include: {
          subject: true,
          section: {
            include: {
              semester: {
                include: {
                  course: true,
                },
              },
            },
          },
          faculty: { select: { id: true, name: true, empId: true } },
          subjectInst: {
            include: {
              subject: true,
              section: true,
              faculty: { select: { id: true, name: true, empId: true } }
            }
          }
        },
      });

      return createdClass;
    }, {
      // OPTIMIZATION 4: Increase transaction timeout for serverless environments
      timeout: 15000, // 15 seconds timeout
      isolationLevel: 'ReadCommitted' // Use lighter isolation level
    });

    return newScheduledClass;
  } catch (error) {
    console.error('Error creating scheduled class:', error);
    if (error.code === 'P2003') {
      throw createError(400, 'Invalid subjectInstanceId, facultyId, subjectId, or sectionId provided.');
    }
    if (error.code === 'P2002') {
      console.error('Prisma unique constraint error during scheduled class creation:', error.meta);
      throw createError(409, 'A class is already scheduled for this subject, section, day, and time slot.');
    }
    if (error.code === 'P2028') {
      throw createError(408, 'Request timeout: The operation took too long to complete. Please try again.');
    }
    throw createError(500, 'Failed to create scheduled class due to a database error.');
  }
}

/**
 * Retrieves all scheduled classes with associated details.
 * @returns {Promise<Array<Object>>}
 */
async function getAllScheduledClasses() {
  try {
    return await prisma.scheduledClass.findMany({
      include: {
        subject: true,
        section: {
          include: {
            semester: {
              include: {
                course: true,
              },
            },
          },
        },
        faculty: { select: { id: true, name: true, empId: true } },
        subjectInst: {
          include: {
            subject: true,
            section: {
              include: {
                semester: {
                  include: {
                    course: true,
                  }
                }
              }
            },
            faculty: { select: { id: true, name: true, empId: true } }
          }
        }
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  } catch (error) {
    console.error('Error fetching scheduled classes:', error);
    throw createError(500, 'Failed to fetch scheduled classes.');
  }
}

/**
 * Updates an existing scheduled class.
 * @param {number} id - Class ID to update.
 * @param {object} data - Updated values.
 * @returns {Promise<Object>}
 */
async function updateScheduledClass(id, data) {
  const { dayOfWeek, startTime, endTime, subjectInstanceId, facultyId } = data;

  const parsedSubjectInstanceId = subjectInstanceId ? parseInt(subjectInstanceId) : undefined;
  if (subjectInstanceId !== undefined && isNaN(parsedSubjectInstanceId)) {
    throw createError(400, 'Invalid subjectInstanceId provided for update.');
  }

  let derivedSubjectId;
  let derivedSectionId;
  let derivedFacultyId;

  // OPTIMIZATION 5: Move all validation queries outside transaction
  if (parsedSubjectInstanceId) {
    const newSubjectInstance = await prisma.subjectInstance.findUnique({
      where: { id: parsedSubjectInstanceId },
      select: { subjectId: true, sectionId: true, facultyId: true }
    });
    if (!newSubjectInstance) {
      throw createError(404, 'New Subject Instance not found for update.');
    }
    derivedSubjectId = newSubjectInstance.subjectId;
    derivedSectionId = newSubjectInstance.sectionId;
    derivedFacultyId = newSubjectInstance.facultyId;
  }

  const existingScheduledClass = await prisma.scheduledClass.findUnique({
    where: { id: parseInt(id) },
    include: {
      subjectInst: {
        select: { subjectId: true, sectionId: true, facultyId: true }
      }
    }
  });

  if (!existingScheduledClass) {
    throw createError(404, 'Scheduled class not found.');
  }

  // Check for conflicts before transaction
  const effectiveDayOfWeek = dayOfWeek || existingScheduledClass.dayOfWeek;
  const effectiveStartTime = startTime || existingScheduledClass.startTime;
  const effectiveEndTime = endTime || existingScheduledClass.endTime;
  const effectiveSubjectId = derivedSubjectId || existingScheduledClass.subjectInst.subjectId;
  const effectiveSectionId = derivedSectionId || existingScheduledClass.subjectInst.sectionId;

  if (
    (dayOfWeek && dayOfWeek !== existingScheduledClass.dayOfWeek) ||
    (startTime && startTime !== existingScheduledClass.startTime) ||
    (endTime && endTime !== existingScheduledClass.endTime) ||
    (parsedSubjectInstanceId && parsedSubjectInstanceId !== existingScheduledClass.subjectInstId)
  ) {
    const existingConflict = await prisma.scheduledClass.findFirst({
      where: {
        dayOfWeek_subjectId_sectionId_startTime_endTime: {
          dayOfWeek: effectiveDayOfWeek,
          subjectId: effectiveSubjectId,
          sectionId: effectiveSectionId,
          startTime: effectiveStartTime,
          endTime: effectiveEndTime
        },
        NOT: { id: parseInt(id) },
      },
    });
    if (existingConflict) {
      throw createError(409, 'Another class is already scheduled for this subject, section, day, and time slot.');
    }
  }

  const updateData = {
    dayOfWeek: dayOfWeek || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    subject: derivedSubjectId ? { connect: { id: derivedSubjectId } } : undefined,
    section: derivedSectionId ? { connect: { id: derivedSectionId } } : undefined,
    faculty: facultyId !== undefined
      ? (facultyId ? { connect: { id: parseInt(facultyId) } } : { disconnect: true })
      : undefined,
    subjectInst: parsedSubjectInstanceId ? { connect: { id: parsedSubjectInstanceId } } : undefined,
  };

  try {
    // OPTIMIZATION 6: Simple update without transaction for single operations
    const result = await prisma.scheduledClass.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        subject: true,
        section: {
          include: {
            semester: {
              include: {
                course: true,
              },
            },
          },
        },
        faculty: { select: { id: true, name: true, empId: true } },
        subjectInst: {
          include: {
            subject: true,
            section: true,
            faculty: { select: { id: true, name: true, empId: true } }
          }
        }
      },
    });
    return result;
  } catch (error) {
    console.error('Error updating scheduled class:', error);
    if (error.code === 'P2025') {
      throw createError(404, 'Scheduled class not found.');
    }
    if (error.code === 'P2003') {
      throw createError(400, 'Invalid subjectInstanceId, facultyId, subjectId, or sectionId provided for update.');
    }
    throw createError(500, 'Failed to update scheduled class due to a database error.');
  }
}

/**
 * Deletes a scheduled class entry.
 * @param {number} id - Class ID to delete.
 */
async function deleteScheduledClass(id) {
  try {
    await prisma.scheduledClass.delete({
      where: { id: parseInt(id) },
    });
  } catch (error) {
    console.error('Error deleting scheduled class:', error);
    if (error.code === 'P2025') {
      throw createError(404, 'Scheduled class not found.');
    }
    throw createError(500, 'Failed to delete scheduled class due to a database error.');
  }
}

// OPTIMIZATION 7: Add caching for frequently accessed dropdown data
let cachedSubjects = null;
let cachedSections = null;
let cachedFaculty = null;
let cacheExpiry = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get all subjects for dropdowns with caching.
 */
async function getAllSubjects() {
  const now = Date.now();
  if (cachedSubjects && cacheExpiry && now < cacheExpiry) {
    return cachedSubjects;
  }
  
  cachedSubjects = await prisma.subject.findMany();
  cacheExpiry = now + CACHE_DURATION;
  return cachedSubjects;
}

/**
 * Get all sections for dropdowns with caching.
 */
async function getAllSections() {
  const now = Date.now();
  if (cachedSections && cacheExpiry && now < cacheExpiry) {
    return cachedSections;
  }
  
  cachedSections = await prisma.section.findMany({
    include: {
      semester: {
        include: {
          course: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  cacheExpiry = now + CACHE_DURATION;
  return cachedSections;
}

/**
 * Get all faculty for dropdowns with caching.
 */
async function getAllFaculty() {
  const now = Date.now();
  if (cachedFaculty && cacheExpiry && now < cacheExpiry) {
    return cachedFaculty;
  }
  
  cachedFaculty = await prisma.faculty.findMany({
    select: { id: true, name: true, empId: true },
  });
  cacheExpiry = now + CACHE_DURATION;
  return cachedFaculty;
}

export {
  createScheduledClass,
  getAllScheduledClasses,
  updateScheduledClass,
  deleteScheduledClass,
  getAllSubjects,
  getAllSections,
  getAllFaculty,
};
