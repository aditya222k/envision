import { connection } from "next/server";
import { readyGameHtml } from "@/lib/games/readyGames";

type Context = { params: Promise<{ id: string }> };

// Serves a ready-made game in the same sandbox as published games.
export async function GET(_request: Request, { params }: Context) {
  await connection();
  const html = await readyGameHtml((await params).id);
  return new Response(html ?? "This game isn't available.", {
    status: html ? 200 : 404,
    headers: {
      "Content-Type": html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "sandbox allow-scripts",
    },
  });
}
