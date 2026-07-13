import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  episodeId: z.string().min(1),
  positionSec: z.number().int().min(0),
  durationSec: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  }

  const { episodeId, positionSec, durationSec = 0, completed } = parsed.data;

  const ep = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: { durationSec: true },
  });
  if (!ep) {
    return NextResponse.json({ error: "capítulo inexistente" }, { status: 404 });
  }

  const dur = durationSec || ep.durationSec || 0;
  const isCompleted = completed ?? (dur > 0 && positionSec / dur >= 0.9);

  await prisma.watchProgress.upsert({
    where: { userId_episodeId: { userId: session.userId, episodeId } },
    update: { positionSec, durationSec: dur, completed: isCompleted },
    create: {
      userId: session.userId,
      episodeId,
      positionSec,
      durationSec: dur,
      completed: isCompleted,
    },
  });

  // Marca presença ("online/assistindo") e, se for acesso de teste, consome o
  // saldo de tempo. O relógio só avança entre pings, que só ocorrem enquanto o
  // vídeo está tocando — então pausa não conta. CAP evita contar pausas longas.
  const CAP_SEC = 15;
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      trialSecondsTotal: true,
      trialSecondsUsed: true,
      lastSeenAt: true,
    },
  });

  let blocked = false;
  let remainingSec: number | null = null;

  if (user && user.trialSecondsTotal != null) {
    const lastMs = user.lastSeenAt ? user.lastSeenAt.getTime() : null;
    const delta =
      lastMs != null
        ? Math.min(CAP_SEC, Math.max(0, Math.floor((now.getTime() - lastMs) / 1000)))
        : 0;
    const used = Math.min(user.trialSecondsTotal, user.trialSecondsUsed + delta);
    remainingSec = Math.max(0, user.trialSecondsTotal - used);
    blocked = used >= user.trialSecondsTotal;
    await prisma.user.update({
      where: { id: session.userId },
      data: { trialSecondsUsed: used, lastSeenAt: now },
    });
  } else if (user) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { lastSeenAt: now },
    });
  }

  return NextResponse.json({ ok: true, blocked, remainingSec });
}
