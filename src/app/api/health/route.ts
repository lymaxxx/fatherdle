import { NextResponse } from "next/server";
import { getAllPlayers, storageKind } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Open /api/health on the live site to see whether the server and storage work. */
export async function GET() {
  const storage = storageKind();
  try {
    const players = await getAllPlayers();
    return NextResponse.json({ ok: true, storage, players: players.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, storage, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
