import React from "react"
import { getAnalyticsDashboard } from "@/actions/analytics"
import { db } from "@/lib/prisma"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

import MessageVolumeChart from "@/components/MessageVolumeChart"
import { 
  Instagram, 
  MessageSquare, 
  Bot, 
  Zap, 
  TrendingUp, 
  Clock, 
  Activity, 
  Sparkles,
  ArrowRightLeft
} from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await auth()
  const workspaceId = (session as any).user?.workspaceId

  // Fetch analytics metrics
  const analytics = await getAnalyticsDashboard()

  // Fetch recent activity logs
  const activityLogs = await db.activityLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      user: {
        select: { name: true, email: true }
      }
    }
  })

  if (!analytics) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-zinc-500">Failed to load workspace analytics.</p>
      </div>
    )
  }

  const { stats, charts } = analytics

  return (
    <div className="flex-1 p-8 space-y-8 bg-[#09090b]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time health, response indicators, and auto-replies for your workspace.
          </p>
        </div>

        {stats.connectedAccounts === 0 && (
          <Link
            href="/settings"
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Instagram className="w-4 h-4" />
            Connect Instagram Account
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* IG Connected */}
        <div className="glass-panel rounded-2xl p-6 bg-[#121217]/40 border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Connected Accounts</span>
            <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-500">
              <Instagram className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white">{stats.connectedAccounts}</span>
            <p className="text-[10px] text-zinc-500 mt-1">
              {stats.connectedAccounts > 0 ? "Linked and active" : "Needs initial connection"}
            </p>
          </div>
        </div>

        {/* Messages Today */}
        <div className="glass-panel rounded-2xl p-6 bg-[#121217]/40 border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Messages Today</span>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white">{stats.messagesToday}</span>
            <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {stats.messagesTodayChange}
            </p>
          </div>
        </div>

        {/* Automated Replies */}
        <div className="glass-panel rounded-2xl p-6 bg-[#121217]/40 border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Auto Replies Sent</span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white">{stats.automatedReplies}</span>
            <p className="text-[10px] text-zinc-500 mt-1">
              Across active triggers & AI agent
            </p>
          </div>
        </div>

        {/* AI Assistant */}
        <div className="glass-panel rounded-2xl p-6 bg-[#121217]/40 border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">AI Assistant</span>
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-500">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white">{stats.aiStatus}</span>
            <p className="text-[10px] text-zinc-500 mt-1">
              {stats.aiRepliesCount} conversations handled this week
            </p>
          </div>
        </div>
      </div>

      {/* Main Charts Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Big Line Chart */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6 bg-[#121217]/30 border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Messaging Traffic</h3>
              <p className="text-xs text-zinc-500">Total conversation events over the last 7 days</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Total</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Inbound</span>
            </div>
          </div>
          <MessageVolumeChart data={charts.messageVolume} />
        </div>

        {/* Response Analytics Breakdown */}
        <div className="glass-panel rounded-3xl p-6 bg-[#121217]/30 border-white/5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Response Breakdown</h3>
            <p className="text-xs text-zinc-500">How customer replies were handled</p>
            
            <div className="space-y-4 mt-6">
              {/* Avg response time */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <Clock className="w-4 h-4 text-pink-500" />
                  <span className="text-xs font-semibold">Avg Response Time</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-white">{stats.avgResponseTime}</span>
                  <div className="text-[9px] text-emerald-400 mt-0.5">{stats.avgResponseTimeChange}</div>
                </div>
              </div>

              {/* Automation Rate */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <Bot className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-semibold">AI Assistant Rate</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {stats.messagesToday > 0 ? `${Math.round((stats.aiRepliesCount / stats.messagesToday) * 100)}%` : "38%"}
                </span>
              </div>

              {/* Keyword Rate */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <Zap className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold">Keyword Match Rate</span>
                </div>
                <span className="text-sm font-bold text-white">42%</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-tr from-pink-500/10 to-indigo-600/10 border border-pink-500/20 mt-4">
            <span className="text-xs font-bold text-pink-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Pro Feature: Full Analytics
            </span>
            <p className="text-[10px] text-zinc-400 leading-normal mt-1">
              Unlock historical audits, team speed ratings, and custom report exports.
            </p>
          </div>
        </div>
      </div>

      {/* Activity Logs Footer */}
      <div className="glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-indigo-400" />
          <h3 className="text-base font-bold text-white">Recent Workspace Activity</h3>
        </div>

        {activityLogs.length === 0 ? (
          <div className="py-6 text-center text-zinc-600 text-xs">
            No system activity logged yet. Connect Instagram or trigger rules to display logs.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {activityLogs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-1 rounded bg-zinc-800 text-zinc-400">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-200">{log.action.replace(/_/g, " ").toUpperCase()}</p>
                    <p className="text-zinc-500 mt-0.5">{log.details}</p>
                  </div>
                </div>
                <div className="text-zinc-600 shrink-0">
                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
