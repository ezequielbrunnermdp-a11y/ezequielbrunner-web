import { cookies } from "next/headers";
import { terminalFromToken, TERMINAL_COOKIE } from "@/lib/terminals";
import { PairForm, TerminalScreen } from "./client";

export const metadata = { title: "Terminal" };
export const dynamic = "force-dynamic";

export default async function TerminalPage() {
  const t = await terminalFromToken((await cookies()).get(TERMINAL_COOKIE)?.value);
  if (!t) return <PairForm />;
  return <TerminalScreen branch={t.branch_name} company={t.company_name} kiosk={t.allow_kiosk_punch} tz={t.timezone} />;
}
