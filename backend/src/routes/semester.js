// rfid-attendance-system/apps/backend/src/routes/semester.js
import express from 'express';
import createError from 'http-errors';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';
import {
    createSemester,
    getAllSemesters,
    updateSemester,
    deleteSemester,
} from '../services/semesterService.js';

const router = express.Router();

// All semester management routes require ADMIN or PCOORD roles
router.use(authenticateToken, authorizeRoles(['ADMIN', 'PCOORD']));

/**
 * @route POST /api/semester
 * @desc Create a new semester.
 * @access Private (ADMIN, PCOORD)
 */
router.post('/', async (req, res, next) => {
    try {
        const newSemester = await createSemester(req.body);
        res.status(201).json({ message: 'Semester created successfully.', semester: newSemester });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/semester
 * @desc Get all semesters with course details.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/', async (req, res, next) => {
    try {
        const semesters = await getAllSemesters();
        res.status(200).json(semesters);
    } catch (error) {
        next(error);
    }
});

/**
 * @route PUT /api/semester/:semesterId
 * @desc Update an existing semester.
 * @access Private (ADMIN, PCOORD)
 */
router.put('/:semesterId', async (req, res, next) => {
    const semesterId = parseInt(req.params.semesterId);
    if (isNaN(semesterId)) {
        return next(createError(400, 'Invalid semester ID.'));
    }
    try {
        const updatedSemester = await updateSemester(semesterId, req.body);
        res.status(200).json({ message: 'Semester updated successfully.', semester: updatedSemester });
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/semester/:semesterId
 * @desc Delete a semester.
 * @access Private (ADMIN, PCOORD)
 */
router.delete('/:semesterId', async (req, res, next) => {
    const semesterId = parseInt(req.params.semesterId);
    if (isNaN(semesterId)) {
        return next(createError(400, 'Invalid semester ID.'));
    }
    try {
        await deleteSemester(semesterId);
        res.status(204).send(); // No content on successful delete
    } catch (error) {
        next(error);
    }
});

export default router;