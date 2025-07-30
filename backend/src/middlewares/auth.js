import createError from 'http-errors';
import { verifyToken } from '../utils/jwt.js';

const authenticateToken = (req, res, next) => {
    console.log('Auth Middleware: Started'); // DEBUG LOG 1

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Auth Middleware: Token received:', token ? 'Yes' : 'No'); // DEBUG LOG 2

    if (!token) {
        console.log('Auth Middleware: No token, sending 401'); // DEBUG LOG 3
        return next(createError(401, 'Access Token Required'));
    }

    const decoded = verifyToken(token);
    console.log('Auth Middleware: Token decoded result:', decoded ? 'Success' : 'Failed'); // DEBUG LOG 4

    if (!decoded) {
        console.log('Auth Middleware: Invalid token, sending 403'); // DEBUG LOG 5
        return next(createError(403, 'Invalid or Expired Token'));
    }

    req.user = decoded;
    console.log('Auth Middleware: Token valid, user:', req.user.email, 'Role:', req.user.role); // DEBUG LOG 6
    next(); // This must be called for the request to proceed
    console.log('Auth Middleware: Called next()'); // DEBUG LOG 7
};


/**
 * Middleware to check if the authenticated user has one of the required roles.
 * @param {Array<string>} allowedRoles - An array of roles (e.g., ['ADMIN', 'TEACHER']).
 */
const authorizeRoles = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return next(createError(403, 'User role not found or not authenticated'));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(createError(403, 'Forbidden: Insufficient permissions'));
        }
        next();
    };
};

export { authenticateToken, authorizeRoles };