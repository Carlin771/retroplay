import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Senha fixa dos acessos criados pelo webhook (pedido do dono do site).
const FIXED_PASSWORD = "1234";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

// Chaves (normalizadas) que costumam conter o e-mail do comprador.
const KNOWN_EMAIL_KEYS = new Set([
  "email",
  "emailaddress",
  "customeremail",
  "buyeremail",
  "useremail",
  "subscriberemail",
  "clientemail",
  "contactemail",
  "mail",
]);

/** Comparação de token em tempo constante. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Valida o token do webhook (querystring ?token= ou header x-webhook-token). */
function tokenOk(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false; // fail-closed: sem segredo configurado, nada passa
  const provided =
    new URL(req.url).searchParams.get("token") ??
    req.headers.get("x-webhook-token") ??
    req.headers.get("x-webhook-secret") ??
    "";
  return provided.length > 0 && safeEqual(provided, secret);
}

/**
 * Procura um e-mail no payload: primeiro em chaves conhecidas (email, buyer_email,
 * etc.), depois qualquer string que pareça um e-mail. Assim funciona com formatos
 * diferentes de webhook sem precisar configurar o caminho exato.
 */
function extractEmail(data: unknown): string | null {
  const prioritized: string[] = [];
  const anyEmail: string[] = [];

  const visit = (val: unknown, key?: string) => {
    if (typeof val === "string") {
      const m = val.match(EMAIL_RE);
      if (m) {
        const email = m[0].toLowerCase();
        const normKey = key ? key.toLowerCase().replace(/[^a-z]/g, "") : "";
        if (KNOWN_EMAIL_KEYS.has(normKey)) prioritized.push(email);
        anyEmail.push(email);
      }
      return;
    }
    if (Array.isArray(val)) {
      for (const v of val) visit(v);
      return;
    }
    if (val && typeof val === "object") {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        visit(v, k);
      }
    }
  };

  visit(data);
  return prioritized[0] ?? anyEmail[0] ?? null;
}

/** Lê o corpo aceitando JSON ou formulário (urlencoded/multipart). */
async function parseBody(req: NextRequest): Promise<unknown> {
  const ctype = req.headers.get("content-type") ?? "";
  try {
    if (ctype.includes("application/json")) {
      return await req.json();
    }
    if (
      ctype.includes("application/x-www-form-urlencoded") ||
      ctype.includes("multipart/form-data")
    ) {
      const fd = await req.formData();
      const obj: Record<string, string> = {};
      fd.forEach((v, k) => {
        obj[k] = String(v);
      });
      return obj;
    }
    // Tipo desconhecido: tenta JSON, senão devolve o texto cru.
    const text = await req.text();
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const data = await parseBody(req);
  const email = extractEmail(data);
  if (!email) {
    // Responde 2xx mesmo sem e-mail (ping de teste da plataforma ou evento sem
    // comprador) para o webhook não ser marcado como falho. Apenas não cria nada.
    console.warn("[webhook/access] payload sem e-mail; nada a criar");
    return NextResponse.json({ ok: true, created: false, reason: "sem e-mail" });
  }

  // Idempotente: se já existe, não recria nem altera a senha.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: true, created: false, email });
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(FIXED_PASSWORD),
      role: "USER", // nunca admin
      // trialSecondsTotal nulo = acesso permanente
    },
  });
  console.log(`[webhook/access] acesso criado para ${email}`);

  return NextResponse.json({ ok: true, created: true, email });
}

// Permite testar a URL no navegador (com o token) sem criar nada.
export async function GET(req: NextRequest) {
  if (!tokenOk(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    message:
      "Webhook de acesso ativo. Envie POST com o e-mail no corpo para criar o acesso.",
  });
}
