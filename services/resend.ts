import { Resend } from "resend"

export class ResendService {
  private static isSandbox = process.env.NEXT_PUBLIC_SANDBOX_MODE === "true"

  private static getClient() {
    return new Resend(process.env.RESEND_API_KEY || "mock-key")
  }

  /**
   * Dispatches automated email notification to workspaces or users
   */
  static async sendNotificationEmail(to: string, subject: string, htmlContent: string) {
    if (this.isSandbox) {
      console.log(`[SANDBOX RESEND] Dispatching email to: ${to}\nSubject: "${subject}"\nBody: ${htmlContent.substring(0, 100)}...`)
      return { id: "email_mock_" + Math.random().toString(36).substr(2, 9) }
    }

    try {
      const resend = this.getClient()
      const data = await resend.emails.send({
        from: "Instagram Automation <noreply@yourdomain.com>",
        to,
        subject,
        html: htmlContent,
      })
      
      return data
    } catch (error) {
      console.error("Resend Email Dispatched Error:", error)
      throw error
    }
  }

  /**
   * Helper to notify team members about critical system items
   */
  static async sendTeamNotification(emails: string[], subject: string, details: string) {
    const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Workspace Notification</h2>
        <p>${details}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <small style="color: #999;">Automated notification from Instagram DM Manager.</small>
      </div>
    `

    for (const email of emails) {
      await this.sendNotificationEmail(email, subject, htmlContent)
    }
  }
}
