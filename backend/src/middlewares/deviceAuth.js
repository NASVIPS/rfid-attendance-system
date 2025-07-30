// rfid-attendance-system/apps/backend/src/middlewares/deviceAuth.js
import createError from 'http-errors';
import prisma from '../services/prisma.js'; // Ensure prisma is imported

/**
 * Middleware to authenticate RFID devices using MAC address and secret from headers.
 * Attaches device details to req.device if authenticated.
 */
async function authenticateDevice(req, res, next) {
  const macAddress = req.headers['x-device-mac'];
  const secret = req.headers['x-device-secret'];

  if (!macAddress || !secret) {
    return next(createError(401, 'Device authentication headers (x-device-mac, x-device-secret) are missing.'));
  }

  try {
    const device = await prisma.device.findUnique({
      where: { macAddr: macAddress }, // Using macAddr as per your schema
    });

    if (!device || device.secret !== secret) {
      return next(createError(401, 'Invalid device credentials.'));
    }

    req.device = device; // Attach device object to the request
    next();
  } catch (error) {
    console.error('Device authentication error:', error);
    next(createError(500, 'Failed to authenticate device.'));
  }
}

export default authenticateDevice; // Export as default
