import React from "react"
import { getTeamMembers } from "@/actions/conversations"
import InboxClient from "@/components/InboxClient"

export const dynamic = "force-dynamic"


export default async function InboxPage() {
  // Fetch workspace team members on the server
  const teamMembers = await getTeamMembers()

  return <InboxClient teamMembers={teamMembers} />
}
