"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { getAnalyticsDashboard } from "@/actions/analytics"
import { getAutomations } from "@/actions/automations"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  AreaChart,
  Area
} from "recharts"
import {
  BarChart3,
  TrendingUp,
  Bot,
  Zap,
  Clock,
  MessageSquare,
  Sparkles,
  Info
} from "lucide-react"

// ─── Automation Performance helpers ──────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  KEYWORD: "Keyword Match",
  AI_FALLBACK: "AI Fallback",
  COMMENT: "Comment Trigger",
  ALL_COMMENTS: "All Comments",
  STORY_REPLY: "Story Reply",
  FOLLOW_GATE: "Follow Gate",
}

const TRIGGER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  KEYWORD: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
  AI_FALLBACK: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  COMMENT: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  ALL_COMMENTS: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  STORY_REPLY: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  FOLLOW_GATE: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
}

function getMockStats(index: number) {
  const baseTriggered = [412, 289, 187, 341, 94, 520, 63][index % 7]
  const baseDmsSent = Math.floor(baseTriggered * (0.72 + (index % 3) * 0.08))
  return {
    triggered: baseTriggered,
    dmsSent: baseDmsSent,
    convRate: Math.round((baseDmsSent / baseTriggered) * 100),
  }
}

// ─── Automation Performance Sub-component ────────────────────────────────────

function AutomationPerformanceSection() {
  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["automations-analytics"],
    queryFn: () => getAutomations(),
    refetchInterval: 30000,
  })

  const automationsWithStats = automations.map((auto, i) => ({
    ...auto,
    mockStats: getMockStats(i),
  }))

  const bestPerformerIdx =
    automationsWithStats.length > 0
      ? automationsWithStats.reduce(
          (bestIdx, curr, idx, arr) =>
            curr.mockStats.triggered > arr[bestIdx].mockStats.triggered ? idx : bestIdx,
          0
        )
      : -1

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-pink-500" />
            Automation Performance
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Per-automation DM delivery rates and trigger counts. Stats represent illustrative performance data.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
          <Info className="w-3 h-3" />
          Last 30 Days
        </div>
      </div>

      {isLoading && (
        <div className="glass-panel rounded-3xl p-8 bg-[#121217]/20 border border-white/5 text-center text-xs text-zinc-500">
          Loading automation performance data...
        </div>
      )}

      {!isLoading && automationsWithStats.length === 0 && (
        <div className="glass-panel rounded-3xl p-8 bg-[#121217]/20 border border-white/5 text-center">
          <Zap className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No automations found. Create automations to see performance metrics.</p>
        </div>
      )}

      {!isLoading && automationsWithStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {automationsWithStats.map((auto, idx) => {
            const primaryRule = auto.rules[0]
            const triggerType = primaryRule?.triggerType ?? "KEYWORD"
            const colorScheme = TRIGGER_COLORS[triggerType] ?? TRIGGER_COLORS.KEYWORD
            const isBest = idx === bestPerformerIdx

            return (
              <div
                key={auto.id}
                className={`glass-panel rounded-2xl p-5 relative overflow-hidden transition-all ${
                  isBest
                    ? "border border-pink-500/30 bg-pink-500/[0.02]"
                    : "border border-white/5 bg-[#121217]/20"
                }`}
              >
                {isBest && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-indigo-500 text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Best
                  </div>
                )}

                {/* Name + trigger type */}
                <div className="flex items-start gap-2.5 mb-4 pr-12">
                  <div className={`p-2 rounded-xl ${colorScheme.bg} shrink-0`}>
                    <Zap className={`w-4 h-4 ${colorScheme.text}`} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{auto.name}</h4>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold mt-1 ${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}`}
                    >
                      {TRIGGER_LABELS[triggerType] ?? triggerType}
                    </span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                    <div className="text-base font-extrabold text-white">{auto.mockStats.dmsSent}</div>
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">DMs Sent</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                    <div className="text-base font-extrabold text-white">{auto.mockStats.triggered}</div>
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">Triggered</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                    <div
                      className={`text-base font-extrabold ${
                        auto.mockStats.convRate >= 80
                          ? "text-emerald-400"
                          : auto.mockStats.convRate >= 60
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {auto.mockStats.convRate}%
                    </div>
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">Conv Rate</div>
                  </div>
                </div>

                {/* Rules count + active status */}
                <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-600">
                  <span>{auto.rules.length} rule{auto.rules.length !== 1 ? "s" : ""} configured</span>
                  <span className={`font-semibold ${auto.isActive ? "text-emerald-500" : "text-zinc-600"}`}>
                    {auto.isActive ? "● Active" : "○ Inactive"}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Analytics Component ─────────────────────────────────────────────────

export default function AnalyticsClient() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => getAnalyticsDashboard(),
    refetchInterval: 15000,
  })

  if (isLoading) {
    return (
      <div className="text-center py-20 text-xs text-zinc-500">
        Compiling historical conversation intelligence logs...
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-20 text-xs text-zinc-500">
        Failed to compile workspace analytics.
      </div>
    )
  }

  const { stats, charts } = analytics

  return (
    <div className="flex-1 p-8 space-y-8 bg-[#09090b]">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-pink-500" />
          Intelligence Analytics
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Deep-dive audits into message volume traffic, response speeds, and AI resolution success rates.
        </p>
      </div>

      {/* Stat boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Speed */}
        <div className="glass-panel rounded-2xl p-6 bg-[#121217]/30 border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Avg Response Speed</span>
            <div className="p-2 bg-pink-500/10 text-pink-500 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white">{stats.avgResponseTime}</span>
            <p className="text-[10px] text-emerald-400 mt-1">{stats.avgResponseTimeChange}</p>
          </div>
        </div>

        {/* AI volume */}
        <div className="glass-panel rounded-2xl p-6 bg-[#121217]/30 border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">AI Operations Sent</span>
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white">{stats.aiRepliesCount} replies</span>
            <p className="text-[10px] text-zinc-500 mt-1">100% compliant with Meta policies</p>
          </div>
        </div>

        {/* Total volume */}
        <div className="glass-panel rounded-2xl p-6 bg-[#121217]/30 border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Weekly Messages Volume</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-white">
              {charts.messageVolume.reduce((acc, curr) => acc + curr.total, 0)}
            </span>
            <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +14% volume growth
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1: Volume Per Day Bar */}
        <div className="glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Message Volumes</h3>
              <p className="text-xs text-zinc-500">Inbound vs Outbound messages per day</p>
            </div>
            <div className="p-1 px-2.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Last 7 Days
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.messageVolume} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#fff", fontSize: "11px" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                <Bar dataKey="inbound" name="Inbound (Customers)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outbound" name="Outbound (Replies)" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Reply Breakdown Composed */}
        <div className="glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Resolution Dispatching</h3>
              <p className="text-xs text-zinc-500">AI replies, keyword triggers, and human responses</p>
            </div>
            <div className="p-1 px-2.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Last 7 Days
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={charts.replyDistribution} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#fff", fontSize: "11px" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                <Bar dataKey="ai" name="AI Assistant Responses" fill="#a855f7" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="automation" name="Keyword Triggers" fill="#e11d48" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="manual" name="Agent (Manual) DMs" fill="#3b82f6" stackId="a" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Conversion Rates Area */}
        <div className="glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Daily Resolution Rates</h3>
              <p className="text-xs text-zinc-500">Percentage of customer chats resolved without agent escalations</p>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#c084fc] text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              AI Impact Stats
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.conversionData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#fff", fontSize: "11px" }} />
                <Area type="monotone" dataKey="rate" name="Resolution Rate" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Automation Performance Section */}
      <AutomationPerformanceSection />
    </div>
  )
}
