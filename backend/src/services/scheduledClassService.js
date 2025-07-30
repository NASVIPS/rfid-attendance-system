// rfid-attendance-system/apps/backend/src/services/scheduledClassService.js
import createError from 'http-errors';
import prisma from './prisma.js'; // Ensure prisma is imported

/**
 * Creates a new scheduled class entry and ensures a corresponding SubjectInstance exists.
 * @param {object} data - Data for the new scheduled class: { dayOfWeek, startTime, endTime, subjectInstanceId, facultyId? }
 * @returns {Promise<Object>} The created ScheduledClass object.
 */
async function createScheduledClass(data) {
  const { dayOfWeek, startTime, endTime, subjectInstanceId, facultyId } = data; // Now expecting subjectInstanceId

  if (!dayOfWeek || !startTime || !endTime || !subjectInstanceId) {
    throw createError(400, 'Day of week, start/end time, and subject instance ID are required.');
  }

  const parsedSubjectInstanceId = parseInt(subjectInstanceId);
  if (isNaN(parsedSubjectInstanceId)) {
    throw createError(400, 'Invalid Subject Instance ID provided.');
  }

  // Fetch the SubjectInstance to get subjectId, sectionId, and assigned facultyId
  const subjectInstance = await prisma.subjectInstance.findUnique({
    where: { id: parsedSubjectInstanceId },
    select: {
      subjectId: true,
      sectionId: true,
      facultyId: true // The faculty assigned to this instance
    }
  });

  if (!subjectInstance) {
    throw createError(404, 'Subject Instance not found. Cannot schedule class.');
  }

  // Use the subjectId, sectionId, and facultyId from the SubjectInstance
  const derivedSubjectId = subjectInstance.subjectId;
  const derivedSectionId = subjectInstance.sectionId;
  const derivedFacultyId = facultyId ? parseInt(facultyId) : subjectInstance.facultyId; // Use provided facultyId or default to instance's faculty

  // Validate facultyId if provided or derived
  if (isNaN(derivedFacultyId)) {
    throw createError(400, 'Invalid facultyId provided or derived.');
  }

  try {
    const newScheduledClass = await prisma.$transaction(async (tx) => {
      // 1. Check for duplicate ScheduledClass using the NEW unique constraint
      const existingScheduledClass = await tx.scheduledClass.findUnique({
        where: {
          dayOfWeek_subjectId_sectionId_startTime_endTime: { // UPDATED: Use the new compound unique key
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

      // 2. Create the ScheduledClass
      const createdClass = await tx.scheduledClass.create({
        data: {
          dayOfWeek,
          startTime,
          endTime,
          subject: { connect: { id: derivedSubjectId } },
          section: { connect: { id: derivedSectionId } },
          faculty: derivedFacultyId ? { connect: { id: derivedFacultyId } } : undefined,
          subjectInst: { connect: { id: parsedSubjectInstanceId } }, // Link to the SubjectInstance
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
          subjectInst: { // Include SubjectInstance details
            include: {
              subject: true,
              section: true,
              faculty: { select: { id: true, name: true, empId: true } }
            }
          }
        },
      });

      return createdClass;
    });

    return newScheduledClass;
  } catch (error) {
    console.error('Error creating scheduled class:', error);
    if (error.code === 'P2003') { // Foreign key constraint violation
      throw createError(400, 'Invalid subjectInstanceId, facultyId, subjectId, or sectionId provided.');
    }
    if (error.code === 'P2002') { // Unique constraint violation (e.g., scheduledClass)
      console.error('Prisma unique constraint error during scheduled class creation:', error.meta);
      throw createError(409, 'A class is already scheduled for this subject, section, day, and time slot.'); // UPDATED error message
    }
    throw createError(500, 'Failed to create scheduled class due to a database error.');
  }
}

/**
 * Retrieves all scheduled classes with associated details.
 * @returns {Promise<Array<Object>>}
 */
async function getAllScheduledClasses() {
  return prisma.scheduledClass.findMany({
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
      subjectInst: { // This needs deeper includes
        include: {
          subject: true,
          section: {
            include: {
              semester: {
                include: {
                  course: true, // Course details via semester
                }
              }
            }
          }, // Section details for the instance, including nested semester
          faculty: { select: { id: true, name: true, empId: true } } // Faculty for the instance
        }
      }
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

/**
 * Updates an existing scheduled class.
 * @param {number} id - Class ID to update.
 * @param {object} data - Updated values.
 * @returns {Promise<Object>}
 */
async function updateScheduledClass(id, data) {
  const { dayOfWeek, startTime, endTime, subjectInstanceId, facultyId } = data;

  // Validate subjectInstanceId if provided
  const parsedSubjectInstanceId = subjectInstanceId ? parseInt(subjectInstanceId) : undefined;
  if (subjectInstanceId !== undefined && isNaN(parsedSubjectInstanceId)) {
    throw createError(400, 'Invalid subjectInstanceId provided for update.');
  }

  let derivedSubjectId;
  let derivedSectionId;
  let derivedFacultyId;

  if (parsedSubjectInstanceId) {
    // Fetch the new SubjectInstance details if subjectInstanceId is being updated
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

  // Get existing scheduled class to compare
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

  // Determine effective IDs for unique constraint check
  const effectiveDayOfWeek = dayOfWeek || existingScheduledClass.dayOfWeek;
  const effectiveStartTime = startTime || existingScheduledClass.startTime;
  const effectiveEndTime = endTime || existingScheduledClass.endTime;
  const effectiveSubjectId = derivedSubjectId || existingScheduledClass.subjectInst.subjectId;
  const effectiveSectionId = derivedSectionId || existingScheduledClass.subjectInst.sectionId;

  // Check for unique constraint violation on the NEW compound unique key
  if (
      (dayOfWeek && dayOfWeek !== existingScheduledClass.dayOfWeek) ||
      (startTime && startTime !== existingScheduledClass.startTime) ||
      (endTime && endTime !== existingScheduledClass.endTime) ||
      (parsedSubjectInstanceId && parsedSubjectInstanceId !== existingScheduledClass.subjectInstId)
  ) {
      const existingConflict = await prisma.scheduledClass.findFirst({
          where: {
              dayOfWeek_subjectId_sectionId_startTime_endTime: { // UPDATED: Use the new compound unique key
                dayOfWeek: effectiveDayOfWeek,
                subjectId: effectiveSubjectId,
                sectionId: effectiveSectionId,
                startTime: effectiveStartTime,
                endTime: effectiveEndTime
              },
              NOT: { id: parseInt(id) }, // Exclude current record
          },
      });
      if (existingConflict) {
          throw createError(409, 'Another class is already scheduled for this subject, section, day, and time slot.'); // UPDATED error message
      }
  }


  // Prepare data for ScheduledClass update
  const updateData = {
    dayOfWeek: dayOfWeek || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    subject: derivedSubjectId ? { connect: { id: derivedSubjectId } } : undefined,
    section: derivedSectionId ? { connect: { id: derivedSectionId } } : undefined,
    faculty: facultyId !== undefined
            ? (facultyId ? { connect: { id: parseInt(facultyId) } } : { disconnect: true })
            : undefined, // Handle optional facultyId update
    subjectInst: parsedSubjectInstanceId ? { connect: { id: parsedSubjectInstanceId } } : undefined,
  };

  try {
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
    if (error.code === 'P2003') { // Foreign key constraint violation
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

/**
 * Get all subjects for dropdowns.
 */
async function getAllSubjects() {
  return prisma.subject.findMany();
}

/**
 * Get all sections for dropdowns.
 */
async function getAllSections() {
  return prisma.section.findMany({
    include: {
      semester: {
        include: {
          course: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Get all faculty for dropdowns.
 */
async function getAllFaculty() {
  return prisma.faculty.findMany({
    select: { id: true, name: true, empId: true },
  });
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