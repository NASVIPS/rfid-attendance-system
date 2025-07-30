// rfid-attendance-system/apps/backend/src/routes/faculty.js
import express from 'express';
import createError from 'http-errors';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';
import {
    createFaculty,
    getAllFacultyMembers,
    updateFaculty,
    deleteFaculty,
    assignFacultyToSubjectInstance,
} from '../services/facultyService.js';

const router = express.Router();

// All faculty management routes require ADMIN or PCOORD roles
router.use(authenticateToken, authorizeRoles(['ADMIN', 'PCOORD']));

/**
 * @route POST /api/faculty
 * @desc Create a new faculty member (and associated user account).
 * @access Private (ADMIN, PCOORD)
 */
router.post('/', async (req, res, next) => {
    try {
        const newFaculty = await createFaculty(req.body);
        res.status(201).json({ message: 'Faculty member created successfully.', faculty: newFaculty });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/faculty
 * @desc Get all faculty members with user details.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/', async (req, res, next) => {
    try {
        const facultyMembers = await getAllFacultyMembers();
        res.status(200).json(facultyMembers);
    } catch (error) {
        next(error);
    }
});

/**
 * @route PUT /api/faculty/:facultyId
 * @desc Update an existing faculty member's details.
 * @access Private (ADMIN, PCOORD)
 */
router.put('/:facultyId', async (req, res, next) => {
    const facultyId = parseInt(req.params.facultyId);
    if (isNaN(facultyId)) {
        return next(createError(400, 'Invalid faculty ID.'));
    }
    try {
        const updatedFaculty = await updateFaculty(facultyId, req.body);
        res.status(200).json({ message: 'Faculty member updated successfully.', faculty: updatedFaculty });
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/faculty/:facultyId
 * @desc Delete a faculty member (and their associated user account).
 * @access Private (ADMIN, PCOORD)
 */
router.delete('/:facultyId', async (req, res, next) => {
    const facultyId = parseInt(req.params.facultyId);
    if (isNaN(facultyId)) {
        return next(createError(400, 'Invalid faculty ID.'));
    }
    try {
        await deleteFaculty(facultyId);
        res.status(204).send(); // No content on successful delete
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/faculty/assign-subject-instance
 * @desc Assign a faculty member to a specific SubjectInstance.
 * @access Private (ADMIN, PCOORD)
 * Body: { "subjectInstanceId": number, "facultyId": number }
 */
router.post('/assign-subject-instance', async (req, res, next) => {
    const { subjectInstanceId, facultyId } = req.body;
    if (!subjectInstanceId || !facultyId) {
        return next(createError(400, 'SubjectInstance ID and Faculty ID are required.'));
    }
    try {
        const updatedSubjectInstance = await assignFacultyToSubjectInstance(subjectInstanceId, facultyId);
        res.status(200).json({ message: 'Faculty assigned to subject instance successfully.', assignment: updatedSubjectInstance });
    } catch (error) {
        next(error);
    }
});

export default router;