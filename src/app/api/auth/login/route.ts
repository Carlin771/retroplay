import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { signSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  email: z.email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Mensagem genérica para não revelar se o e-mail existe.
  const invalid = () =>
    NextResponse.json(
      { error: "E-mail ou senha incorretos." },
      { status: 401 },
    );

  if (!user) return invalid();

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return invalid();

  // Acesso de teste expirado: bloqueia (só revelamos após a senha estar correta).
  if (user.expiresAt && user.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Este acesso expirou. Peça um novo ao administrador." },
      { status: 401 },
    );
  }

  const token = await signSession(
    {
      userId: user.id,
      role: user.role,
      email: user.email,
    },
    user.expiresAt,
  );

  // Para acesso de teste, o cookie também expira junto com o acesso.
  const maxAge = user.expiresAt
    ? Math.max(1, Math.floor((user.expiresAt.getTime() - Date.now()) / 1000))
    : undefined;

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return res;
}
