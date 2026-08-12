import { NextResponse } from "next/server";
import type { CommitsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const workerUrl = (
    process.env.WORKER_URL ?? "http://localhost:4000"
  ).replace(/\/$/, "");

  try {
    const res = await fetch(`${workerUrl}/commits`, {
      cache: "no-store",
    });
    const body = await res.json();
    if (!res.ok) {
      return NextResponse.json(body, { status: res.status });
    }
    return NextResponse.json(body as CommitsResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Can't reach commits worker",
        detail: `${message}. Is the worker running at ${workerUrl}?`,
      },
      { status: 503 },
    );
  }
}
