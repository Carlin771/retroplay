"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function updateSeriesAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const coverUrl = String(formData.get("coverUrl") ?? "").trim();
  const hidden = formData.get("hidden") === "on";
  if (!id || !title) return;
  await prisma.series.update({
    where: { id },
    data: {
      title,
      description: description || null,
      coverUrl: coverUrl || null,
      hidden,
    },
  });
  revalidatePath(`/admin/serie/${id}`);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function renameSeasonAction(formData: FormData) {
  await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "");
  const seriesId = String(formData.get("seriesId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!seasonId || !label) return;
  await prisma.season.update({ where: { id: seasonId }, data: { label } });
  revalidatePath(`/admin/serie/${seriesId}`);
  revalidatePath("/");
}

export async function toggleSeasonHiddenAction(formData: FormData) {
  await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "");
  const seriesId = String(formData.get("seriesId") ?? "");
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return;
  await prisma.season.update({
    where: { id: seasonId },
    data: { hidden: !season.hidden },
  });
  revalidatePath(`/admin/serie/${seriesId}`);
  revalidatePath("/");
}

export async function deleteSeasonAction(formData: FormData) {
  await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "");
  const seriesId = String(formData.get("seriesId") ?? "");
  if (!seasonId) return;
  await prisma.season.delete({ where: { id: seasonId } });
  revalidatePath(`/admin/serie/${seriesId}`);
  revalidatePath("/");
}

export async function moveSeasonAction(formData: FormData) {
  await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "");
  const seriesId = String(formData.get("seriesId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const seasons = await prisma.season.findMany({
    where: { seriesId },
    orderBy: { order: "asc" },
  });
  const idx = seasons.findIndex((s) => s.id === seasonId);
  if (idx < 0) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= seasons.length) return;
  const a = seasons[idx];
  const b = seasons[swapIdx];
  await prisma.season.update({ where: { id: a.id }, data: { order: b.order } });
  await prisma.season.update({ where: { id: b.id }, data: { order: a.order } });
  revalidatePath(`/admin/serie/${seriesId}`);
}
