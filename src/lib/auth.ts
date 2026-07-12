import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "sessao";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias em segundos

export type SessionPayload = {
  userId: string;
  role: string;
  email: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET ausente ou muito curto. Defina uma chave longa e aleatória no .env.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: SessionPayload,
  expiresAt?: Date | null,
): Promise<string> {
  const jwt = new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt();
  // Acesso de teste: o token morre exatamente quando o acesso expira.
  if (expiresAt) {
    jwt.setExpirationTime(Math.floor(expiresAt.getTime() / 1000));
  } else {
    jwt.setExpirationTime("30d");
  }
  return jwt.sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      role: String(payload.role ?? "USER"),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}

/** Lê a sessão do cookie (para uso em Server Components e Route Handlers). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, expiresAt: true },
  });
  if (!user) return null;
  // Acesso de teste expirado é tratado como deslogado.
  if (user.expiresAt && user.expiresAt.getTime() <= Date.now()) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * Como getCurrentUser, mas pensado para portões de acesso (assistir/stream):
 * retorna o usuário apenas se ele existir e não estiver expirado.
 */
export async function getActiveUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, expiresAt: true },
  });
  if (!user) return null;
  if (user.expiresAt && user.expiresAt.getTime() <= Date.now()) return null;
  return user;
}

export function sessionCookieOptions(maxAgeSeconds: number = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Exige um usuário logado; redireciona para /login caso contrário. */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Exige um usuário administrador. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");
  return session;
}
