import type { Metadata } from "next";
import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { StageSettings } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/components/stage-settings";
import {
  PipelineShell,
  headerUser,
} from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/components/pipeline-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pipeline Settings",
  description: "Telemarketing pipeline settings: stages.",
};

export default async function TelemarketingPipelineSettingsPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
  const payload = token ? decodeJwtPayload(token) : null;

  return (
    <PipelineShell user={headerUser(payload)} crumb="Settings" active="settings">
      <StageSettings />
    </PipelineShell>
  );
}
