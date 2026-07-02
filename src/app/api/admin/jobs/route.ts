import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listJobs } from "@/lib/index-jobs";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  }
  return NextResponse.json({ jobs: listJobs() });
}
