import { PrismaClient } from '@prisma/client';

// Paste your exact DATABASE_URL from your .env file here
const connectionString = "mongodb+srv://vipsnasmanagement:ySofrciNsEzzuTgu@attendancesystem.z6t5ljs.mongodb.net/AttendanceSystem?retryWrites=true&w=majority&appName=AttendanceSystem";
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionString,
    },
  },
});

async function main() {
  try {
    console.log('Attempting to connect to the database...');
    // This is a simple, reliable command to check the connection
    await prisma.$connect();
    console.log('✅ Success! Database connection is working.');

    console.log('Searching for the user...');
    const user = await prisma.user.findUnique({
      where: {
        email: 'pcoord@vips.edu',
      },
    });

    if (user) {
      console.log('✅ Success! Found user:', user);
    } else {
      console.log('❌ Error: Connected to the database, but user "pcoord@vips.edu" was not found.');
    }

  } catch (e) {
    console.error('❌ Error: Could not connect to the database.');
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();