import { connection } from "next/server";
import {
  deleteStoryline,
  getStoryline,
  publishStoryline,
  updateOutline,
} from "@/lib/games/storylineStore";

type Context = { params: Promise<{ id: string }> };

const notFound = () =>
  Response.json({ error: "That storyline no longer exists." }, { status: 404 });

export async function GET(_request: Request, { params }: Context) {
  await connection();
  const storyline = await getStoryline((await params).id);
  return storyline ? Response.json({ storyline }) : notFound();
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (typeof body?.publish === "boolean") {
    const result = await publishStoryline(id, body.publish);
    if (!result) {
      return notFound();
    }
    return "error" in result
      ? Response.json({ error: result.error }, { status: 400 })
      : Response.json({ storyline: result });
  }

  if (!(await getStoryline(id))) {
    return notFound();
  }
  const storyline = await updateOutline(id, body);
  return storyline
    ? Response.json({ storyline })
    : Response.json(
        { error: "Every chapter and topic needs its details filled in." },
        { status: 400 },
      );
}

export async function DELETE(_request: Request, { params }: Context) {
  const deleted = await deleteStoryline((await params).id);
  return deleted ? Response.json({ deleted: true }) : notFound();
}
