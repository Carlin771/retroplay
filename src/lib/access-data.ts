import { prisma } from "@/lib/db";

export type AccessRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string; // ISO
  expiresAt: string | null; // ISO ou null (null = acesso permanente)
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
      expiresAt: true,
    },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    expiresAt: u.expiresAt ? u.expiresAt.toISOString() : null,
  }));
}
