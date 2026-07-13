const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Attempting to connect to Neon PostgreSQL...");
    const usersCount = await prisma.user.count();
    console.log("Connection successful! Users count in Neon:", usersCount);
  } catch (error) {
    console.error("Failed to connect to Neon database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
