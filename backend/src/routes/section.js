// rfid-attendance-system/apps/backend/src/routes/section.js
import express from 'express';
import createError from 'http-errors';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js';
import {
    createSection,
    getAllSections,
    updateSection,
    deleteSection,
} from '../services/sectionService.js';

const router = express.Router();

// All section management routes require ADMIN or PCOORD roles
router.use(authenticateToken, authorizeRoles(['ADMIN', 'PCOORD']));

/**
 * @route POST /api/section
 * @desc Create a new section.
 * @access Private (ADMIN, PCOORD)
 */
router.post('/', async (req, res, next) => {
    try {
        const newSection = await createSection(req.body);
        res.status(201).json({ message: 'Section created successfully.', section: newSection });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/section
 * @desc Get all sections with semester and course details.
 * @access Private (ADMIN, PCOORD)
 */
router.get('/', async (req, res, next) => {
    try {
        const sections = await getAllSections();
        res.status(200).json(sections);
    } catch (error) {
        next(error);
    }
});

/**
 * @route PUT /api/section/:sectionId
 * @desc Update an existing section.
 * @access Private (ADMIN, PCOORD)
 */
router.put('/:sectionId', async (req, res, next) => {
    const sectionId = parseInt(req.params.sectionId);
    if (isNaN(sectionId)) {
        return next(createError(400, 'Invalid section ID.'));
    }
    try {
        const updatedSection = await updateSection(sectionId, req.body);
        res.status(200).json({ message: 'Section updated successfully.', section: updatedSection });
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/section/:sectionId
 * @desc Delete a section.
 * @access Private (ADMIN, PCOORD)
 */
router.delete('/:sectionId', async (req, res, next) => {
    const sectionId = parseInt(req.params.sectionId);
    if (isNaN(sectionId)) {
        return next(createError(400, 'Invalid section ID.'));
    }
    try {
        await deleteSection(sectionId);
        res.status(204).send(); // No content on successful delete
    } catch (error) {
        next(error);
    }
});

export default router;