// Builds each example game through the dev server, then plays it in Chrome.
// Usage: npm run dev, then npm run eval:games -- [number of games]
import http from "node:http";
import { chromium } from "playwright";
import { EXAMPLE_GAMES } from "../src/lib/games/examples.ts";

const BASE_URL = process.env.EVAL_BASE_URL ?? "http://localhost:3000";
// Ideas that open a ready-made explorer have no prompt to build.
const PROMPT_IDEAS = EXAMPLE_GAMES.filter((example) => example.prompt);
const limit = Number(process.argv[2]) || PROMPT_IDEAS.length;

// Uses node:http because fetch gives up after five minutes without a response.
function requestGame(prompt) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      `${BASE_URL}/api/generate`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => {
          try {
            const events = body.trim().split("\n").map((line) => JSON.parse(line));
            const last = events[events.length - 1];
            resolve({
              status: last.type === "result" ? 200 : (last.status ?? response.statusCode),
              data: last.type === "result" ? { ...last, text: last.game.html } : last,
            });
          } catch {
            resolve({
              status: response.statusCode,
              data: { error: `Server returned ${response.statusCode}` },
            });
          }
        });
      },
    );
    request.on("error", reject);
    request.end(JSON.stringify({ prompt, provider: "ollama" }));
  });
}

function click(page, selector, text) {
  return page.evaluate(
    ([selector, text]) => {
      const node = [...document.querySelectorAll(selector)].find(
        (item) => !item.disabled && (text === null || item.textContent === text),
      );
      if (!node) throw new Error(`No ${selector} button for: ${text}`);
      node.click();
    },
    [selector, text],
  );
}

async function play(page, spec, answerCorrectly) {
  await page.locator(".start, .again").first().click();

  for (let step = 0; step < spec.rounds.length + 1; step++) {
    if (await page.locator(".end").count()) break;

    const prompt = await page.locator("h2").innerText();
    const round = spec.rounds.find((item) => item.prompt.trim() === prompt.trim());
    if (!round) throw new Error(`Unknown round: ${prompt}`);

    if (round.kind === "choice") {
      const answer = round.choices[round.answerIndex];
      const wrong = round.choices.find((choice) => choice !== answer);
      await click(page, ".choice", answerCorrectly ? answer : wrong);
    } else {
      if (!answerCorrectly) {
        await click(page, ".pair-left", round.pairs[0].left);
        await click(page, ".pair-right", round.pairs[1].right);
      }
      for (const pair of round.pairs) {
        await click(page, ".pair-left", pair.left);
        await click(page, ".pair-right", pair.right);
      }
    }
    await page.locator(".next").click();
  }

  return page.locator(".end").getAttribute("data-result", { timeout: 3000 });
}

async function evaluate(browser, example) {
  const started = Date.now();
  let status = 0;
  let data = {};
  try {
    ({ status, data } = await requestGame(example.prompt));
  } catch (error) {
    data = { error: error.message };
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  if (status !== 200) {
    return { title: example.title, seconds, passed: false, problem: data.error };
  }

  const { spec } = data;
  const page = await browser.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  const problems = [];
  try {
    await page.setContent(data.text);
    const best = await play(page, spec, true);
    if (best !== "win") problems.push("all correct answers didn't win");
    const worst = await play(page, spec, false);
    const expected = spec.mechanic === "beat-the-clock" ? "win" : "lose";
    if (worst !== expected) problems.push(`all wrong answers gave ${worst}`);
  } catch (error) {
    problems.push(error.message.split("\n")[0]);
  }
  await page.close();
  problems.push(...browserErrors);

  return {
    title: example.title,
    seconds,
    passed: problems.length === 0,
    problem: problems.join("; "),
    gameTitle: spec.title,
    mechanic: spec.mechanic,
    theme: spec.theme,
    rounds: spec.rounds.map((round) => round.kind[0]).join(""),
    attempts: data.attempts,
    disputed: data.disputedRounds,
  };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
for (const example of PROMPT_IDEAS.slice(0, limit)) {
  const result = await evaluate(browser, example);
  results.push(result);
  console.log(
    `${result.passed ? "PASS" : "FAIL"} ${result.seconds}s ${result.title} | ${result.mechanic ?? "-"} ${result.theme ?? "-"} ${result.rounds ?? ""} attempts=${result.attempts ?? "-"} disputed=${result.disputed ?? "-"} | ${result.gameTitle ?? ""} ${result.problem ?? ""}`,
  );
}
await browser.close();

const built = results.filter((result) => result.mechanic);
const average = Math.round(
  results.reduce((total, result) => total + result.seconds, 0) / results.length,
);
console.log(
  `\n${results.filter((result) => result.passed).length} of ${results.length} passed, ${average}s average`,
);
console.log(`mechanics: ${[...new Set(built.map((result) => result.mechanic))].join(", ")}`);
console.log(`themes: ${[...new Set(built.map((result) => result.theme))].join(", ")}`);
process.exitCode = results.every((result) => result.passed) ? 0 : 1;
