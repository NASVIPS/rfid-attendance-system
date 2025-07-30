// rfid-attendance-system/apps/backend/src/routes/device.js
import { Router } from 'express';
import * as deviceService from '../services/deviceService.js';
import createError from 'http-errors';
import authenticateDevice from '../middlewares/deviceAuth.js'; // Import device authentication middleware (default export)
import WebSocket from 'ws'; // Import WebSocket

const router = Router();

// Endpoint for devices to send periodic heartbeats (device-authenticated)
router.post('/heartbeat', authenticateDevice, async (req, res, next) => {
  try {
    const { macAddr } = req.device; // Using macAddr as per your schema
    const updatedDevice = await deviceService.recordDeviceHeartbeat(macAddr);
    res.json({ message: 'Heartbeat recorded successfully', device: updatedDevice });
  } catch (error) {
    next(error);
  }
});

// Endpoint for admin to register a new RFID device (admin-authenticated)
router.post('/register', async (req, res, next) => { // Assuming this route is protected by admin auth middleware elsewhere
  try {
    const newDevice = await deviceService.registerDevice(req.body);
    res.status(201).json({ message: 'Device registered successfully', device: newDevice });
  } catch (error) {
    next(error);
  }
});

// Endpoint to get all registered devices (admin-authenticated)
router.get('/all', async (req, res, next) => { // Assuming this route is protected by admin auth middleware elsewhere
  try {
    const devices = await deviceService.getAllDevices();
    res.json(devices);
  } catch (error) {
    next(error);
  }
});

// NEW ROUTE: Teacher authenticates the device with their RFID
// This route will be called by the ESP32 after a teacher scans their card.
router.post('/authenticate-teacher', async (req, res, next) => {
  try {
    const { deviceMacAddress, teacherRfidUid } = req.body;

    if (!deviceMacAddress || !teacherRfidUid) {
      throw createError(400, 'Device MAC address and teacher RFID UID are required.');
    }

    // Call the simplified service function - it only verifies, doesn't update device DB record
    const result = await deviceService.authenticateDeviceByTeacherRfid(deviceMacAddress, teacherRfidUid);

    // Get the WebSocket server instance from app.locals (assuming app.js sets it up)
    const wss = req.app.locals.wss;

    if (wss && wss.clients) {
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          // Send update to all connected clients (especially AttendanceBoard)
          client.send(JSON.stringify({
            type: 'DEVICE_AUTH_STATUS_UPDATE',
            deviceMacAddress: deviceMacAddress,
            isAuth: true, // Device is now authenticated locally on ESP32
            authenticatedBy: result.teacher.name, // Name of the teacher who authenticated it
            authenticatedTeacherId: result.teacher.id, // ID of the teacher (for ESP32 to query session)
            message: result.message
          }));
        }
      });
    }

    res.json({ message: result.message, teacher: result.teacher });
  } catch (error) {
    next(error);
  }
});

export default router;
