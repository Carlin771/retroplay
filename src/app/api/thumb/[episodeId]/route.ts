import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PNG transparente 1x1, usado quando o capítulo não tem miniatura.
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ episodeId: string }> },
) {
  const { episodeId } = await params;
  const ep = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: { thumbDataUrl: true },
  });

  const data = ep?.thumbDataUrl;
  const match = data ? /^data:([^;]+);base64,(.+)$/.exec(data) : null;

  if (!match) {
    return new Response(TRANSPARENT_PNG, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const buf = Buffer.from(match[2], "base64");
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": match[1] || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
