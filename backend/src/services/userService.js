// rfid-attendance-system/apps/backend/src/services/userService.js
import bcrypt from 'bcryptjs';
import createError from 'http-errors';


import prisma from './prisma.js'; // Our centralized Prisma client

// Helper to find a user by email, including their related Faculty/Student profile
async function findUserByEmail(email) {
    return prisma.user.findUnique({
        where: { email },
        include: {
            facultyProfile: true, // Include faculty profile if it exists
            // studentProfile: true // Future: if you link student directly to User model
        },
    });
}

// User login logic
async function loginUser(email, password) {
    const user = await findUserByEmail(email);

    if (!user) {
        throw createError(401, 'Invalid credentials: User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
        throw createError(401, 'Invalid credentials: Password mismatch');
    }

    // Return a simplified user object for token payload and client
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        facultyId: user.facultyProfile ? user.facultyProfile.id : null, // Include facultyId if user is a faculty
        rfidUid: user.facultyProfile ? user.facultyProfile.rfidUid : null, // Include faculty RFID if user is a faculty
    };
}

// Function to create a new user (e.g., for initial admin setup)
async function createUser(email, password, role) {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
        throw createError(409, 'User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10); // 10 salt rounds

    const newUser = await prisma.user.create({
        data: {
            email,
            passwordHash: hashedPassword,
            role,
        },
    });

    return { id: newUser.id, email: newUser.email, role: newUser.role };
}


export { findUserByEmail, loginUser, createUser };