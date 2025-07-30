// rfid-attendance-system/apps/backend/src/services/sessionService.js
import createError from 'http-errors';
import prisma from './prisma.js'; // Our centralized Prisma client

// Helper to convert "HH:mm" string to minutes from midnight
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Automatically starts a class session for a given faculty member and their subject instance.
 * Infers the subject instance from the faculty's assigned classes or scheduled classes.
 * @param {number} facultyId - The ID of the faculty member starting the session.
 * @param {number} [scheduledClassId] - Optional: The ID of the specific ScheduledClass to start a session for.
 * If not provided, attempts to find the current valid one based on time.
 * @returns {Promise<Object>} The created ClassSession object.
 * @throws {HttpError} If no active/scheduled class is found or session cannot be created.
 */
async function startClassSession(facultyId, scheduledClassId = null) {
    // Find the faculty to ensure they exist and get related info
    const faculty = await prisma.faculty.findUnique({
        where: { id: facultyId },
        include: {
            subjectInstances: { // Include subject instances to potentially use later for validation/display
                include: {
                    subject: true,
                    section: true,
                }
            },
        },
    });

    if (!faculty) {
        throw createError(404, 'Faculty not found.');
    }

    let targetSubjectInstance; // This will hold the SubjectInstance for the session

    if (scheduledClassId) {
        // SCENARIO 1: A specific scheduledClassId is provided (e.g., from a "Start Session" button next to a timetable entry)
        const scheduledClass = await prisma.scheduledClass.findUnique({
            where: { id: scheduledClassId },
            include: { subject: true, section: true, faculty: true } // Include faculty to verify assignment
        });

        if (!scheduledClass) {
            throw createError(404, 'Scheduled class not found.');
        }

        // Verify that the provided scheduledClassId actually belongs to this faculty
        if (scheduledClass.facultyId !== facultyId) {
            throw createError(403, 'Forbidden: This scheduled class is not assigned to you.');
        }

        // Check if the current time is within the scheduled window for this specific class
        const now = new Date();
        const currentDayOfWeek = now.toLocaleString('en-US', { weekday: 'long' }).toUpperCase();
        const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        const GRACE_PERIOD_MINUTES = 15; // Allow starting 15 mins before or after scheduled start

        const currentMinutes = timeToMinutes(currentTime);
        const scheduledStartMinutes = timeToMinutes(scheduledClass.startTime);
        const scheduledEndMinutes = timeToMinutes(scheduledClass.endTime);

        // Define the window for starting the session: 15 mins before start, up to end time + 15 mins
        const windowStart = scheduledStartMinutes - GRACE_PERIOD_MINUTES;
        const windowEnd = scheduledEndMinutes + GRACE_PERIOD_MINUTES;

        // Check if the current day matches AND current time is within the window
        if (currentDayOfWeek !== scheduledClass.dayOfWeek || !(currentMinutes >= windowStart && currentMinutes <= windowEnd)) {
            throw createError(400, `Cannot start session: This class is not scheduled for now. It is scheduled for ${scheduledClass.dayOfWeek} from ${scheduledClass.startTime} to ${scheduledClass.endTime}.`);
        }


        // Now, find the corresponding SubjectInstance for this valid scheduled class
        targetSubjectInstance = await prisma.subjectInstance.findFirst({
            where: {
                subjectId: scheduledClass.subjectId,
                sectionId: scheduledClass.sectionId,
                facultyId: facultyId, // Ensure it's assigned to this faculty
            },
        });

        if (!targetSubjectInstance) {
            // This should ideally not happen if the previous fix for SubjectInstance creation is working
            throw createError(404, 'Corresponding SubjectInstance not found for the scheduled class. Please contact administration.');
        }

    } else {
        // SCENARIO 2: No specific scheduledClassId provided (teacher clicks a generic "Start Session" button)
        // Auto-infer the class based on current day and time
        const now = new Date();
        const currentDayOfWeek = now.toLocaleString('en-US', { weekday: 'long' }).toUpperCase(); // e.g., "MONDAY"
        const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }); // e.g., "10:05" (24-hour format)

        // Find all scheduled classes for this faculty on the current day
        const scheduledClassesToday = await prisma.scheduledClass.findMany({
            where: {
                facultyId: facultyId,
                dayOfWeek: currentDayOfWeek,
            },
            include: { subject: true, section: true }
        });

        const GRACE_PERIOD_MINUTES = 15; // Allow starting 15 mins before or after scheduled start

        let matchingScheduledClass = null;
        for (const sc of scheduledClassesToday) {
            const currentMinutes = timeToMinutes(currentTime);
            const scheduledStartMinutes = timeToMinutes(sc.startTime);
            const scheduledEndMinutes = timeToMinutes(sc.endTime);

            // Define the window for starting the session: 15 mins before start, up to end time + 15 mins
            const windowStart = scheduledStartMinutes - GRACE_PERIOD_MINUTES;
            const windowEnd = scheduledEndMinutes + GRACE_PERIOD_MINUTES;

            // Check if current time is within the grace period of the scheduled start time
            if (currentMinutes >= windowStart && currentMinutes <= windowEnd) {
                matchingScheduledClass = sc;
                break; // Found a matching class, take the first one
            }
        }

        if (!matchingScheduledClass) {
            throw createError(400, `No class scheduled for you at this time (${currentTime} on ${currentDayOfWeek}).`);
        }

        // Now that we found a matching ScheduledClass, find its corresponding SubjectInstance
        targetSubjectInstance = await prisma.subjectInstance.findFirst({
            where: {
                subjectId: matchingScheduledClass.subjectId,
                sectionId: matchingScheduledClass.sectionId,
                facultyId: facultyId,
            },
        });

        if (!targetSubjectInstance) {
            // This should ideally not happen if the previous fix for SubjectInstance creation is working
            throw createError(404, 'Corresponding SubjectInstance not found for the scheduled class. Please contact administration.');
        }
    }


    // Check if there's an already active (unclosed) session for this subject instance
    const existingActiveSession = await prisma.classSession.findFirst({
        where: {
            subjectInstId: targetSubjectInstance.id,
            isClosed: false,
        },
    });

    if (existingActiveSession) {
        throw createError(409, 'An active session for this class is already running.');
    }

    // Create the new session
    const newSession = await prisma.classSession.create({
        data: {
            subjectInstId: targetSubjectInstance.id,
            teacherId: facultyId,
            startAt: new Date(), // Automatic start time
            isClosed: false,
            // deviceId will be set when device sends first scan for this session, or left null
        },
        include: {
            subjectInst: {
                include: {
                    subject: true,
                    section: true
                }
            },
            teacher: {
                select: { name: true }
            }
        }
    });

    return newSession;
}

/**
 * Closes an active class session.
 * @param {number} sessionId - The ID of the session to close.
 * @returns {Promise<Object>} The updated ClassSession object.
 * @throws {HttpError} If session not found or already closed.
 */
async function closeClassSession(sessionId) {
    const session = await prisma.classSession.findUnique({
        where: { id: sessionId },
    });

    if (!session) {
        throw createError(404, 'Session not found.');
    }

    if (session.isClosed) {
        throw createError(409, 'Session is already closed.');
    }

    const updatedSession = await prisma.classSession.update({
        where: { id: sessionId },
        data: {
            endAt: new Date(),
            isClosed: true,
        },
    });

    return updatedSession;
}

/**
 * Get a session by ID.
 * @param {number} sessionId
 * @returns {Promise<Object>} The session object.
 */
async function getSessionById(sessionId) {
    return prisma.classSession.findUnique({
        where: { id: sessionId },
        include: {
            subjectInst: {
                include: {
                    subject: true,
                    section: true,
                    faculty: true
                }
            },
            teacher: true,
            device: true,
            logs: true
        }
    });
}

/**
 * Get active sessions (not closed).
 * @returns {Promise<Array<Object>>} List of active sessions.
 */
async function getActiveSessions() {
    return prisma.classSession.findMany({
        where: {
            isClosed: false
        },
        include: {
            subjectInst: {
                include: {
                    subject: true,
                    section: true,
                    faculty: true
                }
            },
            teacher: true
        }
    });
}

/**
 * Retrieves the currently active (unclosed) class session for a specific teacher.
 * There should ideally be only one active session per teacher at a time.
 * @param {number} teacherId - The ID of the teacher.
 * @returns {Promise<Object|null>} The active ClassSession object, or null if no active session.
 */
async function getActiveSessionByTeacherId(teacherId) {
    return prisma.classSession.findFirst({
        where: {
            teacherId: teacherId,
            isClosed: false,
        },
        include: {
            subjectInst: {
                include: {
                    subject: true,
                    section: true,
                }
            },
            teacher: {
                select: { id: true, name: true, empId: true }
            }
        },
        orderBy: { startAt: 'desc' } // In case multiple are somehow active, get the latest
    });
}


/**
 * Gets all subject instances assigned to a specific faculty member.
 * Includes relevant scheduled classes for the current day for each instance.
 * @param {number} facultyId - The ID of the faculty member.
 * @returns {Promise<Array<Object>>} List of subject instances assigned to the faculty,
 * each with an array of relevant scheduled classes for today.
 */
async function getTeacherSubjectInstances(facultyId) {
    const now = new Date();
    const currentDayOfWeek = now.toLocaleString('en-US', { weekday: 'long' }).toUpperCase();

    // Fetch ALL SubjectInstances assigned to this faculty
    const subjectInstances = await prisma.subjectInstance.findMany({
        where: { facultyId: facultyId },
        include: {
            subject: true,
            section: true,
            classSessions: {
                where: { isClosed: false },
                select: { id: true, startAt: true, teacherId: true }
            }
        },
        orderBy: {
            subject: { name: 'asc' }
        }
    });

    // For each subject instance, find its scheduled classes for the current day
    const instancesWithScheduledClasses = await Promise.all(subjectInstances.map(async (instance) => {
        const scheduledClasses = await prisma.scheduledClass.findMany({
            where: {
                subjectId: instance.subjectId,
                sectionId: instance.sectionId,
                facultyId: instance.facultyId, // Ensure it's this faculty's scheduled class
                dayOfWeek: currentDayOfWeek,
            },
            orderBy: { startTime: 'asc' }
        });
        return {
            ...instance,
            scheduledClassesToday: scheduledClasses // Attach scheduled classes for today
        };
    }));

    return instancesWithScheduledClasses;
}
export {
    startClassSession,
    closeClassSession,
    getSessionById,
    getActiveSessions,
    getTeacherSubjectInstances,
    getActiveSessionByTeacherId // Export the new function
};
