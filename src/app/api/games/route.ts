import { connection } from "next/server";
import { ensureSampleGames } from "@/lib/games/demo";
import { listGames } from "@/lib/games/store";

export async function GET(request: Request) {
  await connection();
  const isDemo = new URL(request.url).searchParams.get("demo") === "1";
  return Response.json({
    games: await (isDemo ? ensureSampleGames() : listGames()),
  });
}
