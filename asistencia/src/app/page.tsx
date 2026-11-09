import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";

export default async function Home() {
  const a = await getActor();
  if (!a) redirect("/login");
  if (a.must_change_password) redirect("/cuenta?primer-ingreso=1");
  redirect(a.role === "employee" ? "/mi" : "/admin");
}
