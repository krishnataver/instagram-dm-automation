"use client"

import React from "react"
import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 text-sm font-semibold text-zinc-400 transition-all cursor-pointer"
    >
      <LogOut className="w-4 h-4" />
      Sign Out
    </button>
  )
}
