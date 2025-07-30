// rfid-attendance-system/apps/backend/src/services/studentService.js
import createError from 'http-errors';
import prisma from './prisma.js'; // Our centralized Prisma client

/**
 * Creates a new student.
 * @param {object} data - { name, enrollmentNo, email (optional), phone (optional), rfidUid, sectionId }
 * @returns {Promise<object>} Created student data.
 */
async function createStudent(data) {
    const { name, enrollmentNo, email, phone, rfidUid, sectionId } = data;

    if (!name || !enrollmentNo || !rfidUid || !sectionId) {
        throw createError(400, 'Name, enrollment number, RFID UID, and section ID are required.');
    }

    // Check for uniqueness
    const existingEnrollment = await prisma.student.findUnique({ where: { enrollmentNo } });
    if (existingEnrollment) {
        throw createError(409, 'Student with this enrollment number already exists.');
    }
    const existingRfid = await prisma.student.findUnique({ where: { rfidUid } });
    if (existingRfid) {
        throw createError(409, 'Student with this RFID UID already exists.');
    }

    try {
        const newStudent = await prisma.student.create({
            data: {
                name,
                enrollmentNo,
                // Optional
                phone, // Optional
                rfidUid,
                sectionId: parseInt(sectionId),
            },
            include: { section: true }
        });
        return newStudent;
    } catch (error) {
        console.error('Error creating student:', error);
        if (error.code === 'P2003') { // Foreign key constraint violation
            throw createError(400, 'Invalid sectionId provided.');
        }
        throw createError(500, 'Failed to create student due to a database error.');
    }
}

/**
 * Retrieves all students with their associated section.
 * @returns {Promise<Array<object>>} List of all students.
 */
async function getAllStudents() {
    return prisma.student.findMany({
        include: {
            section: {
                include: {
                    semester: {
                        include: {
                            course: true // CRITICAL: Include course here
                        }
                    }
                }
            }
        },
        orderBy: { name: 'asc' },
    });
}

/**
 * Updates an existing student.
 * @param {number} studentId - The ID of the student to update.
 * @param {object} data - { name, enrollmentNo, email, phone, rfidUid, sectionId }
 * @returns {Promise<object>} Updated student data.
 */
async function updateStudent(studentId, data) {
    const { name, enrollmentNo, email, phone, rfidUid, sectionId } = data;

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
        throw createError(404, 'Student not found.');
    }

    // Check for uniqueness violations on update
    if (enrollmentNo) {
        const existingEnrollment = await prisma.student.findUnique({ where: { enrollmentNo } });
        if (existingEnrollment && existingEnrollment.id !== student.id) {
            throw createError(409, 'Another student with this enrollment number already exists.');
        }
    }
    if (rfidUid) {
        const existingRfid = await prisma.student.findUnique({ where: { rfidUid } });
        if (existingRfid && existingRfid.id !== student.id) {
            throw createError(409, 'Another student with this RFID UID already exists.');
        }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (enrollmentNo) updateData.enrollmentNo = enrollmentNo;
    if (email !== undefined) updateData.email = email; // Allow setting to null/undefined
    if (phone !== undefined) updateData.phone = phone; // Allow setting to null/undefined
    if (rfidUid) updateData.rfidUid = rfidUid;
    if (sectionId) updateData.sectionId = parseInt(sectionId);

    try {
        const updatedStudent = await prisma.student.update({
            where: { id: studentId },
            data: updateData,
            include: { section: true }
        });
        return updatedStudent;
    } catch (error) {
        console.error('Error updating student:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Student not found.');
        }
        if (error.code === 'P2003') { // Foreign key constraint violation
            throw createError(400, 'Invalid sectionId provided for update.');
        }
        throw createError(500, 'Failed to update student due to a database error.');
    }
}

/**
 * Deletes a student.
 * @param {number} studentId - The ID of the student to delete.
 */
async function deleteStudent(studentId) {
    try {
        await prisma.student.delete({ where: { id: studentId } });
    } catch (error) {
        console.error('Error deleting student:', error);
        if (error.code === 'P2025') { // Not found
            throw createError(404, 'Student not found.');
        }
        if (error.code === 'P2003') { // Foreign key constraint violation (e.g., attendance logs linked)
            throw createError(409, 'Cannot delete student: attendance records are linked. Please delete associated data first.');
        }
        throw createError(500, 'Failed to delete student due to a database error.');
    }
}

export {
    createStudent,
    getAllStudents,
    updateStudent,
    deleteStudent,
};