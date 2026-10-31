import { connection } from "next/server";
import { getPublishedHtml } from "@/lib/games/store";

type Context = { params: Promise<{ id: string }> };

const UNAVAILABLE_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Game not available</title></head>
<body style="font: 18px/1.5 system-ui, sans-serif; padding: 32px;">
<h1>This game isn't available</h1>
<p>Ask your teacher for a new link.</p>
</body>
</html>`;

function htmlResponse(html: string, status: number) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "sandbox allow-scripts",
    },
  });
}

export async function GET(_request: Request, { params }: Context) {
  await connection();
  const html = await getPublishedHtml((await params).id);
  return html ? htmlResponse(html, 200) : htmlResponse(UNAVAILABLE_PAGE, 404);
}
