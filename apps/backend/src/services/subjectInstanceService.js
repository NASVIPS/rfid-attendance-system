// rfid-attendance-system/apps/backend/src/services/subjectInstanceService.js
import createError from 'http-errors';
import prisma from './prisma.js';

/**
 * Creates a new SubjectInstance, linking a subject, section, and faculty.
 * @param {object} data - { subjectId, sectionId, facultyId }
 * @returns {Promise<object>} Created SubjectInstance data.
 */
async function createSubjectInstance(data) {
    const { subjectId, sectionId, facultyId } = data;

    if (!subjectId || !sectionId || !facultyId) {
        throw createError(400, 'Subject ID, Section ID, and Faculty ID are required to create a subject instance.');
    }

    const parsedSubjectId = parseInt(subjectId);
    const parsedSectionId = parseInt(sectionId);
    const parsedFacultyId = parseInt(facultyId);

    if (isNaN(parsedSubjectId) || isNaN(parsedSectionId) || isNaN(parsedFacultyId)) {
        throw createError(400, 'Invalid Subject ID, Section ID, or Faculty ID provided.');
    }

    // Check for uniqueness: A specific subject in a specific section can only be taught by one faculty
    // (This matches the @@unique([subjectId, sectionId, facultyId]) constraint in schema.prisma)
    const existingInstance = await prisma.subjectInstance.findUnique({
        where: {
            subjectId_sectionId_facultyId: {
                subjectId: parsedSubjectId,
                sectionId: parsedSectionId,
                facultyId: parsedFacultyId,
            },
        },
    });

    if (existingInstance) {
        throw createError(409, 'This subject is already assigned to this section by this faculty member.');
    }

    try {
        const newInstance = await prisma.subjectInstance.create({
            data: {
                subjectId: parsedSubjectId,
                sectionId: parsedSectionId,
                facultyId: parsedFacultyId,
            },
            include: {
                subject: true,
                section: {
                    include: {
                        semester: {
                            include: {
                                course: true
                            }
                        }
                    }
                },
                faculty: { select: { id: true, name: true, empId: true } }
            }
        });
        return newInstance;
    } catch (error) {
        console.error('Error creating subject instance:', error);
        if (error.code === 'P2003') { // Foreign key constraint violation
            throw createError(400, 'Invalid Subject ID, Section ID, or Faculty ID provided. Related entity not found.');
        }
        throw createError(500, 'Failed to create subject instance due to a database error.');
    }
}

/**
 * Retrieves all SubjectInstances with their associated subject, section, semester, course, and faculty details.
 * @returns {Promise<Array<object>>} List of all SubjectInstance objects.
 */
async function getAllSubjectInstances() {
    return prisma.subjectInstance.findMany({
        include: {
            subject: true,
            section: {
                include: {
                    semester: {
                        include: {
                            course: true
                        }
                    }
                }
            },
            faculty: { select: { id: true, name: true, empId: true } }
        },
        orderBy: [
            { section: { semester: { course: { name: 'asc' } } } },
            { section: { semester: { number: 'asc' } } },
            { section: { name: 'asc' } },
            { subject: { name: 'asc' } }
        ]
    });
}

/**
 * Updates an existing SubjectInstance.
 * Note: Changing subjectId, sectionId, or facultyId would typically mean creating a new instance
 * and deleting the old one, due to the unique constraint. This update assumes modifying other potential fields
 * or re-assigning if the unique constraint is lifted or managed carefully.
 * For this implementation, we'll allow updating (re-assigning) all fields, letting Prisma handle the unique constraint error.
 * @param {number} instanceId - The ID of the SubjectInstance to update.
 * @param {object} data - { subjectId?, sectionId?, facultyId? }
 * @returns {Promise<object>} Updated SubjectInstance data.
 */
async function updateSubjectInstance(instanceId, data) {
    const { subjectId, sectionId, facultyId } = data;

    const updateData = {};
    if (subjectId !== undefined && subjectId !== null) updateData.subjectId = parseInt(subjectId);
    if (sectionId !== undefined && sectionId !== null) updateData.sectionId = parseInt(sectionId);
    if (facultyId !== undefined && facultyId !== null) updateData.facultyId = parseInt(facultyId);

    try {
        const updatedInstance = await prisma.subjectInstance.update({
            where: { id: instanceId },
            data: updateData,
            include: {
                subject: true,
                section: { include: { semester: { include: { course: true } } } },
                faculty: { select: { id: true, name: true, empId: true } }
            }
        });
        return updatedInstance;
    } catch (error) {
        console.error('Error updating subject instance:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Subject instance not found.');
        }
        if (error.code === 'P2003') { // Foreign key constraint violation
            throw createError(400, 'Invalid Subject ID, Section ID, or Faculty ID provided for update. Related entity not found.');
        }
        if (error.code === 'P2002') { // Unique constraint violation
            throw createError(409, 'Cannot update: this assignment (Subject, Section, Faculty) already exists.');
        }
        throw createError(500, 'Failed to update subject instance due to a database error.');
    }
}

/**
 * Deletes a SubjectInstance.
 * @param {number} instanceId - The ID of the SubjectInstance to delete.
 */
async function deleteSubjectInstance(instanceId) {
    try {
        await prisma.subjectInstance.delete({ where: { id: instanceId } });
    } catch (error) {
        console.error('Error deleting subject instance:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Subject instance not found.');
        }
        if (error.code === 'P2003') { // Foreign key constraint violation (e.g., scheduled classes linked)
            throw createError(409, 'Cannot delete subject instance: it is linked to existing scheduled classes. Please delete associated scheduled classes first.');
        }
        throw createError(500, 'Failed to delete subject instance due to a database error.');
    }
}

export {
    createSubjectInstance,
    getAllSubjectInstances,
    updateSubjectInstance,
    deleteSubjectInstance,
};