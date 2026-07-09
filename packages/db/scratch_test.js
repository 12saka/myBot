const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Connecting to database...");
    const user = await prisma.user.findUnique({
      where: { email: "sakatimoz7@gmail.com" },
      include: {
        profile: true,
        subscription: true,
        otpRequests: true,
        sessions: true,
        auditLogs: true
      }
    });
    console.log("User Sakatimoz7:", JSON.stringify(user, null, 2));
  } catch (error) {
    console.error("Database connection failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
