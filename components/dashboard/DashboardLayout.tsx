"use client";

import { useState } from "react";
import type { Icp } from "@/db/schema";
import { deleteIcpAction } from "@/app/actions/icp";
import { Sidebar } from "./Sidebar";
import { IcpChatView } from "./IcpChatView";

interface DashboardLayoutProps {
  user: {
    userId: string;
    name: string;
    email: string;
  };
  initialIcps: Icp[];
}

export function DashboardLayout({ user, initialIcps }: DashboardLayoutProps) {
  const [icps, setIcps] = useState<Icp[]>(initialIcps);
  const [activeIcp, setActiveIcp] = useState<Icp | null>(null);
  const [sessionKey, setSessionKey] = useState<string>("new-icp-session");

  const handleSelectIcp = (icp: Icp) => {
    setActiveIcp(icp);
    setSessionKey(icp.id);
  };

  const handleNewIcp = () => {
    setActiveIcp(null);
    setSessionKey(`new-session-${Date.now()}`);
  };

  const handleIcpUpdated = (updatedIcp: Icp) => {
    setActiveIcp(updatedIcp);
    setIcps((prev) => {
      const exists = prev.some((item) => item.id === updatedIcp.id);
      if (exists) {
        return prev.map((item) =>
          item.id === updatedIcp.id ? updatedIcp : item
        );
      }
      return [updatedIcp, ...prev];
    });
    // Do NOT update sessionKey here to prevent unmounting the active session during generation!
  };

  const handleDeleteIcp = async (icpId: string) => {
    const res = await deleteIcpAction(icpId);
    if (res.success) {
      setIcps((prev) => prev.filter((item) => item.id !== icpId));
      if (activeIcp?.id === icpId) {
        setActiveIcp(null);
      }
    } else {
      console.error("Failed to delete ICP:", res.error);
      alert(res.error || "Failed to delete ICP");
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar
        user={user}
        icps={icps}
        activeIcpId={activeIcp?.id}
        onSelectIcp={handleSelectIcp}
        onNewIcp={handleNewIcp}
        onDeleteIcp={handleDeleteIcp}
      />
      <main className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <IcpChatView
          key={sessionKey}
          initialIcp={activeIcp}
          onIcpUpdated={handleIcpUpdated}
          onNewIcpSession={handleNewIcp}
          onDeleteIcp={handleDeleteIcp}
        />
      </main>
    </div>
  );
}
