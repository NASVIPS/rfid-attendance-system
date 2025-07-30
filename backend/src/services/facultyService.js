// rfid-attendance-system/apps/backend/src/services/facultyService.js
import createError from 'http-errors';
import bcrypt from 'bcryptjs';
import prisma from './prisma.js'; // Our centralized Prisma client

/**
 * Creates a new faculty user and links it to a User record.
 * @param {object} data - { email, password, name, empId, phone, rfidUid }
 * @returns {Promise<object>} Created faculty and user data.
 */
async function createFaculty(data) {
    const { email, password, name, empId, phone, rfidUid } = data;

    // 1. Check for existing user or faculty with same email/empId/rfidUid
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw createError(409, 'User with this email already exists.');
    }
    const existingEmpId = await prisma.faculty.findUnique({ where: { empId } });
    if (existingEmpId) {
        throw createError(409, 'Faculty with this Employee ID already exists.');
    }
    const existingRfid = await prisma.faculty.findUnique({ where: { rfidUid } });
    if (existingRfid) {
        throw createError(409, 'Faculty with this RFID UID already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        // Use a Prisma transaction to ensure both User and Faculty are created or neither
        const newFaculty = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    role: 'TEACHER', // Default role for new faculty
                },
            });

            const faculty = await tx.faculty.create({
                data: {
                    userId: user.id,
                    name,
                    empId,
                    phone,
                    rfidUid,
                },
                include: { user: true }, // Include user details in the response
            });
            return faculty;
        });

        return {
            id: newFaculty.id,
            name: newFaculty.name,
            empId: newFaculty.empId,
            phone: newFaculty.phone,
            rfidUid: newFaculty.rfidUid,
            email: newFaculty.user.email,
            userId: newFaculty.user.id,
        };
    } catch (error) {
        console.error('Error creating faculty:', error);
        // Handle foreign key errors specifically if user/faculty are not created correctly
        throw createError(500, 'Failed to create faculty due to a database error.');
    }
}

/**
 * Retrieves all faculty members with their associated user accounts.
 * @returns {Promise<Array<object>>} List of faculty members.
 */
async function getAllFacultyMembers() {
    return prisma.faculty.findMany({
        include: {
            user: { select: { id: true, email: true, role: true } },
        },
        orderBy: { name: 'asc' },
    });
}

/**
 * Updates an existing faculty member's details and/or their associated user account (email/password/role).
 * @param {number} facultyId - The ID of the faculty member to update.
 * @param {object} data - { email, password, name, empId, phone, rfidUid, role }
 * @returns {Promise<object>} Updated faculty data.
 */
async function updateFaculty(facultyId, data) {
    const { email, password, name, empId, phone, rfidUid, role } = data;

    const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
    if (!faculty) {
        throw createError(404, 'Faculty member not found.');
    }

    // Check for uniqueness violations on update
    if (email) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser && existingUser.id !== faculty.userId) {
            throw createError(409, 'Another user with this email already exists.');
        }
    }
    if (empId) {
        const existingEmpId = await prisma.faculty.findUnique({ where: { empId } });
        if (existingEmpId && existingEmpId.id !== faculty.id) {
            throw createError(409, 'Another faculty with this Employee ID already exists.');
        }
    }
    if (rfidUid) {
        const existingRfid = await prisma.faculty.findUnique({ where: { rfidUid } });
        if (existingRfid && existingRfid.id !== faculty.id) {
            throw createError(409, 'Another faculty with this RFID UID already exists.');
        }
    }

    let hashedPassword;
    if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
    }

    try {
        const updatedFaculty = await prisma.$transaction(async (tx) => {
            // Update User details
            await tx.user.update({
                where: { id: faculty.userId },
                data: {
                    email: email || undefined, // Only update if provided
                    passwordHash: hashedPassword || undefined,
                    role: role || undefined, // Only update if provided
                },
            });

            // Update Faculty details
            return tx.faculty.update({
                where: { id: facultyId },
                data: {
                    name: name || undefined,
                    empId: empId || undefined,
                    phone: phone || undefined,
                    rfidUid: rfidUid || undefined,
                },
                include: { user: true },
            });
        });

        return {
            id: updatedFaculty.id,
            name: updatedFaculty.name,
            empId: updatedFaculty.empId,
            phone: updatedFaculty.phone,
            rfidUid: updatedFaculty.rfidUid,
            email: updatedFaculty.user.email,
            userId: updatedFaculty.user.id,
            role: updatedFaculty.user.role,
        };
    } catch (error) {
        console.error('Error updating faculty:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Faculty member not found.');
        }
        throw createError(500, 'Failed to update faculty due to a database error.');
    }
}

/**
 * Deletes a faculty member and their associated user account.
 * @param {number} facultyId - The ID of the faculty member to delete.
 */
async function deleteFaculty(facultyId) {
    const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
    if (!faculty) {
        throw createError(404, 'Faculty member not found.');
    }

    try {
        // Delete in a transaction: first faculty, then user
        await prisma.$transaction(async (tx) => {
            await tx.faculty.delete({ where: { id: facultyId } });
            await tx.user.delete({ where: { id: faculty.userId } });
        });
    } catch (error) {
        console.error('Error deleting faculty:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Faculty member not found.');
        }
        throw createError(500, 'Failed to delete faculty due to a database error.');
    }
}

/**
 * Assigns a faculty member to a specific SubjectInstance (linking subject, section, faculty).
 * This can be used for assigning a teacher to teach a specific class.
 * @param {number} subjectInstanceId - The ID of the SubjectInstance.
 * @param {number} facultyId - The ID of the faculty to assign.
 * @returns {Promise<object>} The updated SubjectInstance.
 */
async function assignFacultyToSubjectInstance(subjectInstanceId, facultyId) {
    const subjectInstance = await prisma.subjectInstance.findUnique({
        where: { id: subjectInstanceId }
    });
    if (!subjectInstance) {
        throw createError(404, 'Subject instance not found.');
    }
    // Check if faculty exists (optional, Prisma will handle FK)
    // const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
    // if (!faculty) throw createError(404, 'Faculty not found.');

    try {
        const updatedSubjectInstance = await prisma.subjectInstance.update({
            where: { id: subjectInstanceId },
            data: { faculty: { connect: { id: facultyId } } },
        });
        return updatedSubjectInstance;
    } catch (error) {
        console.error('Error assigning faculty to subject instance:', error);
        if (error.code === 'P2003') { // Foreign key constraint violation
            throw createError(400, 'Invalid facultyId provided.');
        }
        throw createError(500, 'Failed to assign faculty to subject instance due to database error.');
    }
}

export {
    createFaculty,
    getAllFacultyMembers,
    updateFaculty,
    deleteFaculty,
    assignFacultyToSubjectInstance,
};