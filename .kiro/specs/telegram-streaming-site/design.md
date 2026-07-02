# Design - Site de Streaming (estilo Netflix) com vídeos do Telegram

## Visão geral

O sistema é uma única aplicação **Next.js** (TypeScript) que roda em um servidor sempre
ligado (VM gratuita da Oracle Cloud). Essa aplicação faz tudo:

- serve o site (catálogo estilo Netflix, páginas de série, player);
- expõe a API interna (login, catálogo, progresso);
- conversa com o Telegram via **GramJS** (MTProto) para importar e transmitir vídeos;
- guarda dados em um arquivo **SQLite** (via Prisma);
- mantém um **cache em disco** dos trechos de vídeo já baixados.

Os vídeos NÃO são copiados para o site. Eles continuam no Telegram; o site os transmite
sob demanda e guarda em cache os pedaços já acessados.

### Diagrama (texto)

```
Navegador do usuário
   |  (HTTPS)
   v
Caddy (proxy reverso + HTTPS grátis)
   |
   v
Aplicação Next.js  ───────────────┐
   ├─ Páginas (catálogo, player)   │
   ├─ API: /auth, /catalogo, /progresso
   ├─ /api/stream/[episodeId]  ──► Cache em disco ──(miss)──► Telegram (GramJS/MTProto)
   ├─ Indexador (lê canais → banco)
   v
SQLite (usuários, séries, temporadas, capítulos, progresso)
```

## Componentes

### 1. Aplicação web (Next.js, App Router)
- **Front-end** com Tailwind CSS para o visual estilo Netflix.
- **Route Handlers** (API) rodando no runtime Node (`export const runtime = 'nodejs'`),
  necessário para streaming e para usar GramJS.
- Renderização das páginas de catálogo no servidor (bom para navegação rápida e busca).

### 2. Módulo de integração com o Telegram (GramJS)
- Um cliente MTProto único e compartilhado, autenticado com `api_id`, `api_hash` e uma
  **StringSession** salva como segredo (variável de ambiente).
- Responsável por: listar mensagens de um canal, obter metadados de vídeo (tamanho,
  duração, miniatura) e baixar trechos de arquivo por `offset`/`limit`.
- Toda chamada é envelopada com **retentativa e respeito ao FLOOD_WAIT** (quando o
  Telegram pede para esperar X segundos, o sistema espera e tenta de novo).

### 3. Indexador de canais
- Aciona-se pelo painel admin (ou por linha de comando na primeira carga).
- Fluxo:
  1. Recebe o identificador/nome de um canal.
  2. Percorre o histórico de mensagens (`iterMessages`) do mais antigo para o mais novo.
  3. Filtra apenas mensagens com vídeo (documento de vídeo ou `MessageMediaDocument`
     com mime de vídeo).
  4. Para cada vídeo, cria/atualiza um **Capítulo** com: número sequencial, título
     (da legenda, se houver), `telegramMessageId`, tamanho, duração e miniatura.
  5. **Deduplicação:** usa a chave única `(seasonId, telegramMessageId)` para não
     duplicar em execuções repetidas; importa só o que é novo.
- **Mapeamento série/temporada:** cada canal vira uma **Temporada**. O indexador tenta
  extrair do nome do canal o nome da série e o rótulo da temporada
  (ex.: `"malhacao 1995"` → série `"Malhação"`, temporada `"1995"`). Se já existir uma
  série com esse nome, a temporada é anexada a ela; senão, cria a série.

### 4. Endpoint de streaming com cache (`/api/stream/[episodeId]`)
Este é o coração do projeto. Ele entrega o vídeo respeitando **HTTP Range** (o que
permite adiantar/voltar e começar a assistir sem baixar tudo).

Fluxo de uma requisição:
1. Verifica a **sessão** do usuário (precisa estar logado). Sem sessão → 401.
2. Busca o capítulo no banco e resolve a localização do arquivo no Telegram
   (`InputDocumentFileLocation`). Como o `file_reference` do Telegram pode **expirar**,
   se a referência falhar o sistema **rebusca a mensagem** para obter uma referência
   nova e tenta de novo.
3. Lê o cabeçalho `Range` (ex.: `bytes=1048576-`). Calcula o trecho pedido.
4. Para cada **segmento** do trecho (segmentos de tamanho fixo, ex.: 1MB, alinhados às
   regras do MTProto):
   - se o segmento está no **cache em disco**, lê de lá;
   - se não, baixa do Telegram (`iterDownload`/`getFile` com offset), **grava no cache**
     e entrega.
5. Responde com status **206 Partial Content** e cabeçalhos `Content-Range`,
   `Accept-Ranges: bytes`, `Content-Length` e `Content-Type` corretos, transmitindo em
   fluxo (stream) para não carregar o vídeo inteiro na memória.

### 5. Cache em disco
- Guarda segmentos de vídeo em `CACHE_DIR` (no disco de 200GB da VM).
- Estrutura: uma pasta por capítulo, arquivos por segmento (ex.: `episodeId/000123.seg`).
- **Política LRU com teto configurável** (`CACHE_MAX_BYTES`, ex.: 150GB): ao ultrapassar
  o teto, remove os segmentos acessados há mais tempo.
- Benefício: reduz drasticamente o acesso ao Telegram (menos risco de bloqueio) e deixa
  a reprodução mais rápida na segunda vez.

### 6. Autenticação e controle de acesso (Auth.js)
- **Auth.js (NextAuth)** com provedor de credenciais (e-mail + senha).
- Senhas com hash forte (bcrypt/argon2). Nunca em texto puro.
- Papéis: `USER` (padrão) e `ADMIN`.
- Regras:
  - Navegar no catálogo: liberado (mesmo sem login).
  - Dar play / acessar `/api/stream/*`: exige sessão válida.
  - Painel admin e ações de indexação: exige papel `ADMIN`.
- Proteção extra contra "roubo de link": o endpoint de streaming valida a sessão a cada
  requisição; opcionalmente emite um token curto assinado por capítulo/usuário.

### 7. Player e progresso
- `<video>` HTML5 nativo apontando para `/api/stream/[episodeId]` (funciona com Range,
  seek e barra de progresso).
- A cada ~10s de reprodução (e ao pausar/sair), o player envia a posição atual para
  `/api/progresso`, que grava em `WatchProgress`.
- Ao reabrir um capítulo, o player retoma da posição salva.
- Ao terminar (>90% assistido), marca como concluído e sugere/inicia o próximo capítulo.

## Modelo de dados (Prisma / SQLite)

```prisma
model User {
  id           String         @id @default(cuid())
  email        String         @unique
  passwordHash String
  name         String?
  role         Role           @default(USER)
  createdAt    DateTime       @default(now())
  progress     WatchProgress[]
}

enum Role {
  USER
  ADMIN
}

model Series {
  id          String   @id @default(cuid())
  title       String   @unique
  description String?
  coverUrl    String?
  hidden      Boolean  @default(false)
  createdAt   DateTime @default(now())
  seasons     Season[]
}

model Season {
  id                    String    @id @default(cuid())
  series                Series    @relation(fields: [seriesId], references: [id])
  seriesId              String
  label                 String    // ex.: "1995"
  order                 Int       // ordem de exibição
  telegramChannelId     String    // identificador do canal no Telegram
  telegramChannelTitle  String?
  hidden                Boolean   @default(false)
  episodes              Episode[]

  @@unique([seriesId, label])
}

model Episode {
  id                 String          @id @default(cuid())
  season             Season          @relation(fields: [seasonId], references: [id])
  seasonId           String
  number             Int             // capítulo 1, 2, 3...
  title              String?
  telegramMessageId  BigInt          // id da mensagem no canal (estável)
  durationSec        Int?
  sizeBytes          BigInt?
  thumbUrl           String?
  hidden             Boolean         @default(false)
  addedAt            DateTime        @default(now())
  progress           WatchProgress[]

  @@unique([seasonId, telegramMessageId])
  @@unique([seasonId, number])
}

model WatchProgress {
  id          String   @id @default(cuid())
  user        User     @relation(fields: [userId], references: [id])
  userId      String
  episode     Episode  @relation(fields: [episodeId], references: [id])
  episodeId   String
  positionSec Int      @default(0)
  completed   Boolean  @default(false)
  updatedAt   DateTime @updatedAt

  @@unique([userId, episodeId])
}
```

Observações:
- A **StringSession** e as credenciais do Telegram ficam em variáveis de ambiente
  (segredos), não no banco.
- `telegramMessageId` é estável; o `file_reference` (volátil) é resolvido em tempo de
  streaming e mantido em memória por um curto período.

## Rotas principais

| Rota | Método | Acesso | Função |
|------|--------|--------|--------|
| `/` | GET | público | Página inicial (fileiras + "Continuar assistindo") |
| `/serie/[id]` | GET | público | Página da série com temporadas e capítulos |
| `/assistir/[episodeId]` | GET | logado | Player |
| `/api/auth/*` | * | público | Login/cadastro (Auth.js) |
| `/api/stream/[episodeId]` | GET | logado | Streaming com Range + cache |
| `/api/progresso` | POST | logado | Salvar posição de reprodução |
| `/api/admin/index-channel` | POST | admin | Disparar indexação de um canal |
| `/admin` | GET | admin | Painel de administração |

## Segurança
- Segredos (Telegram, `AUTH_SECRET`) apenas em variáveis de ambiente; nunca versionados.
- Endpoint de streaming exige sessão; opção de token assinado de curta duração.
- Painel/admin protegidos por papel `ADMIN`.
- HTTPS via Caddy (certificado Let's Encrypt automático e gratuito).
- Rate limit básico nas rotas de login e de indexação.

## Implantação (Oracle Cloud Always Free)
- **VM:** Ubuntu, shape ARM Ampere A1 (2 OCPU / 12GB) — always free.
- **Docker Compose** com dois serviços:
  - `app`: a aplicação Next.js em produção (`next start`).
  - `caddy`: proxy reverso com HTTPS automático.
- **Volumes** persistentes: arquivo SQLite e pasta de cache.
- **Domínio grátis:** subdomínio via DuckDNS (ex.: `malhacao.duckdns.org`), usado pelo
  Caddy para emitir o certificado HTTPS.
- **Variáveis de ambiente:** `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`,
  `AUTH_SECRET`, `ADMIN_EMAIL`, `CACHE_DIR`, `CACHE_MAX_BYTES`, `DATABASE_URL`.
- **Geração da sessão do Telegram:** um script único e guiado (`npm run tg:login`) pede
  o telefone e o código recebido no app do Telegram e gera a `StringSession`, que é
  colada no arquivo de ambiente. Feito uma vez só.
- Todo o processo terá um passo a passo clique-a-clique (o usuário não escreve código).

## Tratamento de erros e limites
- **FLOOD_WAIT:** retentativa com espera respeitando o tempo pedido pelo Telegram.
- **file_reference expirado:** rebuscar a mensagem e refazer o download.
- **Capítulo indisponível/apagado no Telegram:** marcar como indisponível e avisar no
  player, sem quebrar a página.
- **Logs** de erro no servidor para diagnóstico.

## Limites conhecidos (honestidade sobre a escala)
- Este design é ótimo para lançamento e audiência pequena/média a custo zero.
- Se muitas pessoas assistirem **ao mesmo tempo**, dois gargalos podem aparecer:
  1. limites do Telegram (FLOOD_WAIT) — mitigados pelo cache e, no futuro, por múltiplas
     sessões;
  2. banda/CPU da VM gratuita.
- Caminho de evolução (futuro, se precisar): mover os vídeos mais assistidos para um
  armazenamento com CDN de egress barato (ex.: Cloudflare R2) e/ou usar várias sessões
  do Telegram. A arquitetura já isola o streaming para facilitar essa migração.
