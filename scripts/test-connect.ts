import { connectInstagramAccount } from "../actions/instagram"
import { db } from "../lib/prisma"

async function main() {
  try {
    // Get first user and workspace
    const user = await db.user.findFirst({
      include: { teamMembers: true }
    })
    
    if (!user || user.teamMembers.length === 0) {
      console.log("No users/workspaces found. Please create an account first.")
      return
    }
    
    const workspaceId = user.teamMembers[0].workspaceId
    console.log(`Connecting mock Instagram to workspace: ${workspaceId}`)
    
    const result = await connectInstagramAccount(workspaceId, "mock_token", "mock_fb_page_id")
    console.log("Result:", result)
    
    if (result.error) {
      console.error("Failed to connect:", result.error)
    } else {
      console.log("Mock Instagram connected successfully!")
    }
  } catch (error) {
    console.error("Exception:", error)
  } finally {
    await db.$disconnect()
  }
}

main()
