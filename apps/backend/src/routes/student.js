// rfid-attendance-system/apps/backend/src/routes/student.js
import express from 'express';
import createError from 'http-errors';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';
import {
    createStudent,
    getAllStudents,
    updateStudent,
    deleteStudent,
} from '../services/studentService.js';
// CRITICAL: Correct import for getAllSections from scheduledClassService.js
import { getAllSections } from '../services/scheduledClassService.js';

const router = express.Router();

// All student management routes require ADMIN or PCOORD roles
router.use(authenticateToken, authorizeRoles(['ADMIN', 'PCOORD']));

/**
 * @route POST /api/student
 * @desc Create a new student.
 * @access Private (ADMIN, PCOORD)
 */
router.post('/', async (req, res, next) => {
    try {
        const newStudent = await createStudent(req.body);
        res.status(201).json({ message: 'Student created successfully.', student: newStudent });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/student
 * @desc Get all students with section details.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/', async (req, res, next) => {
    try {
        const students = await getAllStudents();
        res.status(200).json(students);
    } catch (error) {
        next(error);
    }
});

/**
 * @route PUT /api/student/:studentId
 * @desc Update an existing student.
 * @access Private (ADMIN, PCOORD)
 */
router.put('/:studentId', async (req, res, next) => {
    const studentId = parseInt(req.params.studentId);
    if (isNaN(studentId)) {
        return next(createError(400, 'Invalid student ID.'));
    }
    try {
        const updatedStudent = await updateStudent(studentId, req.body);
        res.status(200).json({ message: 'Student updated successfully.', student: updatedStudent });
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/student/:studentId
 * @desc Delete a student.
 * @access Private (ADMIN, PCOORD)
 */
router.delete('/:studentId', async (req, res, next) => {
    const studentId = parseInt(req.params.studentId);
    if (isNaN(studentId)) {
        return next(createError(400, 'Invalid student ID.'));
    }
    try {
        await deleteStudent(studentId);
        res.status(204).send(); // No content on successful delete
    } catch (error) {
        next(error);
    }
});

// --- Helper Endpoint for Sections ---
/**
 * @route GET /api/student/helpers/sections
 * @desc Get all sections for dropdowns (for student assignment).
 * @access Private (ADMIN, PCOORD)
 */
router.get('/helpers/sections', authenticateToken, authorizeRoles(['ADMIN', 'PCOORD']), async (req, res, next) => {
    try {
        const sections = await getAllSections(); // Call the imported helper
        res.status(200).json(sections);
    } catch (error) {
        console.error('Error fetching sections for student helper:', error);
        next(error);
    }
});

export default router;