// rfid-attendance-system/apps/backend/src/services/semesterService.js
import createError from 'http-errors';
import prisma from './prisma.js'; // Our centralized Prisma client

/**
 * Creates a new semester.
 * @param {object} data - { courseId, number, type }
 * @returns {Promise<object>} Created semester data.
 */
async function createSemester(data) {
    const { courseId, number, type } = data;

    if (!courseId || !number || !type) {
        throw createError(400, 'Course ID, number, and type are required for semester creation.');
    }

    // Ensure courseId and number are proper integers
    const parsedCourseId = parseInt(courseId);
    const parsedNumber = parseInt(number);

    if (isNaN(parsedCourseId) || isNaN(parsedNumber)) {
        throw createError(400, 'Invalid Course ID or Semester Number provided.');
    }

    // Check for uniqueness: A course cannot have two semesters with the same number/type (optional, depends on exact uniqueness rule)
    // For simplicity, let's ensure unique (courseId, number) combination.
    const existingSemester = await prisma.semester.findFirst({
        where: {
            courseId: parsedCourseId,
            number: parsedNumber,
        },
    });

    if (existingSemester) {
        throw createError(409, `Semester ${parsedNumber} already exists for course ID ${parsedCourseId}.`);
    }

    try {
        const newSemester = await prisma.semester.create({
            data: {
                courseId: parsedCourseId,
                number: parsedNumber,
                type,
            },
            include: { course: true } // Include course details for response
        });
        return newSemester;
    } catch (error) {
        console.error('Error creating semester:', error);
        if (error.code === 'P2003') { // Foreign key constraint violation
            throw createError(400, 'Invalid courseId provided for semester. Course not found.');
        }
        throw createError(500, 'Failed to create semester due to a database error.');
    }
}

/**
 * Retrieves all semesters with their associated courses.
 * @returns {Promise<Array<object>>} List of all semesters.
 */
async function getAllSemesters() {
    return prisma.semester.findMany({
        include: { course: true }, // Include course details
        orderBy: [{ course: { name: 'asc' } }, { number: 'asc' }],
    });
}

/**
 * Updates an existing semester.
 * @param {number} semesterId - The ID of the semester to update.
 * @param {object} data - { courseId?, number?, type? }
 * @returns {Promise<object>} Updated semester data.
 */
async function updateSemester(semesterId, data) {
    const { courseId, number, type } = data;

    // Build update data, parsing numbers if present
    const updateData = {};
    if (courseId !== undefined && courseId !== null) updateData.courseId = parseInt(courseId);
    if (number !== undefined && number !== null) updateData.number = parseInt(number);
    if (type !== undefined && type !== null) updateData.type = type;

    // Check if the semester exists
    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) {
        throw createError(404, 'Semester not found.');
    }

    // Check for uniqueness during update if courseId or number are changed
    if ((courseId !== undefined && courseId !== semester.courseId) || (number !== undefined && number !== semester.number)) {
        const newCourseId = updateData.courseId || semester.courseId;
        const newNumber = updateData.number || semester.number;
        const existingConflict = await prisma.semester.findFirst({
            where: {
                courseId: newCourseId,
                number: newNumber,
                NOT: { id: semesterId }, // Exclude the current semester itself
            },
        });
        if (existingConflict) {
            throw createError(409, `Semester ${newNumber} already exists for course ID ${newCourseId}.`);
        }
    }

    try {
        const updatedSemester = await prisma.semester.update({
            where: { id: semesterId },
            data: updateData,
            include: { course: true }
        });
        return updatedSemester;
    } catch (error) {
        console.error('Error updating semester:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Semester not found.');
        }
        if (error.code === 'P2003') { // Foreign key constraint violation (invalid courseId)
            throw createError(400, 'Invalid courseId provided for semester update. Course not found.');
        }
        throw createError(500, 'Failed to update semester due to a database error.');
    }
}

/**
 * Deletes a semester.
 * @param {number} semesterId - The ID of the semester to delete.
 */
async function deleteSemester(semesterId) {
    try {
        await prisma.semester.delete({ where: { id: semesterId } });
    } catch (error) {
        console.error('Error deleting semester:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Semester not found.');
        }
        if (error.code === 'P2003') { // Foreign key constraint violation (e.g., sections linked)
            throw createError(409, 'Cannot delete semester: it is linked to existing sections. Please delete associated sections first.');
        }
        throw createError(500, 'Failed to delete semester due to a database error.');
    }
}

export {
    createSemester,
    getAllSemesters,
    updateSemester,
    deleteSemester,
};