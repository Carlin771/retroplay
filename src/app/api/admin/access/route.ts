import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

// Limite de duração do acesso de teste: de 1 minuto até 24 horas.
const MAX_TEST_MINUTES = 24 * 60;

const createSchema = z.object({
  email: z.email("E-mail inválido."),
  password: z.string().min(4, "A senha precisa de ao menos 4 caracteres."),
  name: z.string().trim().min(1).max(80).optional(),
  testMinutes: z.number().int().positive().max(MAX_TEST_MINUTES).optional(),
});

async function requireAdminApi() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  const session = await requireAdminApi();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const { password, name, testMinutes } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um acesso com esse e-mail." },
      { status: 409 },
    );
  }

  // Acesso de teste: saldo em segundos de TEMPO ASSISTINDO (não relógio).
  const trialSecondsTotal = testMinutes ? testMinutes * 60 : null;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      name: name ?? null,
      role: "USER", // acessos criados aqui nunca são admin
      trialSecondsTotal,
      trialSecondsUsed: 0,
    },
    select: { id: true, email: true, trialSecondsTotal: true },
  });

  return NextResponse.json({
    ok: true,
    access: {
      id: user.id,
      email: user.email,
      trialMinutes: user.trialSecondsTotal ? user.trialSecondsTotal / 60 : null,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdminApi();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID ausente." }, { status: 400 });
  }

  if (id === session.userId) {
    return NextResponse.json(
      { error: "Você não pode excluir o seu próprio acesso." },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
  }
  if (target.role === "ADMIN") {
    return NextResponse.json(
      { error: "Não é possível excluir um administrador por aqui." },
      { status: 403 },
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
