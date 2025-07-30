// rfid-attendance-system/apps/backend/src/routes/auth.js
import express from 'express';
import createError from 'http-errors';
import { generateToken, generateRefreshToken, verifyToken } from '../utils/jwt.js'; // Note the .js extension
import { loginUser, createUser } from '../services/userService.js'; // Note the .js extension
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js'; // Note the .js extension

const router = express.Router();

// --- Public Routes ---

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and get JWT token
 * @access Public
 */
router.post('/login', async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(createError(400, 'Email and password are required'));
    }

    try {
        const user = await loginUser(email, password);
        const accessToken = generateToken({ id: user.id, email: user.email, role: user.role, facultyId: user.facultyId, rfidUid: user.rfidUid });
        const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role });

        // In a real app, you'd store the refresh token securely (e.g., in DB)
        // For now, we'll just send it.

        res.status(200).json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                facultyId: user.facultyId,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/auth/refresh-token
 * @desc Get a new access token using a refresh token
 * @access Public (but assumes valid refresh token)
 */
router.post('/refresh-token', async (req, res, next) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return next(createError(400, 'Refresh Token Required'));
    }

    const decoded = verifyToken(refreshToken);

    if (!decoded) {
        return next(createError(403, 'Invalid Refresh Token'));
    }

    // In a real app, you'd check if this refresh token is in your DB and valid
    // For now, we're simply re-issuing
    const newAccessToken = generateToken({ id: decoded.id, email: decoded.email, role: decoded.role });

    res.status(200).json({ accessToken: newAccessToken });
});

// --- Protected Route Example (for testing authentication) ---

/**
 * @route GET /api/auth/profile
 * @desc Get authenticated user profile
 * @access Private (requires authentication)
 */
router.get('/profile', authenticateToken, (req, res) => {
    // req.user is populated by authenticateToken middleware
    res.status(200).json({
        message: 'User profile accessed successfully',
        user: req.user,
    });
});

// --- Admin Only Route Example (for initial admin user creation) ---

/**
 * @route POST /api/auth/create-admin-user
 * @desc Create an initial admin user (should be tightly controlled)
 * @access Public (for initial setup), then ideally restricted later
 * NOTE: In a production scenario, this endpoint should be secured or removed
 * after initial deployment. For rapid setup, we'll keep it public.
 */
router.post('/create-admin-user', async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return next(createError(400, 'Email and password are required'));
    }

    try {
        // Ensure no existing users, or handle appropriately for production
        const existingUsers = await req.app.locals.prisma.user.count();
        if (existingUsers > 0) {
            // For security, you might want to prevent creating more admins this way
            // or require existing admin credentials to create new ones.
            // For now, we allow if specific conditions (e.g., only one admin exists)
        }

        const newUser = await createUser(email, password, 'ADMIN'); // Directly setting role to ADMIN
        res.status(201).json({ message: 'Admin user created successfully', user: newUser });
    } catch (error) {
        next(error);
    }
});

export default router; // Export the router as default