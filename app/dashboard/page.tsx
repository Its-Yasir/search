import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserIcpsAction } from "@/app/actions/icp";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session || !session.userId) {
    redirect("/login");
  }

  const initialIcps = await getUserIcpsAction();

  return (
    <DashboardLayout
      user={{
        userId: session.userId,
        name: session.name,
        email: session.email,
      }}
      initialIcps={initialIcps}
    />
  );
}
