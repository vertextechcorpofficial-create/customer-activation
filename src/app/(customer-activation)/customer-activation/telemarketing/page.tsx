import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The subsystem root now lives at the pipeline board — keep the old address working. */
export default function TelemarketingPage() {
  redirect("/customer-activation/telemarketing/telemarketing-pipeline");
}
