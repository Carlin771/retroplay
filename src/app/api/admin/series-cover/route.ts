import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  seriesId: z.string().min(1),
  cover: z
    .string()
    .min(1)
    .max(4_000_000) // ~4MB de margem para a imagem em base64
    .refine(
      (v) => v.startsWith("data:image/") || /^https?:\/\//i.test(v),
      "Imagem inválida (envie um arquivo de imagem ou uma URL http).",
    ),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "dados inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await prisma.series.update({
    where: { id: parsed.data.seriesId },
    data: { coverUrl: parsed.data.cover },
  });

  return NextResponse.json({ ok: true });
}
