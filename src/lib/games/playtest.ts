import { createHash } from "node:crypto";

const VIEWPORT = { width: 1000, height: 700 };
const SETTLE_MS = 1500;
const MIN_WINDOW_USE = 0.9;

export type PlaytestResult = {
  problems: string[];
  wasSkipped: boolean;
};

// Plays any game the way a student would, so it needs no knowledge of the
// subject. It only proves the game works, not that its content is right.
export async function playtest(
  html: string,
  options: { is3d?: boolean } = {},
): Promise<PlaytestResult> {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return { problems: [], wasSkipped: true };
  }

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return { problems: [], wasSkipped: true };
  }

  const problems: string[] = [];
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    const view = async () =>
      createHash("sha1").update(await page.screenshot()).digest("hex");

    await page.setContent(html);
    await page.waitForTimeout(SETTLE_MS);

    const content = await page.evaluate(() => ({
      text: document.body?.innerText.trim().length ?? 0,
      drawn: document.querySelectorAll("canvas, svg").length,
      controls: document.querySelectorAll(
        "button, input, select, [draggable], canvas, svg",
      ).length,
    }));
    if (content.text < 20 && content.drawn === 0) {
      problems.push("The page is blank. Nothing appears when the game opens.");
    }
    if (content.controls === 0) {
      problems.push("There is nothing a student can interact with.");
    }

    if (options.is3d) {
      const world = await page.evaluate(() => {
        const stage = (window as unknown as {
          envision3d?: { objects: () => number; controls: () => number };
        }).envision3d;
        return { objects: stage?.objects() ?? 0, controls: stage?.controls() ?? 0 };
      });
      if (world.objects < 3) {
        problems.push(
          `The 3D world only has ${world.objects} objects. Build a real scene with env.add, using at least 3 objects.`,
        );
      }
      if (world.controls === 0) {
        problems.push(
          "Students can't do anything in the world. Add env.slider, env.button, or onPick on objects.",
        );
      }
    }

    const used = await page.evaluate(() => {
      const boxes = [...document.body.querySelectorAll("*")]
        .map((element) => ({ element, box: element.getBoundingClientRect() }))
        .filter(
          ({ element, box }) =>
            box.width > 0 &&
            box.height > 0 &&
            element.tagName !== "SCRIPT" &&
            element.tagName !== "STYLE",
        )
        .map(({ box }) => box);
      if (boxes.length === 0) {
        return { width: 0, height: 0 };
      }
      return {
        width:
          (Math.max(...boxes.map((box) => box.right)) -
            Math.min(...boxes.map((box) => box.left))) /
          window.innerWidth,
        height:
          (Math.max(...boxes.map((box) => box.bottom)) -
            Math.min(...boxes.map((box) => box.top))) /
          window.innerHeight,
      };
    });
    if (used.width < MIN_WINDOW_USE || used.height < MIN_WINDOW_USE) {
      problems.push(
        `The game only fills ${Math.round(used.width * 100)}% of the window width and ${Math.round(used.height * 100)}% of its height. It must fill the whole window, with no centered card.`,
      );
    }

    const before = await view();
    const buttons = page.locator("button:visible");
    for (let index = 0; index < Math.min(await buttons.count(), 3); index++) {
      await buttons.nth(index).click({ timeout: 1000 }).catch(() => {});
    }

    const { width, height } = VIEWPORT;
    await page.mouse.move(width * 0.3, height * 0.4);
    await page.mouse.down();
    await page.mouse.move(width * 0.6, height * 0.6, { steps: 8 });
    await page.mouse.up();
    await page.mouse.click(width * 0.5, height * 0.5);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await page.waitForTimeout(800);

    if ((await view()) === before) {
      problems.push(
        "Nothing on screen changed after clicking, dragging and pressing keys. Student actions must visibly change the game.",
      );
    }

    errors
      .slice(0, 5)
      .forEach((error) => problems.push(`The browser reported: ${error}`));
  } catch (error) {
    problems.push(`The game could not be played: ${(error as Error).message}`);
  } finally {
    await browser.close();
  }

  return { problems, wasSkipped: false };
}
