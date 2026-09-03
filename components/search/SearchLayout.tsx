"use client";

import { useState } from "react";
import type { Icp } from "@/db/schema";
import { deleteIcpAction } from "@/app/actions/icp";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SearchPageView } from "./SearchPageView";
import { useRouter } from "next/navigation";

interface SearchLayoutProps {
  user: {
    userId: string;
    name: string;
    email: string;
  };
  initialIcps: Icp[];
}

export function SearchLayout({ user, initialIcps }: SearchLayoutProps) {
  const [icps, setIcps] = useState<Icp[]>(initialIcps);
  const router = useRouter();

  const handleSelectIcp = (icp: Icp) => {
    // Navigate back to dashboard with selected ICP
    router.push(`/dashboard?icp=${icp.id}`);
  };

  const handleNewIcp = () => {
    router.push("/dashboard");
  };

  const handleDeleteIcp = async (icpId: string) => {
    const res = await deleteIcpAction(icpId);
    if (res.success) {
      setIcps((prev) => prev.filter((item) => item.id !== icpId));
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
        onSelectIcp={handleSelectIcp}
        onNewIcp={handleNewIcp}
        onDeleteIcp={handleDeleteIcp}
      />
      <main className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <SearchPageView initialIcps={icps} user={user} />
      </main>
    </div>
  );
}
