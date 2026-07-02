import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

/**
 * Cria (ou promove) o usuário administrador a partir de ADMIN_EMAIL/ADMIN_PASSWORD.
 * Uso: npm run create:admin
 */
async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    console.error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no arquivo .env.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN", passwordHash },
    });
    console.log(`Administrador atualizado: ${email}`);
  } else {
    await prisma.user.create({
      data: { email, passwordHash, role: "ADMIN", name: "Admin" },
    });
    console.log(`Administrador criado: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
