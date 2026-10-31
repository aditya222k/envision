// Renders one game per theme and mechanic with no model, then screenshots each.
// Usage: npm run preview:worlds -- <output folder>
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { renderGame } from "../src/lib/games/render.ts";
import { MECHANICS, THEMES } from "../src/lib/games/spec.ts";

const outputDir = process.argv[2] ?? ".playwright-mcp/worlds";
await mkdir(outputDir, { recursive: true });

const CHARACTERS = {
  jungle: [{ name: "Explorer", emoji: "🐒" }, { name: "Hunter", emoji: "🐅" }],
  space: [{ name: "Pilot", emoji: "🧑‍🚀" }, { name: "Alien", emoji: "👾" }],
  ocean: [{ name: "Diver", emoji: "🐢" }, { name: "Shark", emoji: "🦈" }],
  city: [{ name: "Courier", emoji: "🛹" }, { name: "Robot", emoji: "🤖" }],
  castle: [{ name: "Knight", emoji: "🛡️" }, { name: "Dragon", emoji: "🐉" }],
  lab: [{ name: "Scientist", emoji: "🧑‍🔬" }, { name: "Mutant", emoji: "🦠" }],
};

function makeSpec(theme, mechanic) {
  const [player, challenger] = CHARACTERS[theme];
  const round = (index) => ({
    kind: "choice",
    prompt: `Question ${index + 1}: what is ${index + 2} times 3?`,
    choices: [`${(index + 2) * 3}`, "1", "2", "4000"],
    answerIndex: 0,
    explanation: "Multiply the two numbers.",
  });
  return {
    title: `${theme} ${mechanic} preview`,
    learningGoal: "Practice multiplication.",
    mechanic,
    theme,
    player,
    challenger,
    story: { intro: "Your adventure starts here.", win: "You made it.", lose: "Try again." },
    rounds: Array.from({ length: 5 }, (_, index) => round(index)),
  };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
let failures = 0;

for (const [index, theme] of THEMES.entries()) {
  const mechanic = MECHANICS[index % MECHANICS.length];
  const page = await browser.newPage({ viewport: { width: 1040, height: 620 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.setContent(await renderGame(makeSpec(theme, mechanic)));
  await page.locator("#world canvas").waitFor();
  await page.waitForTimeout(1200);
  await page.locator(".start").click();
  await page.waitForTimeout(500);
  await page.locator(".choice").first().waitFor();

  await page.evaluate(() => {
    const correct = [...document.querySelectorAll(".choice")].find((item) =>
      ["6", "9", "12", "15", "18"].includes(item.textContent),
    );
    correct.click();
  });
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(outputDir, `${theme}.png`) });

  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const started = performance.now();
        function count() {
          frames += 1;
          if (performance.now() - started < 2000) requestAnimationFrame(count);
          else resolve(Math.round(frames / 2));
        }
        requestAnimationFrame(count);
      }),
  );
  console.log(`${errors.length ? "FAIL" : "PASS"} ${theme} ${mechanic} ${fps}fps ${errors.slice(0, 2).join("; ")}`);
  if (errors.length) failures += 1;
  await page.close();
}

await browser.close();
process.exitCode = failures ? 1 : 0;
