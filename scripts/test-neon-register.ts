import { registerUser } from "../actions/auth"
import { db } from "../lib/prisma"

async function main() {
  try {
    console.log("Attempting to register a test user on Neon PostgreSQL...")
    const result = await registerUser({
      name: "Test User Neon",
      email: "neon_tester@example.com",
      password: "Password123!"
    })
    
    if (result.error) {
      console.error("Registration failed:", result.error)
    } else {
      console.log("Registration successful! Result:", result)
      
      // Verify in DB
      const user = await db.user.findUnique({
        where: { email: "neon_tester@example.com" }
      })
      console.log("Verified user in Neon DB:", user)
      
      // Clean up
      console.log("Cleaning up test user...")
      await db.user.delete({
        where: { email: "neon_tester@example.com" }
      })
      console.log("Clean up done!")
    }
  } catch (error) {
    console.error("Exception during registration test:", error)
  } finally {
    await db.$disconnect()
  }
}

main()
