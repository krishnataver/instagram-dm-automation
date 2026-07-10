import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

export default NextAuth(authConfig).auth

export const config = {
  // Protected pages matcher, excluding static files and API routes (except if dashboard APIs need protection, we can secure them directly in the API handlers)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png$).*)"],
}
