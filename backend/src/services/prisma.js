import { PrismaClient } from '@prisma/client'

// FOR DEBUGGING: This line is intentionally simplified to always create a new client
// and bypass any caching.
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'], // Added more logging to see what's happening
})

export default prisma