import type { Metadata } from "next";
import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { PoolList } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/components/pool-list";
import {
  PipelineShell,
  headerUser,
} from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/components/pipeline-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pipeline Lead Pool",
  description: "Telemarketing pipeline lead pool: unclaimed leads in non-terminal stages.",
};

export default async function TelemarketingPipelinePoolPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
  const payload = token ? decodeJwtPayload(token) : null;

  return (
    <PipelineShell user={headerUser(payload)} crumb="Pool" active="pool">
      <PoolList />
    </PipelineShell>
  );
}
