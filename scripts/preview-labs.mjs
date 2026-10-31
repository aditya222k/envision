// Runs each lab kit with no model, tries it with a real mouse, and takes a screenshot.
// Usage: npm run preview:labs -- <output folder>
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { renderGame } from "../src/lib/games/render.ts";

const outputDir = process.argv[2] ?? ".playwright-mcp/labs";
await mkdir(outputDir, { recursive: true });

const base = {
  mechanic: "journey",
  theme: "space",
  player: { name: "You", emoji: "🧑‍🔬" },
  challenger: { name: "The lab", emoji: "🧪" },
  rounds: [],
};

const gravity = {
  ...base,
  title: "Build a Solar System",
  learningGoal: "See how mass and distance shape orbits.",
  story: { intro: "Add planets and moons, and watch gravity work.", win: "You finished every mission.", lose: "" },
  lab: {
    kit: "bodies",
    force: "gravity",
    bodyTypes: [
      { name: "Star", mass: 800, color: "#ffc14d", charge: 0 },
      { name: "Planet", mass: 30, color: "#4da3ff", charge: 0 },
      { name: "Moon", mass: 4, color: "#c9d1d9", charge: 0 },
    ],
    missions: [
      { goal: "orbit", text: "Keep a planet in orbit." },
      { goal: "two_orbits", text: "Get two objects orbiting at once." },
      { goal: "collide", text: "Make two objects collide." },
    ],
    tips: ["Make the star much bigger. What happens to the orbit?"],
  },
};

const predators = {
  ...base,
  title: "Foxes and Rabbits",
  learningGoal: "See how predators and prey affect each other.",
  story: { intro: "Balance the meadow so both animals survive.", win: "You finished every mission.", lose: "" },
  lab: {
    kit: "systems",
    variables: [
      { id: "rabbits", label: "Rabbits", start: 60, max: 300 },
      { id: "foxes", label: "Foxes", start: 15, max: 100 },
    ],
    controls: [
      { id: "birth", label: "Rabbit birth rate", value: 0.6, min: 0, max: 2 },
      { id: "hunt", label: "Hunting success", value: 0.02, min: 0, max: 0.1 },
    ],
    rules: [
      { variable: "rabbits", change: "birth * rabbits - hunt * rabbits * foxes" },
      { variable: "foxes", change: "0.01 * rabbits * foxes - 0.5 * foxes" },
    ],
    missions: [
      { variable: "rabbits", atLeast: 1, atMost: 300, holdSeconds: 3, text: "Keep rabbits alive for 3 seconds." },
    ],
    tips: ["Raise the birth rate and watch the foxes respond."],
  },
};

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function open(spec, name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setContent(await renderGame(spec));
  await page.locator("#lab").waitFor();
  return { page, errors, name };
}

const space = await open(gravity, "gravity");
const box = await space.page.locator("#lab").boundingBox();
await space.page.getByRole("button", { name: "Moon" }).click();
await space.page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.5);
await space.page.waitForTimeout(500);
await space.page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
const sizeSlider = space.page.getByLabel(/Size of Star/);
console.log("object added:", await space.page.evaluate(() => window.envisionLab.bodies().length) === 3);
console.log("size control shown:", (await sizeSlider.count()) === 1);
await space.page.waitForTimeout(9500);
console.log("missions done:", await space.page.locator(".missions .done").allInnerTexts());
await space.page.screenshot({ path: path.join(outputDir, "gravity.png") });
console.log("gravity errors:", space.errors.length, space.errors.slice(0, 2));

const meadow = await open(predators, "systems");
const start = await meadow.page.evaluate(() => document.querySelector("canvas").toDataURL().length);
await meadow.page.waitForTimeout(3600);
console.log("graph drawn:", (await meadow.page.evaluate(() => document.querySelector("canvas").toDataURL().length)) !== start);
console.log("systems missions done:", await meadow.page.locator(".missions .done").count());
await meadow.page.screenshot({ path: path.join(outputDir, "systems.png") });
console.log("systems errors:", meadow.errors.length, meadow.errors.slice(0, 2));

const decision = {
  ...base,
  title: "Citizens of 1789",
  learningGoal: "Understand the choices people faced in the French Revolution.",
  theme: "castle",
  story: { intro: "Paris is hungry, and you must act.", win: "You did it.", lose: "" },
  lab: {
    kit: "decide",
    meters: [{ id: "trust", label: "Public trust", start: 50 }],
    scenes: [
      { id: "one", text: "Bread prices double. What do you do?", choices: [
        { text: "Join the march", consequence: "The crowd grows.", next: "two", meterId: "trust", meterChange: 20 },
        { text: "Stay home", consequence: "Anger spreads without you.", next: "two", meterId: "trust", meterChange: -10 },
      ] },
      { id: "two", text: "The crowd reaches the Bastille.", choices: [
        { text: "Storm it", consequence: "It falls.", next: "end", meterId: "trust", meterChange: 20 },
        { text: "Negotiate", consequence: "Talks stall.", next: "end", meterId: "trust", meterChange: -5 },
      ] },
    ],
    endings: [{ meter: "trust", atLeast: 70, text: "The people follow your lead." }],
    defaultEnding: "History moves on without you.",
  },
};

const arrange = {
  ...base,
  title: "Water Cycle Workshop",
  learningGoal: "Learn the stages of the water cycle.",
  theme: "ocean",
  story: { intro: "Help a raindrop on its journey.", win: "You mapped the cycle.", lose: "" },
  lab: {
    kit: "arrange",
    activities: [
      { kind: "order", instruction: "Put the stages in order.", explanation: "Water rises, cools, falls and gathers.", groups: [], items: [
        { text: "Evaporation", group: "" }, { text: "Condensation", group: "" }, { text: "Precipitation", group: "" }, { text: "Collection", group: "" },
      ] },
      { kind: "sort", instruction: "Sort these by where they happen.", explanation: "Clouds form in the sky, while rivers and lakes hold water on land.", groups: ["Sky", "Land"], items: [
        { text: "Clouds", group: "Sky" }, { text: "Rain", group: "Sky" }, { text: "Rivers", group: "Land" }, { text: "Lakes", group: "Land" },
      ] },
    ],
  },
};

async function openGame(spec) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setContent(await renderGame(spec));
  await page.locator("#world canvas").waitFor();
  await page.locator(".start").click();
  return { page, errors };
}

const story = await openGame(decision);
await story.page.getByRole("button", { name: "Join the march" }).click();
await story.page.waitForTimeout(500);
await story.page.screenshot({ path: path.join(outputDir, "decide.png") });
await story.page.locator(".next").click();
await story.page.getByRole("button", { name: "Storm it" }).click();
await story.page.locator(".next").click();
console.log("decide ending:", await story.page.locator(".end + p").innerText());
console.log("decide errors:", story.errors.length, story.errors.slice(0, 2));

const workshop = await openGame(arrange);
const answer = arrange.lab.activities[0].items.map((item) => item.text);
await workshop.page.locator(".check").click();
console.log("wrong order told:", await workshop.page.locator("p.feedback").innerText());
for (let target = 0; target < answer.length; target++) {
  for (let i = 0; i < answer.length; i++) {
    const rows = await workshop.page.locator(".order-text").allInnerTexts();
    const at = rows.indexOf(answer[target]);
    if (at === target) break;
    await workshop.page.getByRole("button", { name: `Move ${answer[target]} up` }).click();
  }
}
await workshop.page.locator(".check").click();
await workshop.page.locator(".next").click();
const sortItems = arrange.lab.activities[1].items;
for (const item of sortItems) {
  await workshop.page.getByRole("button", { name: item.text, exact: true }).click();
  await workshop.page.locator(".bin").filter({ hasText: item.group }).click();
}
await workshop.page.screenshot({ path: path.join(outputDir, "arrange.png") });
await workshop.page.locator(".check").click();
await workshop.page.locator(".next").click();
console.log("arrange finished:", await workshop.page.locator(".end").getAttribute("data-result"));
console.log("arrange errors:", workshop.errors.length, workshop.errors.slice(0, 2));

await browser.close();
