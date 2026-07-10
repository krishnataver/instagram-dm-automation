import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard") || 
                            nextUrl.pathname.startsWith("/inbox") ||
                            nextUrl.pathname.startsWith("/automations") ||
                            nextUrl.pathname.startsWith("/analytics") ||
                            nextUrl.pathname.startsWith("/settings")

      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false // Redirect unauthenticated users to login page
      } else if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/register")) {
        return Response.redirect(new URL("/dashboard", nextUrl))
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // We will cast user as any to access custom workspace properties later
        token.workspaceId = (user as any).workspaceId
        token.role = (user as any).role
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        (session as any).user.workspaceId = token.workspaceId as string;
        (session as any).user.role = token.role as string;
      }
      return session
    }
  },
  providers: [], // Added in auth.ts
} satisfies NextAuthConfig
