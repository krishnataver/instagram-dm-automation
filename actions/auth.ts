"use server"

import { db } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { PlanType, Role } from "@prisma/client"
import crypto from "crypto"

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export async function registerUser(formData: z.infer<typeof registerSchema>) {
  try {
    const validated = registerSchema.safeParse(formData)
    if (!validated.success) {
      return { error: validated.error.issues[0].message }
    }

    const { name, email, password } = validated.data

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return { error: "Email is already registered" }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user, workspace, and association in a transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      })

      // 2. Create Default Workspace
      const workspace = await tx.workspace.create({
        data: {
          name: `${name}'s Workspace`,
        },
      })

      // 3. Create TeamMember Association as OWNER
      await tx.teamMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: Role.OWNER,
        },
      })

      // 4. Create Default AI Assistant Prompt
      await tx.aiPrompt.create({
        data: {
          workspaceId: workspace.id,
          name: "Default Assistant",
          promptText: `You are an AI assistant for ${name}'s business. You are friendly, professional, and here to help customers.
Here is our standard FAQ:
- What is our product? We provide an automated Instagram inbox tool.
- What is our pricing? We have a 7-day Free trial, then Pro at ₹150/month.
- How to contact support? You can ask to talk to a human agent, and we will notify our staff.`,
          tone: "helpful",
          isActive: true,
        },
      })

      // 5. Create 7-Day Free Trial Subscription
      const currentPeriodEnd = new Date()
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 7) // 7-day free trial
      await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          stripeSubscriptionId: `sub_free_${workspace.id}`,
          stripeCustomerId: `cust_free_${workspace.id}`,
          plan: PlanType.FREE,
          status: "trialing",
          currentPeriodEnd,
        },
      })

      return user
    })

    return { success: true, userId: result.id }
  } catch (error: any) {
    console.error("Registration Server Error:", error)
    // Return actual error in dev, generic in prod
    const isDev = process.env.NODE_ENV === "development"
    const msg = isDev
      ? (error?.message || "Unknown error")
      : (error?.code === "P1001" || error?.code === "P1002"
          ? "Database connection failed. Please try again in a moment."
          : error?.code === "P2002"
          ? "This email is already registered."
          : "Something went wrong. Please try again.")
    return { error: msg }
  }
}

const SECRET = process.env.AUTH_SECRET || "super-secret-jwt-signing-key-at-least-32-chars-long"

export async function requestPasswordReset(email: string) {
  try {
    const user = await db.user.findUnique({
      where: { email }
    })

    const isSandbox = process.env.NEXT_PUBLIC_SANDBOX_MODE === "true"

    if (!user) {
      if (isSandbox) {
        return { error: "User not found with this email address." }
      }
      return { success: true } // Vague success for security
    }

    // Generate token
    const expires = Date.now() + 3600000 // 1 hour
    const data = `${email}:${expires}`
    const signature = crypto.createHmac("sha256", SECRET).update(data).digest("hex")
    const token = Buffer.from(`${data}:${signature}`).toString("base64url")

    const resetLink = `/reset-password?token=${token}`

    if (isSandbox) {
      console.log(`[SANDBOX RESET] Password reset link for ${email}: ${resetLink}`)
      return { success: true, resetLink }
    }

    // In production, send email via Resend
    console.log(`[RESET EMAIL PREPARED] Send to: ${email}, Link: ${resetLink}`)
    return { success: true }
  } catch (error) {
    console.error("requestPasswordReset Error:", error)
    return { error: "Something went wrong. Please try again." }
  }
}

export async function resetPassword(token: string, password: string) {
  try {
    if (password.length < 6) {
      return { error: "Password must be at least 6 characters" }
    }

    // Decode token
    let decoded = ""
    try {
      decoded = Buffer.from(token, "base64url").toString("utf8")
    } catch {
      return { error: "Invalid or corrupt reset token" }
    }

    const parts = decoded.split(":")
    if (parts.length !== 3) {
      return { error: "Invalid reset token format" }
    }

    const [email, expiresStr, signature] = parts
    const expires = parseInt(expiresStr, 10)

    if (Date.now() > expires) {
      return { error: "Password reset token has expired" }
    }

    const data = `${email}:${expiresStr}`
    const expectedSignature = crypto.createHmac("sha256", SECRET).update(data).digest("hex")

    const signatureBuffer = Buffer.from(signature)
    const expectedSignatureBuffer = Buffer.from(expectedSignature)

    if (signatureBuffer.length !== expectedSignatureBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
      return { error: "Invalid password reset signature" }
    }

    // Reset password
    const hashedPassword = await bcrypt.hash(password, 10)
    await db.user.update({
      where: { email },
      data: { password: hashedPassword }
    })

    console.log(`- Password reset successfully for: ${email}`)
    return { success: true }
  } catch (error) {
    console.error("resetPassword Error:", error)
    return { error: "Failed to reset password. Please try again." }
  }
}
