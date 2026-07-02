import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/**
 * Login único no Telegram para gerar a TELEGRAM_SESSION.
 *
 * Antes de rodar:
 *   1. Acesse https://my.telegram.org > "API development tools".
 *   2. Crie um app e copie api_id e api_hash.
 *   3. Coloque em TELEGRAM_API_ID e TELEGRAM_API_HASH no arquivo .env.
 *
 * Depois rode:  npm run tg:login
 * Copie a string gerada para TELEGRAM_SESSION no .env.
 */
async function main() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH ?? "";

  if (!apiId || !apiHash) {
    console.error(
      "Defina TELEGRAM_API_ID e TELEGRAM_API_HASH no .env antes (gere em https://my.telegram.org).",
    );
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () =>
      (await rl.question("Telefone com DDI (ex.: +5511999999999): ")).trim(),
    password: async () =>
      (
        await rl.question(
          "Senha da verificação em 2 etapas (deixe vazio se não tiver): ",
        )
      ).trim(),
    phoneCode: async () =>
      (await rl.question("Código recebido no app do Telegram: ")).trim(),
    onError: (err) => console.error(err),
  });

  const session = client.session.save();
  console.log("\n================ TELEGRAM_SESSION ================");
  console.log("Copie a linha abaixo para TELEGRAM_SESSION no seu .env:\n");
  console.log(session);
  console.log("\n==================================================\n");

  await client.disconnect();
  rl.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
