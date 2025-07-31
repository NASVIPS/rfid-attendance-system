import { PrismaClient } from '@prisma/client'

const prisma = global.prisma || new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Add these configurations for serverless environments
  log: ['error'],
  errorFormat: 'minimal',
})

// Prevent multiple instances in development
if (process.env.NODE_ENV === 'development') global.prisma = prisma

export default prisma
