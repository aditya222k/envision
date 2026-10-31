import { connection } from "next/server";
import { listGames } from "@/lib/games/store";

export async function GET() {
  await connection();
  return Response.json({ games: await listGames() });
}
