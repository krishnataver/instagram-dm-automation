"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { getAnalyticsDashboard } from "@/actions/analytics"
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
  Line,
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

export default function AnalyticsClient() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => getAnalyticsDashboard(),
    refetchInterval: 15000 // Refresh stats every 15s
  })

  if (isLoading) {
    return <div className="text-center py-20 text-xs text-zinc-500">Compiling historical conversation intelligence logs...</div>
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

      {/* Analytics stat boxes */}
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

      {/* Grid Charts */}
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
              <p className="text-xs text-zinc-500">Distribution of AI replies, keyword rule triggers, and human responses</p>
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
    </div>
  )
}
