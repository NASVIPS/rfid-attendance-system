// rfid-attendance-system/apps/backend/src/routes/scan.js
import express from 'express';
import createError from 'http-errors';
import authenticateDeviceMiddleware from '../middlewares/deviceAuth.js'; // For authenticating devices
import { processRfidScan, getAttendanceSnapshot } from '../services/attendanceService.js';
import { getSessionById } from '../services/sessionService.js'; // To check session status

const router = express.Router();

// Middleware to get WebSocket server instance
router.use((req, res, next) => {
    req.wss = req.app.locals.wss;
    next();
});

/**
 * @route POST /api/scan/rfid
 * @desc Receives RFID UID scans from devices and logs attendance.
 * @access Private (Device-authenticated)
 * Body: { "rfidUid": "YOUR_RFID_UID", "sessionId": 1 }
 */
router.post('/rfid', authenticateDeviceMiddleware, async (req, res, next) => {
    const { rfidUid, sessionId } = req.body;
    const { id: deviceId, macAddr } = req.device; // Authenticated device info, macAddr is the string MAC

    if (!rfidUid || !sessionId) {
        return next(createError(400, 'RFID UID and Session ID are required for scan.'));
    }

    // Basic RFID UID format validation (optional) - assuming simple hex string
    // if (!/^[0-9A-Fa-f]+$/.test(rfidUid)) {
    //     return next(createError(400, 'Invalid RFID UID format.'));
    // }

    try {
        // FIX: Pass macAddr (the string MAC address) as the second argument to processRfidScan
        const attendanceLog = await processRfidScan(rfidUid, macAddr, sessionId);

        // After successful logging, broadcast the updated attendance snapshot via WebSocket
        // Ensure req.app.locals.wss is available and clients exist before broadcasting
        if (req.app.locals.wss && req.app.locals.wss.clients) {
            const updatedSnapshot = await getAttendanceSnapshot(sessionId);
            req.app.locals.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'ATTENDANCE_SNAPSHOT_UPDATE',
                        sessionId: sessionId,
                        data: updatedSnapshot,
                    }));
                }
            });
        }

        res.status(200).json({
            message: 'RFID scan processed and attendance logged successfully.',
            attendance: attendanceLog,
        });
    } catch (error) {
        console.error(`Error processing RFID scan from device ${macAddr} for session ${sessionId}:`, error);
        next(error); // Pass errors to global error handler
    }
});

// Endpoint for RFID enrollment scans (for hardware to send UIDs for student/faculty enrollment)
router.post('/enrollment-rfid', async (req, res, next) => {
    try {
        const { rfidUid } = req.body;
        if (!rfidUid) {
            throw createError(400, 'RFID UID is required for enrollment.');
        }

        const wss = req.app.locals.wss;
        if (wss && wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    // Broadcast the RFID UID for enrollment purposes
                    client.send(JSON.stringify({
                        type: 'RFID_SCANNED_FOR_ENROLLMENT',
                        rfidUid: rfidUid
                    }));
                }
            });
        }

        res.status(200).json({ message: 'RFID UID received for enrollment broadcast.', rfidUid });
    } catch (error) {
        console.error('Error processing enrollment RFID scan:', error);
        next(error);
    }
});


export default router;
