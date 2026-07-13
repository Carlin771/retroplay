import { prisma } from "@/lib/db";

export type AccessRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string; // ISO
  trialSecondsTotal: number | null; // null = acesso permanente
  trialSecondsUsed: number;
  lastSeenAt: string | null; // ISO ou null (nunca acessou)
};

/** Lista todos os acessos (usuários) para a aba de administração. */
export async function getAccessList(): Promise<AccessRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      trialSecondsTotal: true,
      trialSecondsUsed: true,
      lastSeenAt: true,
    },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    trialSecondsTotal: u.trialSecondsTotal,
    trialSecondsUsed: u.trialSecondsUsed,
    lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
  }));
}
