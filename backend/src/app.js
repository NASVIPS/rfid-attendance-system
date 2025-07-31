// rfid-attendance-system/apps/backend/src/app.js
import 'dotenv/config';

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import createError from 'http-errors';
import morgan from 'morgan';
import os from 'os';

import prisma from './services/prisma.js';

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
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// --- Global Application Variables (passed via app.locals for services/routes) ---
app.locals.prisma = prisma;
app.locals.wss = wss;
app.locals.broadcastWebSocket = (data) => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

const rfidEnrollmentClients = new Map();

wss.on('connection', ws => {
    console.log('WebSocket Client Connected!');

    ws.on('message', message => {
        const parsedMessage = JSON.parse(message);
        console.log(`Received WS message: ${JSON.stringify(parsedMessage)}`);

        if (parsedMessage.type === 'START_RFID_ENROLLMENT' && parsedMessage.token) {
            rfidEnrollmentClients.set(parsedMessage.token, ws);
            console.log(`RFID Enrollment started for token: ${parsedMessage.token}`);
            ws.send(JSON.stringify({ type: 'RFID_ENROLLMENT_READY', message: 'Ready to receive RFID scan.' }));
        } else if (parsedMessage.type === 'STOP_RFID_ENROLLMENT' && parsedMessage.token) {
            rfidEnrollmentClients.delete(parsedMessage.token);
            console.log(`RFID Enrollment stopped and client removed for token: ${parsedMessage.token}`);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket Client Disconnected!');
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

app.locals.broadcastRfidToClient = (token, rfidUid) => {
    const clientWs = rfidEnrollmentClients.get(token);
    if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'RFID_SCANNED', rfidUid: rfidUid }));
        console.log(`Broadcasted RFID UID ${rfidUid} to enrollment client with token ${token}`);
    } else {
        console.warn(`No active RFID enrollment client found for token: ${token}`);
    }
};

// --- Routes ---
// Health Check (remove the /api prefix here as well)
app.get('/health', async (req, res) => {
    try {
        await app.locals.prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'Backend is healthy', database: 'Connected' });
    } catch (error) {
        console.error('Database Health Check Error:', error);
        res.status(500).json({ status: 'Backend is unhealthy', database: 'Disconnected', error: error.message });
    }
});

// Use our application routes
app.use('/auth', authRoutes);
app.use('/device', deviceRoutes);
app.use('/session', sessionRoutes);
app.use('/scan', scanRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/scheduled-classes', scheduledClassRoutes);
app.use('/faculty', facultyRoutes);
app.use('/course', courseRoutes);
app.use('/subject', subjectRoutes);
app.use('/student', studentRoutes);
app.use('/report', reportRoutes);
app.use('/semester', semesterRoutes);
app.use('/section', sectionRoutes);
app.use('/subject-instance', subjectInstanceRoutes);
app.use('/semester-subject', semesterSubjectRoutes);

app.post('/scan/enrollment-rfid', async (req, res, next) => {
    const { rfidUid, token } = req.body;

    if (!rfidUid || !token) {
        return next(createError(400, 'RFID UID and a client token are required.'));
    }

    try {
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

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend Server running on http://0.0.0.0:${PORT}`);
    console.log(`⚡️ WebSocket Server running on ws://0.0.0.0:${PORT}`);
    console.log(`Access from network using: http://${getNetworkIp()}:${PORT}`);
});

function getNetworkIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}