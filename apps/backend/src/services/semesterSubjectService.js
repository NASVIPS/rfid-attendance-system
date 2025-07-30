    // rfid-attendance-system/apps/backend/src/services/semesterSubjectService.js
import createError from 'http-errors';
import prisma from './prisma.js';

/**
 * Creates a new SemesterSubject association.
 * @param {object} data - { semesterId, subjectId }
 * @returns {Promise<object>} Created SemesterSubject association.
 */
async function createSemesterSubject(data) {
    const { semesterId, subjectId } = data;

    if (!semesterId || !subjectId) {
        throw createError(400, 'Semester ID and Subject ID are required to associate a subject with a semester.');
    }

    const parsedSemesterId = parseInt(semesterId);
    const parsedSubjectId = parseInt(subjectId);

    if (isNaN(parsedSemesterId) || isNaN(parsedSubjectId)) {
        throw createError(400, 'Invalid Semester ID or Subject ID provided.');
    }

    // Check for uniqueness: A subject can only be associated with a specific semester once
    const existingAssociation = await prisma.semesterSubject.findUnique({
        where: {
            semesterId_subjectId: {
                semesterId: parsedSemesterId,
                subjectId: parsedSubjectId,
            },
        },
    });

    if (existingAssociation) {
        throw createError(409, 'This subject is already associated with this semester.');
    }

    try {
        const newAssociation = await prisma.semesterSubject.create({
            data: {
                semesterId: parsedSemesterId,
                subjectId: parsedSubjectId,
            },
            include: {
                semester: {
                    include: {
                        course: true
                    }
                },
                subject: true
            }
        });
        return newAssociation;
    } catch (error) {
        console.error('Error creating SemesterSubject association:', error);
        if (error.code === 'P2003') { // Foreign key constraint violation
            throw createError(400, 'Invalid Semester ID or Subject ID provided. Related entity not found.');
        }
        throw createError(500, 'Failed to create SemesterSubject association due to a database error.');
    }
}

/**
 * Retrieves all SemesterSubject associations with their full details.
 * @returns {Promise<Array<object>>} List of all SemesterSubject associations.
 */
async function getAllSemesterSubjects() {
    return prisma.semesterSubject.findMany({
        include: {
            semester: {
                include: {
                    course: true
                }
            },
            subject: true
        },
        orderBy: [
            { semester: { academicYear: 'asc' } },
            { semester: { course: { name: 'asc' } } },
            { semester: { number: 'asc' } },
            { subject: { name: 'asc' } }
        ]
    });
}

/**
 * Deletes a SemesterSubject association.
 * @param {number} associationId - The ID of the SemesterSubject association to delete.
 */
async function deleteSemesterSubject(associationId) {
    try {
        await prisma.semesterSubject.delete({ where: { id: associationId } });
    } catch (error) {
        console.error('Error deleting SemesterSubject association:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'SemesterSubject association not found.');
        }
        throw createError(500, 'Failed to delete SemesterSubject association due to a database error.');
    }
}

// Note: Update is not provided as typically, a SemesterSubject association is either created or deleted,
// not updated. If an association changes (e.g., subject moves to a different semester), it's often
// modeled as deleting the old and creating a new one.

export {
    createSemesterSubject,
    getAllSemesterSubjects,
    deleteSemesterSubject,
};