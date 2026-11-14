import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  checkAdminPassword,
  createAdminToken,
  isValidAdminToken,
} from "@/lib/admin-auth";
import {
  createPlayer,
  getAllPlayers,
  mergePlayers,
  playerSubmissionCounts,
  removePlayer,
  updatePlayer,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const isAdmin = (req: NextRequest) => isValidAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);

async function playersWithCounts() {
  const [players, counts] = await Promise.all([getAllPlayers(), playerSubmissionCounts()]);
  return players.map((p) => ({ ...p, submissions: counts[p.id] || 0 }));
}

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) return NextResponse.json({ authed: false });
    return NextResponse.json({ authed: true, players: await playersWithCounts() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "login") {
      if (!checkAdminPassword(String(body.password || ""))) {
        await new Promise((r) => setTimeout(r, 600)); // slow down guessing
        return NextResponse.json({ error: "Wrong password." }, { status: 401 });
      }
      const token = createAdminToken();
      const res = NextResponse.json({ authed: true, players: await playersWithCounts() });
      res.cookies.set(ADMIN_COOKIE, token.value, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: token.maxAgeSeconds,
      });
      return res;
    }

    if (body.action === "logout") {
      const res = NextResponse.json({ authed: false });
      res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    if (!isAdmin(req)) {
      return NextResponse.json({ error: "Admin login required." }, { status: 401 });
    }

    let result: Record<string, unknown> = {};
    switch (body.action) {
      case "add":
        await createPlayer(String(body.name || ""), body.color);
        break;
      case "update":
        await updatePlayer(String(body.playerId), { name: body.name, color: body.color });
        break;
      case "remove":
        result = await removePlayer(String(body.playerId));
        break;
      case "merge":
        result = await mergePlayers(String(body.sourceId), String(body.targetId));
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result, players: await playersWithCounts() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 400 }
    );
  }
}
