import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { db } from "./lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const nextAuthResult = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials)

        if (!parsedCredentials.success) {
          return null
        }

        const { email, password } = parsedCredentials.data

        const user = await db.user.findUnique({
          where: { email },
          include: {
            teamMembers: {
              take: 1, // Get the default/first workspace
            }
          }
        })

        if (!user || !user.password) return null

        const passwordsMatch = await bcrypt.compare(password, user.password)

        if (passwordsMatch) {
          const workspaceRelation = user.teamMembers[0]
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            workspaceId: workspaceRelation?.workspaceId || null,
            role: workspaceRelation?.role || null,
          } as any
        }

        return null
      },
    }),
  ],
  session: { strategy: "jwt" },
})

export const { handlers, signIn, signOut } = nextAuthResult

export const auth = async (...args: any[]) => {
  if (process.env.MOCK_AUTH_SESSION) {
    if (process.env.MOCK_AUTH_SESSION === "null") return null
    try {
      return JSON.parse(process.env.MOCK_AUTH_SESSION)
    } catch {
      return null
    }
  }
  return (nextAuthResult.auth as any)(...args)
}
