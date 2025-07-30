// rfid-attendance-system/apps/backend/src/routes/subject.js
import express from 'express';
import createError from 'http-errors';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';
import {
    createSubject,
    getAllSubjects,
    updateSubject,
    deleteSubject,
} from '../services/subjectService.js';

const router = express.Router();

// All subject management routes require ADMIN or PCOORD roles
router.use(authenticateToken, authorizeRoles(['ADMIN', 'PCOORD']));

/**
 * @route POST /api/subject
 * @desc Create a new subject.
 * @access Private (ADMIN, PCOORD)
 */
router.post('/', async (req, res, next) => {
    try {
        const newSubject = await createSubject(req.body);
        res.status(201).json({ message: 'Subject created successfully.', subject: newSubject });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/subject
 * @desc Get all subjects.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/', async (req, res, next) => {
    try {
        const subjects = await getAllSubjects();
        res.status(200).json(subjects);
    } catch (error) {
        next(error);
    }
});

/**
 * @route PUT /api/subject/:subjectId
 * @desc Update an existing subject.
 * @access Private (ADMIN, PCOORD)
 */
router.put('/:subjectId', async (req, res, next) => {
    const subjectId = parseInt(req.params.subjectId);
    if (isNaN(subjectId)) {
        return next(createError(400, 'Invalid subject ID.'));
    }
    try {
        const updatedSubject = await updateSubject(subjectId, req.body);
        res.status(200).json({ message: 'Subject updated successfully.', subject: updatedSubject });
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/subject/:subjectId
 * @desc Delete a subject.
 * @access Private (ADMIN, PCOORD)
 */
router.delete('/:subjectId', async (req, res, next) => {
    const subjectId = parseInt(req.params.subjectId);
    if (isNaN(subjectId)) {
        return next(createError(400, 'Invalid subject ID.'));
    }
    try {
        await deleteSubject(subjectId);
        res.status(204).send(); // No content on successful delete
    } catch (error) {
        next(error);
    }
});

export default router;