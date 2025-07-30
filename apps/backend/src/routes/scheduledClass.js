// rfid-attendance-system/apps/backend/src/routes/scheduledClass.js
import express from 'express';
import createError from 'http-errors';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';
import {
    createScheduledClass,
    getAllScheduledClasses,
    updateScheduledClass,
    deleteScheduledClass,
    getAllSubjects,
    getAllSections,
    getAllFaculty,
} from '../services/scheduledClassService.js'; // Ensure this service file exists and is correct

const router = express.Router();

// Middleware for Admin/PCOORD access to all scheduled class routes
router.use(authenticateToken, authorizeRoles(['ADMIN', 'PCOORD', 'TEACHER']));

/**
 * @route POST /api/scheduled-classes
 * @desc Create a new scheduled class.
 * @access Private (ADMIN, PCOORD)
 */
router.post('/', async (req, res, next) => {
    try {
        const newClass = await createScheduledClass(req.body);
        res.status(201).json({ message: 'Scheduled class created successfully.', class: newClass });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/scheduled-classes
 * @desc Get all scheduled classes.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/', async (req, res, next) => {
    try {
        const classes = await getAllScheduledClasses();
        res.status(200).json(classes);
    } catch (error) {
        next(error);
    }
});

/**
 * @route PUT /api/scheduled-classes/:id
 * @desc Update an existing scheduled class.
 * @access Private (ADMIN, PCOORD)
 */
router.put('/:id', async (req, res, next) => {
    const classId = parseInt(req.params.id);
    if (isNaN(classId)) {
        return next(createError(400, 'Invalid class ID.'));
    }
    try {
        const updatedClass = await updateScheduledClass(classId, req.body);
        res.status(200).json({ message: 'Scheduled class updated successfully.', class: updatedClass });
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/scheduled-classes/:id
 * @desc Delete a scheduled class.
 * @access Private (ADMIN, PCOORD)
 */
router.delete('/:id', async (req, res, next) => {
    const classId = parseInt(req.params.id);
    if (isNaN(classId)) {
        return next(createError(400, 'Invalid class ID.'));
    }
    try {
        await deleteScheduledClass(classId);
        res.status(204).send(); // No content on successful delete
    } catch (error) {
        next(error);
    }
});

// --- Helper Endpoints for Dropdowns ---
/**
 * @route GET /api/scheduled-classes/helpers/subjects
 * @desc Get all subjects for dropdowns.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/helpers/subjects', async (req, res, next) => {
    try {
        const subjects = await getAllSubjects();
        res.status(200).json(subjects);
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/scheduled-classes/helpers/sections
 * @desc Get all sections for dropdowns.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/helpers/sections', async (req, res, next) => {
    try {
        const sections = await getAllSections();
        res.status(200).json(sections);
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/scheduled-classes/helpers/faculty
 * @desc Get all faculty for dropdowns.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/helpers/faculty', async (req, res, next) => {
    try {
        const faculty = await getAllFaculty();
        res.status(200).json(faculty);
    } catch (error) {
        next(error);
    }
});

export default router;