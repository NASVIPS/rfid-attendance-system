// rfid-attendance-system/apps/backend/src/services/sectionService.js
import createError from 'http-errors';
import prisma from './prisma.js'; // Our centralized Prisma client

/**
 * Creates a new section.
 * @param {object} data - { name, semesterId }
 * @returns {Promise<object>} Created section data.
 */
async function createSection(data) {
    const { name, semesterId } = data;

    if (!name || !semesterId) {
        throw createError(400, 'Section name and semester ID are required.');
    }

    const parsedSemesterId = parseInt(semesterId);

    if (isNaN(parsedSemesterId)) {
        throw createError(400, 'Invalid Semester ID provided.');
    }

    // Check for uniqueness: A semester cannot have two sections with the same name
    const existingSection = await prisma.section.findFirst({
        where: {
            name,
            semesterId: parsedSemesterId,
        },
    });

    if (existingSection) {
        throw createError(409, `Section "${name}" already exists for semester ID ${parsedSemesterId}.`);
    }

    try {
        const newSection = await prisma.section.create({
            data: {
                name,
                semesterId: parsedSemesterId,
            },
            include: {
                semester: {
                    include: {
                        course: true
                    }
                }
            } // Include semester and course details for response
        });
        return newSection;
    } catch (error) {
        console.error('Error creating section:', error);
        if (error.code === 'P2003') { // Foreign key constraint violation
            throw createError(400, 'Invalid semesterId provided for section. Semester not found.');
        }
        throw createError(500, 'Failed to create section due to a database error.');
    }
}

/**
 * Retrieves all sections with their associated semester and course.
 * @returns {Promise<Array<object>>} List of all sections.
 */
async function getAllSections() {
    return prisma.section.findMany({
        include: {
            semester: {
                include: {
                    course: true
                }
            }
        }, // Include semester and course details
        orderBy: [{ semester: { number: 'asc' } }, { name: 'asc' }],
    });
}

/**
 * Updates an existing section.
 * @param {number} sectionId - The ID of the section to update.
 * @param {object} data - { name?, semesterId? }
 * @returns {Promise<object>} Updated section data.
 */
async function updateSection(sectionId, data) {
    const { name, semesterId } = data;

    const updateData = {};
    if (name !== undefined && name !== null) updateData.name = name;
    if (semesterId !== undefined && semesterId !== null) updateData.semesterId = parseInt(semesterId);

    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) {
        throw createError(404, 'Section not found.');
    }

    // Check for uniqueness during update if name or semesterId are changed
    if ((name !== undefined && name !== section.name) || (semesterId !== undefined && parseInt(semesterId) !== section.semesterId)) {
        const newName = updateData.name || section.name;
        const newSemesterId = updateData.semesterId || section.semesterId;
        const existingConflict = await prisma.section.findFirst({
            where: {
                name: newName,
                semesterId: newSemesterId,
                NOT: { id: sectionId }, // Exclude the current section itself
            },
        });
        if (existingConflict) {
            throw createError(409, `Section "${newName}" already exists for semester ID ${newSemesterId}.`);
        }
    }

    try {
        const updatedSection = await prisma.section.update({
            where: { id: sectionId },
            data: updateData,
            include: {
                semester: {
                    include: {
                        course: true
                    }
                }
            }
        });
        return updatedSection;
    } catch (error) {
        console.error('Error updating section:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Section not found.');
        }
        if (error.code === 'P2003') { // Foreign key constraint violation (invalid semesterId)
            throw createError(400, 'Invalid semesterId provided for section update. Semester not found.');
        }
        throw createError(500, 'Failed to update section due to a database error.');
    }
}

/**
 * Deletes a section.
 * @param {number} sectionId - The ID of the section to delete.
 */
async function deleteSection(sectionId) {
    try {
        await prisma.section.delete({ where: { id: sectionId } });
    } catch (error) {
        console.error('Error deleting section:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Section not found.');
        }
        if (error.code === 'P2003') { // Foreign key constraint violation (e.g., students, subject instances, scheduled classes linked)
            throw createError(409, 'Cannot delete section: it is linked to existing students, subject instances, or scheduled classes. Please delete associated data first.');
        }
        throw createError(500, 'Failed to delete section due to a database error.');
    }
}

export {
    createSection,
    getAllSections,
    updateSection,
    deleteSection,
};