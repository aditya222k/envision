import { connection } from "next/server";
import {
  deleteGame,
  getGameDetails,
  MAX_NAME_LENGTH,
  renameGame,
  resolveReview,
  setPublished,
  undoVersion,
} from "@/lib/games/store";

type Context = { params: Promise<{ id: string }> };

const notFound = () =>
  Response.json({ error: "That game no longer exists." }, { status: 404 });

export async function GET(_request: Request, { params }: Context) {
  await connection();
  const game = await getGameDetails((await params).id);
  return game ? Response.json({ game }) : notFound();
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (body?.undo === true) {
    const game = await undoVersion(id);
    return game ? Response.json({ game }) : notFound();
  }

  if (typeof body?.reviewIndex === "number") {
    const result = await resolveReview(
      id,
      body.reviewIndex,
      typeof body.answerIndex === "number" ? body.answerIndex : null,
    );
    if (!result) {
      return notFound();
    }
    return "error" in result
      ? Response.json({ error: result.error }, { status: 400 })
      : Response.json({ game: result });
  }

  if (typeof body?.published === "boolean") {
    const game = await setPublished(id, body.published);
    return game ? Response.json({ game }) : notFound();
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    return Response.json(
      { error: `A name needs 1 to ${MAX_NAME_LENGTH} characters.` },
      { status: 400 },
    );
  }
  const game = await renameGame(id, name);
  return game ? Response.json({ game }) : notFound();
}

export async function DELETE(_request: Request, { params }: Context) {
  const deleted = await deleteGame((await params).id);
  return deleted ? Response.json({ deleted: true }) : notFound();
}
