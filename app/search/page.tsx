import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserIcpsAction } from "@/app/actions/icp";
import { SearchLayout } from "@/components/search/SearchLayout";

export default async function SearchPage() {
  const session = await getSession();

  if (!session || !session.userId) {
    redirect("/login");
  }

  const initialIcps = await getUserIcpsAction();

  return (
    <SearchLayout
      user={{
        userId: session.userId,
        name: session.name,
        email: session.email,
      }}
      initialIcps={initialIcps}
    />
  );
}
