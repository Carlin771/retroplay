import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import type { EntityLike } from "telegram/define";
import bigInt from "big-integer";

/**
 * Integração com o Telegram via MTProto (GramJS).
 *
 * - Cliente único e compartilhado, autenticado com a StringSession do ambiente.
 * - Download por trecho (offset/limit) para streaming.
 * - Tratamento de FLOOD_WAIT (espera pedida pelo Telegram) e de file_reference expirado.
 */

const REQUEST_CHUNK = 512 * 1024; // 512KB por requisição (máximo do MTProto)
const MEDIA_TTL_MS = 5 * 60 * 1000;

let clientPromise: Promise<TelegramClient> | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isTelegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_API_ID &&
      process.env.TELEGRAM_API_HASH &&
      process.env.TELEGRAM_SESSION,
  );
}

async function createClient(): Promise<TelegramClient> {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH ?? "";
  const session = process.env.TELEGRAM_SESSION ?? "";
  if (!apiId || !apiHash || !session) {
    throw new Error(
      "Telegram não configurado. Defina TELEGRAM_API_ID, TELEGRAM_API_HASH e TELEGRAM_SESSION (rode `npm run tg:login`).",
    );
  }
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.connect();
  return client;
}

export async function getClient(): Promise<TelegramClient> {
  if (!clientPromise) {
    clientPromise = createClient().catch((e) => {
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}

function getFloodWaitSeconds(e: unknown): number | null {
  const err = e as { seconds?: number; errorMessage?: string; message?: string };
  if (typeof err?.seconds === "number") return err.seconds;
  const msg = err?.errorMessage ?? err?.message ?? "";
  const m = /FLOOD_WAIT_(\d+)/.exec(String(msg));
  return m ? parseInt(m[1], 10) : null;
}

function isFileReferenceExpired(e: unknown): boolean {
  const err = e as { errorMessage?: string; message?: string };
  const msg = err?.errorMessage ?? err?.message ?? "";
  return /FILE_REFERENCE_EXPIRED|FILE_REFERENCE_/.test(String(msg));
}

/** Executa uma operação respeitando os limites de taxa (FLOOD_WAIT) do Telegram. */
export async function withFloodRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const secs = getFloodWaitSeconds(e);
      if (secs != null && secs <= 300 && attempt < maxRetries) {
        await sleep((secs + 1) * 1000);
        continue;
      }
      throw e;
    }
  }
}

// ---- Resolução de canal --------------------------------------------------

const entityCache = new Map<string, EntityLike>();

/** Extrai o hash de um link de convite privado (t.me/+HASH ou t.me/joinchat/HASH). */
function extractInviteHash(identifier: string): string | null {
  const s = identifier.trim();
  const m = /(?:t\.me\/(?:joinchat\/|\+)|^\+)([A-Za-z0-9_-]+)/i.exec(s);
  return m ? m[1] : null;
}

function normalizeIdentifier(identifier: string): EntityLike {
  let s = identifier.trim();
  const link = /(?:https?:\/\/)?t\.me\/(?:s\/)?(@?[\w\d_]+)/i.exec(s);
  if (link) s = link[1];
  if (s.startsWith("@")) s = s.slice(1);
  if (/^-?\d+$/.test(s)) return bigInt(s) as unknown as EntityLike;
  return s;
}

/** Resolve um canal privado a partir do hash do link de convite. */
async function resolveInvite(hash: string): Promise<EntityLike> {
  const client = await getClient();
  const info = await withFloodRetry(() =>
    client.invoke(new Api.messages.CheckChatInvite({ hash })),
  );
  // Já é membro (ou tem acesso de leitura): usa o chat diretamente.
  if (
    info instanceof Api.ChatInviteAlready ||
    info instanceof Api.ChatInvitePeek
  ) {
    return info.chat as unknown as EntityLike;
  }
  // Ainda não é membro: entra no canal pelo convite.
  const updates = await withFloodRetry(() =>
    client.invoke(new Api.messages.ImportChatInvite({ hash })),
  );
  const chats = (updates as { chats?: Api.TypeChat[] }).chats;
  if (chats && chats.length > 0) {
    return chats[0] as unknown as EntityLike;
  }
  throw new Error("Não foi possível acessar o canal por esse link de convite.");
}

export async function resolveEntity(identifier: string) {
  const cached = entityCache.get(identifier);
  if (cached) return cached;

  const inviteHash = extractInviteHash(identifier);
  const entity = inviteHash
    ? await resolveInvite(inviteHash)
    : await withFloodRetry(async () => {
        const client = await getClient();
        return client.getEntity(normalizeIdentifier(identifier));
      });

  entityCache.set(identifier, entity);
  return entity;
}

export async function getEntityTitle(identifier: string): Promise<string | null> {
  const entity = (await resolveEntity(identifier)) as {
    title?: string;
    username?: string;
  };
  return entity.title ?? entity.username ?? null;
}

// ---- Leitura de vídeos (indexação) --------------------------------------

function getVideoDocument(msg: Api.Message): Api.Document | undefined {
  const media = msg.media;
  if (media instanceof Api.MessageMediaDocument) {
    const doc = media.document;
    if (doc instanceof Api.Document) {
      const isVideo =
        (doc.mimeType?.startsWith("video/") ?? false) ||
        doc.attributes.some((a) => a instanceof Api.DocumentAttributeVideo);
      if (isVideo) return doc;
    }
  }
  return undefined;
}

function videoDuration(doc: Api.Document): number | null {
  const attr = doc.attributes.find(
    (a): a is Api.DocumentAttributeVideo =>
      a instanceof Api.DocumentAttributeVideo,
  );
  return attr ? Math.round(attr.duration) : null;
}

export type IndexedVideo = {
  messageId: number;
  caption: string | null;
  durationSec: number | null;
  sizeBytes: number;
  mime: string;
  thumbDataUrl: string | null;
};

/** Percorre um canal (do mais antigo ao mais novo) e devolve os vídeos encontrados. */
export async function* iterateChannelVideos(
  identifier: string,
  opts: { withThumbnails?: boolean } = {},
): AsyncGenerator<IndexedVideo> {
  const client = await getClient();
  const entity = await resolveEntity(identifier);

  for await (const msg of client.iterMessages(entity, { reverse: true })) {
    const doc = getVideoDocument(msg);
    if (!doc) continue;

    let thumbDataUrl: string | null = null;
    if (opts.withThumbnails) {
      thumbDataUrl = await downloadThumbnail(msg).catch(() => null);
    }

    yield {
      messageId: msg.id,
      caption: msg.message ? msg.message.slice(0, 300) : null,
      durationSec: videoDuration(doc),
      sizeBytes: Number(doc.size),
      mime: doc.mimeType ?? "video/mp4",
      thumbDataUrl,
    };
  }
}

async function downloadThumbnail(msg: Api.Message): Promise<string | null> {
  const client = await getClient();
  const buf = await withFloodRetry(() =>
    client.downloadMedia(msg, { thumb: 0 }),
  );
  if (!buf || typeof buf === "string") return null;
  const b64 = Buffer.from(buf).toString("base64");
  return `data:image/jpeg;base64,${b64}`;
}

// ---- Mídia para streaming ------------------------------------------------

export type MediaInfo = {
  media: Api.TypeMessageMedia;
  size: number;
  mime: string;
  channel: string;
  messageId: number;
  episodeId: string;
};

const mediaCache = new Map<string, { info: MediaInfo; ts: number }>();

async function fetchMedia(opts: {
  channel: string;
  messageId: number;
  episodeId: string;
}): Promise<MediaInfo> {
  const client = await getClient();
  const entity = await resolveEntity(opts.channel);
  const msgs = await withFloodRetry(() =>
    client.getMessages(entity, { ids: [opts.messageId] }),
  );
  const msg = msgs[0];
  const doc = msg ? getVideoDocument(msg) : undefined;
  if (!msg || !doc || !msg.media) {
    throw new Error("Mensagem ou vídeo não encontrado no Telegram.");
  }
  return {
    media: msg.media,
    size: Number(doc.size),
    mime: doc.mimeType ?? "video/mp4",
    channel: opts.channel,
    messageId: opts.messageId,
    episodeId: opts.episodeId,
  };
}

export async function resolveEpisodeMedia(opts: {
  channel: string;
  messageId: number;
  episodeId: string;
}): Promise<MediaInfo> {
  const cached = mediaCache.get(opts.episodeId);
  if (cached && Date.now() - cached.ts < MEDIA_TTL_MS) return cached.info;
  const info = await fetchMedia(opts);
  mediaCache.set(opts.episodeId, { info, ts: Date.now() });
  return info;
}

async function doDownload(
  media: Api.TypeMessageMedia,
  offset: number,
  length: number,
): Promise<Buffer> {
  const client = await getClient();
  const parts: Buffer[] = [];
  let collected = 0;
  const iter = client.iterDownload({
    file: media,
    offset: bigInt(offset),
    requestSize: REQUEST_CHUNK,
    limit: Math.ceil(length / REQUEST_CHUNK) + 1,
  });
  try {
    for await (const part of iter) {
      const buf = part as Buffer;
      parts.push(buf);
      collected += buf.length;
      if (collected >= length) break;
    }
  } finally {
    const maybeClose = (iter as { close?: () => Promise<void> }).close;
    if (typeof maybeClose === "function") {
      await maybeClose.call(iter).catch(() => {});
    }
  }
  const buf = Buffer.concat(parts);
  return buf.length > length ? buf.subarray(0, length) : buf;
}

/** Baixa `length` bytes a partir de `offset`, renovando file_reference se expirar. */
export async function downloadRange(
  info: MediaInfo,
  offset: number,
  length: number,
): Promise<Buffer> {
  try {
    return await withFloodRetry(() => doDownload(info.media, offset, length));
  } catch (e) {
    if (isFileReferenceExpired(e)) {
      const fresh = await fetchMedia(info);
      mediaCache.set(info.episodeId, { info: fresh, ts: Date.now() });
      info.media = fresh.media;
      info.size = fresh.size;
      return await withFloodRetry(() =>
        doDownload(fresh.media, offset, length),
      );
    }
    throw e;
  }
}
