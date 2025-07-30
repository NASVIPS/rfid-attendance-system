// rfid-attendance-system/apps/backend/src/routes/semesterSubject.js
import express from 'express';
import createError from 'http-errors';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';
import {
    createSemesterSubject,
    getAllSemesterSubjects,
    deleteSemesterSubject,
} from '../services/semesterSubjectService.js';

const router = express.Router();

// All SemesterSubject management routes require ADMIN or PCOORD roles
router.use(authenticateToken, authorizeRoles(['ADMIN', 'PCOORD']));

/**
 * @route POST /api/semester-subject
 * @desc Create a new SemesterSubject association.
 * @access Private (ADMIN, PCOORD)
 */
router.post('/', async (req, res, next) => {
    try {
        const newAssociation = await createSemesterSubject(req.body);
        res.status(201).json({ message: 'Semester-Subject association created successfully.', association: newAssociation });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/semester-subject
 * @desc Get all SemesterSubject associations with full details.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/', async (req, res, next) => {
    try {
        const associations = await getAllSemesterSubjects();
        res.status(200).json(associations);
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/semester-subject/:associationId
 * @desc Delete a SemesterSubject association.
 * @access Private (ADMIN, PCOORD)
 */
router.delete('/:associationId', async (req, res, next) => {
    const associationId = parseInt(req.params.associationId);
    if (isNaN(associationId)) {
        return next(createError(400, 'Invalid Semester-Subject association ID.'));
    }
    try {
        await deleteSemesterSubject(associationId);
        res.status(204).send(); // No content on successful delete
    } catch (error) {
        next(error);
    }
});

export default router;