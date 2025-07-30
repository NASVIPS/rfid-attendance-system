// rfid-attendance-system/apps/backend/src/services/courseService.js
import createError from 'http-errors';
import prisma from './prisma.js'; // Our centralized Prisma client

/**
 * Creates a new course.
 * @param {object} data - { name, departmentId, durationYears, degreeType }
 * @returns {Promise<object>} Created course data.
 */
async function createCourse(data) {
    const { name, departmentId, durationYears, degreeType } = data;

    if (!name || !departmentId || !durationYears || !degreeType) {
        throw createError(400, 'Name, department ID, duration, and degree type are required.');
    }

    const existingCourse = await prisma.course.findFirst({ where: { name, departmentId: parseInt(departmentId) } });
    if (existingCourse) {
        throw createError(409, 'Course with this name already exists in this department.');
    }

    try {
        const newCourse = await prisma.course.create({
            data: {
                name,
                departmentId: parseInt(departmentId),
                durationYears: parseInt(durationYears),
                degreeType,
            },
            include: { department: true }
        });
        return newCourse;
    } catch (error) {
        console.error('Error creating course:', error);
        if (error.code === 'P2003') { // Foreign key constraint violation
            throw createError(400, 'Invalid departmentId provided.');
        }
        throw createError(500, 'Failed to create course due to a database error.');
    }
}

/**
 * Retrieves all courses with their associated department.
 * @returns {Promise<Array<object>>} List of all courses.
 */
async function getAllCourses() {
    return prisma.course.findMany({
        include: { department: true },
        orderBy: { name: 'asc' },
    });
}

/**
 * Updates an existing course.
 * @param {number} courseId - The ID of the course to update.
 * @param {object} data - { name, departmentId, durationYears, degreeType }
 * @returns {Promise<object>} Updated course data.
 */
async function updateCourse(courseId, data) {
    const { name, departmentId, durationYears, degreeType } = data;

    const updateData = {};
    if (name) updateData.name = name;
    if (departmentId) updateData.departmentId = parseInt(departmentId);
    if (durationYears) updateData.durationYears = parseInt(durationYears);
    if (degreeType) updateData.degreeType = degreeType;

    try {
        const updatedCourse = await prisma.course.update({
            where: { id: courseId },
            data: updateData,
            include: { department: true }
        });
        return updatedCourse;
    } catch (error) {
        console.error('Error updating course:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Course not found.');
        }
        if (error.code === 'P2002') { // Unique constraint violation
            throw createError(409, 'Course with this name already exists in this department.');
        }
        throw createError(500, 'Failed to update course due to a database error.');
    }
}

/**
 * Deletes a course.
 * @param {number} courseId - The ID of the course to delete.
 */
async function deleteCourse(courseId) {
    try {
        await prisma.course.delete({ where: { id: courseId } });
    } catch (error) {
        console.error('Error deleting course:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Course not found.');
        }
        if (error.code === 'P2003') { // Foreign key constraint violation (e.g., semesters/sections linked)
            throw createError(409, 'Cannot delete course: it is linked to existing semesters or subjects. Please delete associated data first.');
        }
        throw createError(500, 'Failed to delete course due to a database error.');
    }
}

/**
 * Helper to get all departments for dropdowns.
 */
async function getAllDepartments() {
    return prisma.department.findMany({ orderBy: { name: 'asc' } });
}


export {
    createCourse,
    getAllCourses,
    updateCourse,
    deleteCourse,
    getAllDepartments,
};