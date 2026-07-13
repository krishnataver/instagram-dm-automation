const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function test() {
  try {
    const count = await db.user.count()
    console.log('DB Connected OK! Users count:', count)
  } catch (e) {
    console.error('DB ERROR:', e.message)
  } finally {
    await db.$disconnect()
  }
}

test()
