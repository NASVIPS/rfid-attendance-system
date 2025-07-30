// rfid-attendance-system/apps/backend/src/utils/jwt.js
// REMOVED: import dotenv from 'dotenv'; dotenv.config({ path: './.env' });
import jwt from 'jsonwebtoken';

const ACCESS_EXP = process.env.JWT_EXP || '1h';
const REFRESH_EXP = process.env.REFRESH_JWT_EXP || '7d';

/**
 * Generates an access token and a refresh token for a user.
 * @param {object} payload - The payload to sign into the tokens.
 * @returns {object} { accessToken, refreshToken }
 */
export function generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXP });
}

export function generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: REFRESH_EXP });
}

/**
 * Verifies a JWT token.
 * @param {string} token - The JWT token to verify.
 * @returns {object|null} The decoded payload if valid, otherwise null.
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null; // Token is invalid or expired
    }
}

// You can keep decodeJwt from your old code if needed for frontend, but it's not used in backend
/*
export function decodeJwt(token) {
  try {
    return jwt.decode(token);
  } catch (e) {
    return null;
  }
}
*/