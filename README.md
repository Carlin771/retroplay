# RetrôPlay — site de streaming (estilo Netflix) com vídeos do Telegram

Site para assistir séries cujos episódios estão hospedados em canais do Telegram.
Os vídeos continuam no Telegram; o site faz streaming sob demanda com cache, login
individual e "continuar assistindo".

- **Stack:** Next.js 16 + TypeScript, Prisma + SQLite, GramJS (Telegram/MTProto),
  Tailwind CSS. Autenticação própria com cookie de sessão (jose + bcrypt).
- **Modelo:** Série → Temporada (1 canal do Telegram) → Capítulo (1 vídeo).

## Como colocar no ar

Veja o guia passo a passo em **[DEPLOY.md](./DEPLOY.md)** (feito para quem não programa).

## Rodar localmente (para testar)

```bash
npm install
cp .env.example .env      # preencha AUTH_SECRET e, para vídeo, as chaves do Telegram
npm run db:push           # cria o banco SQLite
npm run create:admin      # cria o admin (usa ADMIN_EMAIL/ADMIN_PASSWORD do .env)
npm run dev               # abre em http://localhost:3000
```

## Scripts úteis

| Comando | O que faz |
|---------|-----------|
| `npm run tg:login` | Login no Telegram (gera a `TELEGRAM_SESSION`). |
| `npm run create:admin` | Cria/atualiza o usuário administrador. |
| `npm run index:channel -- @canal` | Importa um canal como temporada. |
| `npm run db:studio` | Abre uma UI para ver o banco de dados. |
| `npm run build` / `npm run start` | Build e execução em produção. |

## Configuração (.env)

Veja `.env.example`. As variáveis sensíveis (chaves do Telegram, `AUTH_SECRET`) nunca
são versionadas nem enviadas ao navegador.
