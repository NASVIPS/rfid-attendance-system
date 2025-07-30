// rfid-attendance-system/apps/backend/src/routes/course.js
import express from 'express';
import createError from 'http-errors';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';
import {
    createCourse,
    getAllCourses,
    updateCourse,
    deleteCourse,
    getAllDepartments,
} from '../services/courseService.js';

const router = express.Router();

// All course management routes require ADMIN or PCOORD roles
router.use(authenticateToken, authorizeRoles(['ADMIN', 'PCOORD']));

/**
 * @route POST /api/course
 * @desc Create a new course.
 * @access Private (ADMIN, PCOORD)
 */
router.post('/', async (req, res, next) => {
    try {
        const newCourse = await createCourse(req.body);
        res.status(201).json({ message: 'Course created successfully.', course: newCourse });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/course
 * @desc Get all courses with department details.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/', async (req, res, next) => {
    try {
        const courses = await getAllCourses();
        res.status(200).json(courses);
    } catch (error) {
        next(error);
    }
});

/**
 * @route PUT /api/course/:courseId
 * @desc Update an existing course.
 * @access Private (ADMIN, PCOORD)
 */
router.put('/:courseId', async (req, res, next) => {
    const courseId = parseInt(req.params.courseId);
    if (isNaN(courseId)) {
        return next(createError(400, 'Invalid course ID.'));
    }
    try {
        const updatedCourse = await updateCourse(courseId, req.body);
        res.status(200).json({ message: 'Course updated successfully.', course: updatedCourse });
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/course/:courseId
 * @desc Delete a course.
 * @access Private (ADMIN, PCOORD)
 */
router.delete('/:courseId', async (req, res, next) => {
    const courseId = parseInt(req.params.courseId);
    if (isNaN(courseId)) {
        return next(createError(400, 'Invalid course ID.'));
    }
    try {
        await deleteCourse(courseId);
        res.status(204).send(); // No content on successful delete
    } catch (error) {
        next(error);
    }
});

// --- Helper Endpoint for Departments ---
/**
 * @route GET /api/course/helpers/departments
 * @desc Get all departments for dropdowns.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/helpers/departments', async (req, res, next) => {
    try {
        const departments = await getAllDepartments();
        res.status(200).json(departments);
    } catch (error) {
        next(error);
    }
});

export default router;