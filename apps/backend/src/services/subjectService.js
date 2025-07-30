// rfid-attendance-system/apps/backend/src/services/subjectService.js
import createError from 'http-errors';
import prisma from './prisma.js'; // Our centralized Prisma client

/**
 * Creates a new subject.
 * @param {object} data - { code, name, credits (optional) }
 * @returns {Promise<object>} Created subject data.
 */
async function createSubject(data) {
    const { code, name, credits } = data;

    if (!code || !name) {
        throw createError(400, 'Subject code and name are required.');
    }

    const existingSubject = await prisma.subject.findUnique({ where: { code } });
    if (existingSubject) {
        throw createError(409, 'Subject with this code already exists.');
    }

    try {
        const newSubject = await prisma.subject.create({
            data: {
                code,
                name,
                credits: credits ? parseInt(credits) : null,
            },
        });
        return newSubject;
    } catch (error) {
        console.error('Error creating subject:', error);
        throw createError(500, 'Failed to create subject due to a database error.');
    }
}

/**
 * Retrieves all subjects.
 * @returns {Promise<Array<object>>} List of all subjects.
 */
async function getAllSubjects() { // Reusing this name, but it's the primary getter
    return prisma.subject.findMany({ orderBy: { name: 'asc' } });
}

/**
 * Updates an existing subject.
 * @param {number} subjectId - The ID of the subject to update.
 * @param {object} data - { code, name, credits }
 * @returns {Promise<object>} Updated subject data.
 */
async function updateSubject(subjectId, data) {
    const { code, name, credits } = data;

    const updateData = {};
    if (code) updateData.code = code;
    if (name) updateData.name = name;
    if (credits !== undefined) updateData.credits = credits ? parseInt(credits) : null; // Allow nulling out credits

    try {
        const updatedSubject = await prisma.subject.update({
            where: { id: subjectId },
            data: updateData,
        });
        return updatedSubject;
    } catch (error) {
        console.error('Error updating subject:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Subject not found.');
        }
        if (error.code === 'P2002') { // Unique constraint violation (code)
            throw createError(409, 'Subject with this code already exists.');
        }
        throw createError(500, 'Failed to update subject due to a database error.');
    }
}

/**
 * Deletes a subject.
 * @param {number} subjectId - The ID of the subject to delete.
 */
async function deleteSubject(subjectId) {
    try {
        await prisma.subject.delete({ where: { id: subjectId } });
    } catch (error) {
        console.error('Error deleting subject:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Subject not found.');
        }
        if (error.code === 'P2003') { // Foreign key constraint violation (e.g., subject instances linked)
            throw createError(409, 'Cannot delete subject: it is linked to existing subject instances or scheduled classes. Please delete associated data first.');
        }
        throw createError(500, 'Failed to delete subject due to a database error.');
    }
}

export {
    createSubject,
    getAllSubjects,
    updateSubject,
    deleteSubject,
};