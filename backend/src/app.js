// rfid-attendance-system/apps/backend/src/app.js
import 'dotenv/config';

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import createError from 'http-errors';
import morgan from 'morgan';
import os from 'os'; // FIX: Import 'os' using ES Module syntax at the top of the file
import cors from 'cors'; // Import CORS middleware
// Import our centralized Prisma client
import prisma from './services/prisma.js';

// Import all route modules
import authRoutes from './routes/auth.js';
import deviceRoutes from './routes/device.js';
import sessionRoutes from './routes/session.js';
import scanRoutes from './routes/scan.js';
import attendanceRoutes from './routes/attendance.js';
import scheduledClassRoutes from './routes/scheduledClass.js';
import facultyRoutes from './routes/faculty.js';
import courseRoutes from './routes/course.js';
import subjectRoutes from './routes/subject.js';
import studentRoutes from './routes/student.js';
import reportRoutes from './routes/report.js';
import semesterRoutes from './routes/semester.js'; 
import sectionRoutes from './routes/section.js';
import subjectInstanceRoutes from './routes/subjectInstance.js';
import semesterSubjectRoutes from './routes/semesterSubject.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Middleware Setup ---

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// --- Global Application Variables (passed via app.locals for services/routes) ---
app.locals.prisma = prisma;
app.locals.wss = wss; // Make wss directly available
app.locals.broadcastWebSocket = (data) => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

// NEW: Map to hold WebSocket clients by a unique identifier (e.g., a temporary token)
// This allows us to send a scanned RFID UID to a specific client that requested it for enrollment.
const rfidEnrollmentClients = new Map(); // Map<string, WebSocket> (key could be a temporary token)

wss.on('connection', ws => {
    console.log('WebSocket Client Connected!');

    ws.on('message', message => {
        const parsedMessage = JSON.parse(message);
        console.log(`Received WS message: ${JSON.stringify(parsedMessage)}`);

        if (parsedMessage.type === 'START_RFID_ENROLLMENT' && parsedMessage.token) {
            // Store the WebSocket connection with a unique token from the client
            rfidEnrollmentClients.set(parsedMessage.token, ws);
            console.log(`RFID Enrollment started for token: ${parsedMessage.token}`);
            ws.send(JSON.stringify({ type: 'RFID_ENROLLMENT_READY', message: 'Ready to receive RFID scan.' }));
        } else if (parsedMessage.type === 'STOP_RFID_ENROLLMENT' && parsedMessage.token) {
            rfidEnrollmentClients.delete(parsedMessage.token);
            console.log(`RFID Enrollment stopped and client removed for token: ${parsedMessage.token}`);
        }
        // Handle other message types if needed (e.g., from attendance board)
    });

    ws.on('close', () => {
        console.log('WebSocket Client Disconnected!');
        // Remove client from map on disconnect
        rfidEnrollmentClients.forEach((clientWs, token) => {
            if (clientWs === ws) {
                rfidEnrollmentClients.delete(token);
                console.log(`RFID Enrollment client removed for token: ${token}`);
            }
        });
    });

    ws.on('error', error => {
        console.error('WebSocket Error:', error);
    });
});

// NEW: Function to broadcast RFID UID to a specific enrollment client
app.locals.broadcastRfidToClient = (token, rfidUid) => {
    const clientWs = rfidEnrollmentClients.get(token);
    if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'RFID_SCANNED', rfidUid: rfidUid }));
        console.log(`Broadcasted RFID UID ${rfidUid} to enrollment client with token ${token}`);
        // Optionally remove client after one successful scan if it's a one-time scan
        // rfidEnrollmentClients.delete(token);
    } else {
        console.warn(`No active RFID enrollment client found for token: ${token}`);
    }
};


// --- Routes ---
// Health Check (keep this as is)
app.get('/api/health', async (req, res) => {
    try {
        await app.locals.prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'Backend is healthy', database: 'Connected' });
    } catch (error) {
        console.error('Database Health Check Error:', error);
        res.status(500).json({ status: 'Backend is unhealthy', database: 'Disconnected', error: error.message });
    }
});

// Use our application routes
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/scan', scanRoutes); // This is for attendance scans
app.use('/api/attendance', attendanceRoutes);
app.use('/api/scheduled-classes', scheduledClassRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/course', courseRoutes);
app.use('/api/subject', subjectRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/semester', semesterRoutes);
app.use('/api/section', sectionRoutes);
app.use('/api/subject-instance', subjectInstanceRoutes);
app.use('/api/semester-subject', semesterSubjectRoutes);
// NEW: RFID Scan Endpoint (from hardware for enrollment)
// This endpoint is what your ESP32 hardware will hit when it scans an RFID tag
// during the enrollment process for faculty/students.
// It expects the rfidUid and a 'token' which identifies the frontend client waiting for the scan.
app.post('/api/scan/enrollment-rfid', async (req, res, next) => {
    const { rfidUid, token } = req.body; // Expect RFID UID and the temporary token from the client

    if (!rfidUid || !token) {
        return next(createError(400, 'RFID UID and a client token are required.'));
    }

    try {
        // Broadcast the scanned UID to the specific frontend client that requested enrollment
        app.locals.broadcastRfidToClient(token, rfidUid);
        res.status(200).json({ message: 'RFID UID received and broadcasted for enrollment.' });
    } catch (error) {
        console.error('Error processing enrollment RFID scan:', error);
        next(error);
    }
});


// Catch 404 Not Found errors
app.use((req, res, next) => {
    next(createError(404, `API Endpoint Not Found: ${req.originalUrl}`));
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global Error Handler:', err.stack);
    const status = err.status || 500;
    const message = err.message || 'An unexpected error occurred.';
    res.status(status).json({
        error: {
            status: status,
            message: message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }
    });
});

// --- Start Server ---
const PORT = process.env.PORT || 8000;
// FIX: Listen on '0.0.0.0' to accept connections from all network interfaces
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend Server running on http://0.0.0.0:${PORT}`);
    console.log(`⚡️ WebSocket Server running on ws://0.0.0.0:${PORT}`);
    console.log(`Access from network using: http://${getNetworkIp()}:${PORT}`);
});

// Helper function to get the local network IP address
function getNetworkIp() {
    // 'os' is now imported at the top of the file.
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip over internal (i.e. 127.0.0.1) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost'; // Fallback
}