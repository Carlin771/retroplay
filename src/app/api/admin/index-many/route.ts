import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { indexChannel } from "@/lib/indexer";
import { createJob, updateJob } from "@/lib/index-jobs";

export const runtime = "nodejs";

const schema = z.object({
  channels: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        link: z.string().trim().min(2),
        cover: z.string().trim().optional(),
      }),
    )
    .min(1)
    .max(100),
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

  const { channels, withThumbnails = true } = parsed.data;
  const jobs = channels.map((c) => ({ id: randomUUID(), channel: c }));
  for (const j of jobs) createJob(j.id, `${j.channel.name}`);

  // Processa SEQUENCIALMENTE em segundo plano (evita sobrecarregar o Telegram).
  void (async () => {
    for (const j of jobs) {
      try {
        const res = await indexChannel({
          identifier: j.channel.link,
          seriesTitle: j.channel.name, // usa o nome exato como título da série
          seasonLabel: "1",
          withThumbnails,
          onProgress: (imported, total) => updateJob(j.id, { imported, total }),
        });
        // Define a capa (pôster) da série, se foi informada.
        if (j.channel.cover) {
          await prisma.series.update({
            where: { id: res.seriesId },
            data: { coverUrl: j.channel.cover },
          });
        }
        updateJob(j.id, {
          status: "done",
          imported: res.imported,
          total: res.total,
          finishedAt: Date.now(),
        });
      } catch (e) {
        console.error("[index-many] erro em", j.channel.name, e);
        updateJob(j.id, {
          status: "error",
          error: e instanceof Error ? e.message : String(e),
          finishedAt: Date.now(),
        });
      }
    }
  })();

  return NextResponse.json({ ok: true, count: jobs.length });
}
