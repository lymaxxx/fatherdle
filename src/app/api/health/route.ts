import { NextResponse } from "next/server";
import { blobDiagnostics, getAllPlayers, storageKind } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Open /api/health on the live site to see whether the server and storage work. */
export async function GET() {
  const storage = storageKind();
  const blobs = blobDiagnostics();
  const started = Date.now();
  try {
    const players = await getAllPlayers();
    return NextResponse.json({ ok: true, storage, players: players.length, ms: Date.now() - started, blobs });
  } catch (err) {
    return NextResponse.json(
      { ok: false, storage, ms: Date.now() - started, blobs, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
