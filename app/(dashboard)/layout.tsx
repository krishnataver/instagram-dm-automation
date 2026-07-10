import React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/prisma"
import { 
  MessageCircle, 
  LayoutDashboard, 
  Inbox, 
  Zap, 
  BarChart3, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  User as UserIcon 
} from "lucide-react"
import SignOutButton from "@/components/SignOutButton"
import SandboxSimulator from "@/components/SandboxSimulator"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session || !session.user) {
    redirect("/login")
  }

  const workspaceId = (session as any).user.workspaceId
  const userEmail = session.user.email

  // Fetch workspace details
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      subscriptions: {
        take: 1,
        orderBy: { createdAt: "desc" }
      }
    }
  })

  const plan = workspace?.subscriptions[0]?.plan || "FREE"

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Live Inbox", href: "/inbox", icon: Inbox },
    { name: "Automations", href: "/automations", icon: Zap },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Workspace Settings", href: "/settings", icon: Settings },
  ]

  return (
    <div className="min-h-screen flex bg-[#09090b] text-[#f4f4f5] relative">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0b0b0e] flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Header */}
          <div className="h-16 border-b border-white/5 flex items-center gap-2.5 px-6">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-pink-500 to-indigo-600">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white text-base">InstaSponder</span>
          </div>

          {/* Workspace Info Card */}
          <div className="p-4 mx-3 my-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Active Workspace</div>
            <div className="text-sm font-bold text-white truncate mt-1">{workspace?.name || "Workspace"}</div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[10px] font-bold uppercase tracking-wide mt-2">
              <ShieldCheck className="w-3 h-3" />
              {plan} Tier
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.02] transition-all group"
                >
                  <Icon className="w-4.5 h-4.5 group-hover:text-pink-500 transition-colors" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-white text-sm font-bold border border-white/5">
              {session.user.name ? session.user.name[0].toUpperCase() : <UserIcon className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">{session.user.name || "Agent"}</div>
              <div className="text-xs text-zinc-500 truncate">{userEmail}</div>
            </div>
          </div>

          <SignOutButton />
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>

      {/* Floating diagnostics tools for developer review */}
      <SandboxSimulator />
    </div>
  )
}
