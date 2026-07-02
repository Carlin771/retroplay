import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth";
import { indexChannel } from "@/lib/indexer";
import { createJob, updateJob } from "@/lib/index-jobs";

export const runtime = "nodejs";

const schema = z.object({
  identifier: z.string().trim().min(2),
  seriesTitle: z.string().trim().min(1).optional(),
  seasonLabel: z.string().trim().min(1).optional(),
  withThumbnails: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  }

  const jobId = randomUUID();
  createJob(jobId, parsed.data.identifier);

  // Executa a importação em segundo plano (servidor persistente).
  void (async () => {
    try {
      const res = await indexChannel({
        identifier: parsed.data.identifier,
        seriesTitle: parsed.data.seriesTitle,
        seasonLabel: parsed.data.seasonLabel,
        withThumbnails: parsed.data.withThumbnails ?? true,
        onProgress: (imported, total) => updateJob(jobId, { imported, total }),
      });
      updateJob(jobId, {
        status: "done",
        imported: res.imported,
        total: res.total,
        finishedAt: Date.now(),
      });
    } catch (e) {
      console.error("[index-channel] erro:", e);
      updateJob(jobId, {
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        finishedAt: Date.now(),
      });
    }
  })();

  return NextResponse.json({ ok: true, jobId });
}
