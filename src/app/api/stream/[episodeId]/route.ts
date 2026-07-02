import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveEpisodeMedia, downloadRange } from "@/lib/telegram";
import { getSegment, SEGMENT_SIZE } from "@/lib/cache";
import { parseRange } from "@/lib/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new Response("Faça login para assistir.", { status: 401 });
  }

  const { episodeId } = await params;
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { season: true },
  });
  if (!episode || episode.hidden) {
    return new Response("Capítulo não encontrado.", { status: 404 });
  }

  let media;
  try {
    media = await resolveEpisodeMedia({
      channel: episode.season.telegramChannelId,
      messageId: episode.telegramMessageId,
      episodeId: episode.id,
    });
  } catch (e) {
    console.error("[stream] falha ao resolver mídia:", e);
    return new Response("Vídeo indisponível no momento.", { status: 502 });
  }

  const size = media.size;
  const mime = media.mime || "video/mp4";
  const range = parseRange(req.headers.get("range"), size);

  const start = range ? range.start : 0;
  const end = range ? range.end : size - 1;

  const headers = new Headers();
  headers.set("Content-Type", mime);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Cache-Control", "private, max-age=0");
  if (range) {
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }

  let nextByte = start;
  let canceled = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (canceled) return;
      if (nextByte > end) {
        controller.close();
        return;
      }
      const segIndex = Math.floor(nextByte / SEGMENT_SIZE);
      const segStart = segIndex * SEGMENT_SIZE;
      try {
        const seg = await getSegment(episode.id, segIndex, (offset, length) =>
          downloadRange(media, offset, length),
        );
        if (canceled) return;
        const withinStart = nextByte - segStart;
        if (seg.length === 0 || withinStart >= seg.length) {
          controller.close();
          return;
        }
        const withinEnd = Math.min(seg.length - 1, end - segStart);
        controller.enqueue(seg.subarray(withinStart, withinEnd + 1));
        nextByte = segStart + withinEnd + 1;
        // segmento curto = fim do arquivo
        if (nextByte > end || seg.length < SEGMENT_SIZE) {
          controller.close();
        }
      } catch (e) {
        console.error("[stream] erro ao baixar segmento:", e);
        controller.error(e);
      }
    },
    cancel() {
      canceled = true;
    },
  });

  return new Response(stream, {
    status: range ? 206 : 200,
    headers,
  });
}
