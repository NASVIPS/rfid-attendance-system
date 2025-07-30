// rfid-attendance-system/apps/backend/src/services/deviceService.js
import createError from 'http-errors';
import prisma from './prisma.js'; // Our centralized Prisma client

/**
 * Registers a new RFID device.
 * @param {object} deviceData - Data for the new device (macAddress, secret, name, location).
 * @returns {Promise<Object>} The created Device object.
 */
async function registerDevice(deviceData) {
  const { macAddress, secret, name, location } = deviceData;

  if (!macAddress || !secret) {
    throw createError(400, 'MAC address and secret are required for device registration.');
  }

  const existingDevice = await prisma.device.findUnique({
    where: { macAddr: macAddress }, // Using macAddr as per your schema
  });

  if (existingDevice) {
    throw createError(409, 'Device with this MAC address already exists.');
  }

  return prisma.device.create({
    data: {
      macAddr: macAddress, // Using macAddr as per your schema
      secret,
      name,
      location,
    },
  });
}

/**
 * Authenticates a device using its MAC address and secret.
 * @param {string} macAddress - The MAC address of the device.
 * @param {string} secret - The secret key of the device.
 * @returns {Promise<Object>} The authenticated Device object.
 */
async function authenticateDevice(macAddress, secret) {
  const device = await prisma.device.findUnique({
    where: { macAddr: macAddress }, // Using macAddr as per your schema
  });

  if (!device || device.secret !== secret) {
    throw createError(401, 'Invalid device credentials.');
  }

  return device;
}

/**
 * Records a heartbeat for a device, updating its lastBootAt timestamp.
 * @param {string} macAddress - The MAC address of the device.
 * @returns {Promise<Object>} The updated Device object.
 */
async function recordDeviceHeartbeat(macAddress) {
  const device = await prisma.device.findUnique({
    where: { macAddr: macAddress }, // Using macAddr as per your schema
  });

  if (!device) {
    throw createError(404, 'Device not found.');
  }

  return prisma.device.update({
    where: { macAddr: macAddress }, // Using macAddr as per your schema
    data: { lastBootAt: new Date() },
  });
}

/**
 * Retrieves all registered devices.
 * @returns {Promise<Array<Object>>} List of all Device objects.
 */
async function getAllDevices() {
  return prisma.device.findMany();
}

/**
 * Retrieves a single device by its MAC address.
 * @param {string} macAddress - The MAC address of the device.
 * @returns {Promise<Object>} The Device object.
 */
async function getDeviceByMac(macAddress) {
  return prisma.device.findUnique({
    where: { macAddr: macAddress }, // Using macAddr as per your schema
  });
}

// NEW FUNCTION: Authenticate Device by Teacher RFID (Simplified - no DB update to Device)
/**
 * Authenticates an RFID device by a teacher's RFID scan.
 * This function only verifies the teacher's RFID and returns their ID.
 * It does NOT update the Device record in the database.
 * @param {string} deviceMacAddress - The MAC address of the device.
 * @param {string} teacherRfidUid - The RFID UID scanned by the teacher.
 * @returns {Promise<Object>} Object containing teacher info if authenticated.
 */
async function authenticateDeviceByTeacherRfid(deviceMacAddress, teacherRfidUid) {
  if (!deviceMacAddress || !teacherRfidUid) {
    throw createError(400, 'Device MAC address and teacher RFID UID are required.');
  }

  // 1. Verify the device itself exists (optional, but good for error messages)
  const device = await prisma.device.findUnique({
    where: { macAddr: deviceMacAddress }, // Using macAddr as per your schema
  });

  if (!device) {
    throw createError(404, 'Device not found in database.');
  }

  // 2. Find the faculty member with this RFID UID
  const faculty = await prisma.faculty.findFirst({
    where: { rfidUid: teacherRfidUid },
  });

  if (!faculty) {
    throw createError(401, 'Teacher with this RFID not found or not registered.');
  }

  // No update to device.currentTeacherId as per new requirement.
  // The device's authentication status is now purely local to the ESP32.

  return {
    message: `Teacher ${faculty.name} authenticated.`,
    teacher: { id: faculty.id, name: faculty.name, empId: faculty.empId },
  };
}


export {
  registerDevice,
  authenticateDevice,
  recordDeviceHeartbeat,
  getAllDevices,
  getDeviceByMac,
  authenticateDeviceByTeacherRfid, // Export the new function
};
