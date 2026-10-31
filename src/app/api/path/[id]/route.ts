import { connection } from "next/server";
import { getStoryline } from "@/lib/games/storylineStore";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  await connection();
  const storyline = await getStoryline((await params).id);
  if (!storyline?.published) {
    return Response.json({ error: "This course isn't available." }, { status: 404 });
  }

  return Response.json({
    path: {
      title: storyline.title,
      premise: storyline.premise,
      ending: storyline.ending,
      hero: storyline.hero,
      chapters: storyline.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        story: chapter.story,
        topics: chapter.topics.map((topic) => ({
          id: topic.id,
          title: topic.title,
          storyBeat: topic.storyBeat,
          gameId: topic.gameId,
        })),
      })),
    },
  });
}
