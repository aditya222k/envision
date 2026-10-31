import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GameSpec, Mechanic, Theme } from "./spec";

const THEME_STYLES: Record<
  Theme,
  { sky: string; panel: string; ink: string; accent: string; onAccent: string }
> = {
  jungle: {
    sky: "#1f6b3a",
    panel: "#f2f8e9",
    ink: "#16301f",
    accent: "#e8a317",
    onAccent: "#16301f",
  },
  space: {
    sky: "#1b1a4b",
    panel: "#eeeeff",
    ink: "#17163f",
    accent: "#6a4cff",
    onAccent: "#ffffff",
  },
  ocean: {
    sky: "#0b6e8f",
    panel: "#e8f7fb",
    ink: "#0a3442",
    accent: "#ff7a59",
    onAccent: "#0a3442",
  },
  city: {
    sky: "#3b4252",
    panel: "#f4f4f6",
    ink: "#20242e",
    accent: "#ffc72c",
    onAccent: "#20242e",
  },
  castle: {
    sky: "#5a2a6d",
    panel: "#f8f0e3",
    ink: "#311738",
    accent: "#b3261e",
    onAccent: "#ffffff",
  },
  lab: {
    sky: "#0f7c7c",
    panel: "#eafafa",
    ink: "#083a3a",
    accent: "#d6336c",
    onAccent: "#ffffff",
  },
};

const HOW_TO_PLAY: Record<Mechanic, string> = {
  journey:
    "Answer correctly to move forward. You have three lives, and each wrong answer costs one.",
  "beat-the-clock":
    "Finish every round before the clock reaches zero. Each wrong answer costs 5 seconds.",
  "boss-battle":
    "Each correct answer damages your challenger. Each wrong answer costs one of your three lives.",
};

const STYLES = `
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  display: grid; gap: 12px; margin: 0; padding: 12px; background: var(--ink); color: var(--ink);
  font: 18px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
#world { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 12px; background: var(--sky); }
#world canvas { display: block; }
main { min-width: 0; padding: 20px; border-radius: 12px; background: var(--panel); }
@media (min-width: 820px) {
  body { grid-template-columns: minmax(0, 1fr) 360px; height: 100vh; }
  #world { aspect-ratio: auto; height: calc(100vh - 24px); }
  main { height: calc(100vh - 24px); overflow-y: auto; }
}
h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.15; }
h2 { margin: 0 0 14px; font-size: 20px; line-height: 1.3; }
p { margin: 0 0 16px; }
button {
  width: 100%; min-height: 48px; padding: 10px 14px; cursor: pointer;
  border: 3px solid var(--ink); border-radius: 8px; background: #fff;
  color: var(--ink); font: inherit; font-weight: 700; text-align: left;
}
button:hover:enabled { background: var(--panel); }
button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
button:disabled { cursor: default; }
.primary { background: var(--accent); color: var(--on-accent); text-align: center; }
.primary:hover:enabled { background: var(--accent); }
.characters { display: flex; justify-content: space-between; gap: 12px; font-weight: 700; }
.stack { display: grid; gap: 10px; }
.columns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.hud { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; font-weight: 700; }
.meter { height: 18px; margin-bottom: 16px; overflow: hidden; border: 3px solid var(--ink); border-radius: 6px; background: #fff; }
.meter span { display: block; height: 100%; background: var(--accent); transition: width 250ms ease; }
.correct { background: #bfeccb; }
.wrong { background: #f8c9c4; }
.selected { box-shadow: inset 0 0 0 3px var(--accent); }
.feedback { margin-top: 16px; }
.order-list { margin: 0 0 14px; padding: 0; list-style: none; }
.order-item { display: flex; align-items: center; gap: 8px; padding: 8px; border: 3px solid var(--ink); border-radius: 8px; background: #fff; cursor: grab; touch-action: none; user-select: none; transition: transform 180ms ease; }
.dragging { position: relative; z-index: 10; transition: none !important; box-shadow: 0 12px 24px rgba(0, 0, 0, 0.35); cursor: grabbing; }
.drop-target { outline: 3px solid var(--accent); outline-offset: 2px; }
.order-text { flex: 1; font-weight: 700; }
.small { width: auto; min-height: 36px; padding: 2px 10px; }
.palette { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.token { width: auto; min-height: 40px; touch-action: none; }
.token[aria-pressed="true"] { background: var(--accent); color: var(--on-accent); }
.bin { display: flex; flex-direction: column; gap: 4px; min-height: 110px; margin-bottom: 12px; }
@media (prefers-reduced-motion: reduce) { .order-item { transition: none; } }
.placed { font-weight: 400; }
@media (prefers-reduced-motion: reduce) { .meter span { transition: none; } }
`;

const RUNTIME = `
(function () {
  var spec = JSON.parse(document.getElementById("game-data").textContent);
  var howToPlay = document.getElementById("how-to-play").textContent;
  var root = document.getElementById("game");
  var MAX_LIVES = 3, SECONDS_PER_ROUND = 25, TIME_PENALTY = 5, BOSS_SHARE = 0.7;
  var state, timer, world;

  // A graphics failure shouldn't stop students from playing the rounds.
  try {
    world = window.createWorld("world", spec);
  } catch (error) {
    console.warn("World graphics are unavailable.", error);
    world = { send: function () {} };
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, className, onClick) {
    var node = make("button", className, text);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  function shuffle(items) {
    var result = items.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var held = result[i];
      result[i] = result[j];
      result[j] = held;
    }
    return result;
  }

  function stopTimer() {
    clearInterval(timer);
  }

  function startTimer() {
    if (spec.mechanic !== "beat-the-clock") return;
    timer = setInterval(function () {
      state.seconds -= 1;
      var clock = document.getElementById("clock");
      if (clock) clock.textContent = "Time: " + state.seconds + "s";
      world.send("time", { remaining: state.seconds / (spec.rounds.length * SECONDS_PER_ROUND) });
      if (state.seconds <= 0) finish(false);
    }, 1000);
  }

  function hud() {
    var box = make("div");
    var row = make("div", "hud");
    row.append(make("span", "", "Round " + (state.index + 1) + " of " + spec.rounds.length));
    row.append(make("span", "", "Score: " + state.score));

    if (spec.mechanic === "beat-the-clock") {
      var clock = make("span", "", "Time: " + state.seconds + "s");
      clock.id = "clock";
      row.append(clock);
      box.append(row);
      return box;
    }

    row.append(make("span", "", "Lives: " + "\\u2764\\uFE0F".repeat(state.lives)));
    box.append(row);

    if (spec.mechanic === "boss-battle") {
      var meter = make("div", "meter");
      var fill = make("span");
      fill.style.width = (state.health / state.maxHealth) * 100 + "%";
      meter.append(fill);
      box.append(make("div", "", spec.challenger.emoji + " " + spec.challenger.name), meter);
    }
    return box;
  }

  function show() {
    root.replaceChildren.apply(root, arguments);
    window.scrollTo(0, 0);
  }

  function intro() {
    stopTimer();
    var characters = make("div", "characters");
    characters.append(
      make("span", "", spec.player.emoji + " " + spec.player.name),
      make("span", "", spec.challenger.emoji + " " + spec.challenger.name)
    );
    show(
      make("h1", "", spec.title),
      make("p", "", spec.story.intro),
      characters,
      make("p", "feedback", howToPlay),
      button("Start game", "primary start", start)
    );
  }

  function start() {
    var hits = Math.ceil(spec.rounds.length * BOSS_SHARE);
    state = {
      index: 0,
      score: 0,
      lives: MAX_LIVES,
      seconds: spec.rounds.length * SECONDS_PER_ROUND,
      health: hits,
      maxHealth: hits
    };
    world.send("reset");
    round();
    startTimer();
  }

  function round() {
    var current = spec.rounds[state.index];
    if (current.kind === "match") {
      matchRound(current);
    } else {
      choiceRound(current);
    }
  }

  function choiceRound(current) {
    var list = make("div", "stack");
    var correctChoice = current.choices[current.answerIndex];
    shuffle(current.choices).forEach(function (choice) {
      list.append(
        button(choice, "choice", function (event) {
          var isCorrect = choice === correctChoice;
          Array.prototype.forEach.call(list.children, function (item) {
            item.disabled = true;
            if (item.textContent === correctChoice) item.classList.add("correct");
          });
          if (!isCorrect) event.currentTarget.classList.add("wrong");
          answered(isCorrect, current);
        })
      );
    });
    show(hud(), make("h2", "", current.prompt), list);
  }

  function matchRound(current) {
    var columns = make("div", "columns");
    var lefts = make("div", "stack");
    var rights = make("div", "stack");
    var selected = null, mistakes = 0, matched = 0;

    shuffle(current.pairs).forEach(function (pair) {
      lefts.append(
        button(pair.left, "pair-left", function (event) {
          if (selected) selected.node.classList.remove("selected");
          selected = { node: event.currentTarget, pair: pair };
          selected.node.classList.add("selected");
        })
      );
    });

    shuffle(current.pairs).forEach(function (pair) {
      rights.append(
        button(pair.right, "pair-right", function (event) {
          if (!selected) return;
          var node = event.currentTarget;
          if (selected.pair.right === pair.right) {
            selected.node.classList.remove("selected");
            selected.node.classList.add("correct");
            node.classList.add("correct");
            selected.node.disabled = true;
            node.disabled = true;
            selected = null;
            matched += 1;
            if (matched === current.pairs.length) answered(mistakes === 0, current);
          } else {
            mistakes += 1;
            node.classList.add("wrong");
            setTimeout(function () { node.classList.remove("wrong"); }, 500);
          }
        })
      );
    });

    columns.append(lefts, rights);
    show(hud(), make("h2", "", current.prompt), columns);
  }

  function answered(isCorrect, current) {
    if (isCorrect) {
      state.score += 1;
      state.health = Math.max(state.health - 1, 0);
    } else if (spec.mechanic === "beat-the-clock") {
      state.seconds = Math.max(state.seconds - TIME_PENALTY, 0);
    } else {
      state.lives -= 1;
    }
    world.send(isCorrect ? "correct" : "wrong", { progress: state.score / spec.rounds.length });

    var box = make("div", "feedback");
    box.setAttribute("role", "status");
    box.append(make("p", "", (isCorrect ? "Correct. " : "Not this time. ") + current.explanation));
    box.append(button(nextLabel(), "primary next", next));
    root.append(box);
  }

  function isLost() {
    return state.lives <= 0 || (spec.mechanic === "beat-the-clock" && state.seconds <= 0);
  }

  function isWon() {
    return spec.mechanic === "boss-battle" && state.health <= 0;
  }

  function nextLabel() {
    var isLast = state.index + 1 >= spec.rounds.length;
    return isLost() || isWon() || isLast ? "See results" : "Next round";
  }

  function next() {
    if (isLost()) return finish(false);
    if (isWon()) return finish(true);
    state.index += 1;
    if (state.index >= spec.rounds.length) {
      return finish(spec.mechanic !== "boss-battle");
    }
    round();
  }

  function finish(won) {
    stopTimer();
    world.send("finish", { won: won });
    window.parent.postMessage({ type: "envision-finished", won: won }, "*");
    var end = make("h1", "end", won ? "You won!" : "Game over");
    end.dataset.result = won ? "win" : "lose";
    show(
      end,
      make("p", "", won ? spec.story.win : spec.story.lose),
      make("p", "", "You got " + state.score + " of " + spec.rounds.length + " rounds right."),
      button("Play again", "primary again", start)
    );
  }

  intro();
})();
`;

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineScript(code: string) {
  return code.replace(/<\/script/gi, "<\\/script");
}

const LAB_STYLES = `
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  display: grid; gap: 12px; padding: 12px; background: var(--ink); color: var(--ink);
  font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
canvas { display: block; width: 100%; height: 56vh; border-radius: 12px; background: #070a1f; touch-action: none; cursor: crosshair; }
#panel { min-width: 0; padding: 18px; border-radius: 12px; background: var(--panel); }
h1 { margin: 0 0 6px; font-size: 24px; line-height: 1.15; }
h2 { margin: 16px 0 6px; font-size: 17px; }
p { margin: 0 0 8px; }
button {
  min-height: 40px; padding: 6px 12px; cursor: pointer; border: 3px solid var(--ink);
  border-radius: 8px; background: #fff; color: var(--ink); font: inherit; font-weight: 700;
}
button:focus-visible, input:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
button[aria-pressed="true"] { background: var(--accent); color: var(--on-accent); }
.palette { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.hint { font-size: 14px; }
.control { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; font-weight: 700; }
.control input { width: 100%; }
.selection { margin-bottom: 8px; }
.missions, .tips { margin: 0; padding-left: 20px; }
.missions li { margin-bottom: 4px; }
.missions .done { font-weight: 700; color: #177a52; }
.win { margin-top: 12px; padding: 10px; border-radius: 8px; background: var(--accent); color: var(--on-accent); font-weight: 700; }
@media (min-width: 820px) {
  body { grid-template-columns: minmax(0, 1fr) 360px; height: 100vh; }
  canvas { height: calc(100vh - 24px); }
  #panel { height: calc(100vh - 24px); overflow-y: auto; }
}
`;

async function renderLab(spec: GameSpec) {
  const theme = THEME_STYLES[spec.theme];
  const data = JSON.stringify(spec).replace(/</g, "\\u003c");
  const runtime = await readFile(
    path.join(process.cwd(), "src/lib/games/engine/lab.js"),
    "utf8",
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<title>${escapeHtml(spec.title)}</title>
<style>:root { --sky: ${theme.sky}; --panel: ${theme.panel}; --ink: ${theme.ink}; --accent: ${theme.accent}; --on-accent: ${theme.onAccent}; }${LAB_STYLES}</style>
</head>
<body>
<canvas id="lab" width="900" height="600" aria-label="${escapeHtml(spec.title)} simulation"></canvas>
<aside id="panel"></aside>
<script type="application/json" id="game-data">${data}</script>
<script>${inlineScript(runtime)}</script>
</body>
</html>`;
}

// The game runs sandboxed, and this also stops it reaching the network.
export function lockDown(html: string) {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:">
<style>html, body { width: 100%; min-height: 100%; margin: 0 !important; padding: 0 !important; box-sizing: border-box; } body > :not(script):not(style) { box-sizing: border-box; width: 100%; max-width: none !important; border-radius: 0; }</style>`;
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (head) => `${head}\n${policy}`)
    : `${policy}\n${html}`;
}

export async function renderGame(spec: GameSpec) {
  if (spec.custom) {
    return lockDown(spec.custom.html);
  }

  if (spec.lab?.kit === "bodies" || spec.lab?.kit === "systems") {
    return renderLab(spec);
  }

  const theme = THEME_STYLES[spec.theme];
  const data = JSON.stringify(spec).replace(/</g, "\\u003c");
  const root = process.cwd();
  const [phaser, world, activities] = await Promise.all([
    readFile(path.join(root, "node_modules/phaser/dist/phaser.min.js"), "utf8"),
    readFile(path.join(root, "src/lib/games/engine/world.js"), "utf8"),
    spec.lab
      ? readFile(path.join(root, "src/lib/games/engine/activities.js"), "utf8")
      : RUNTIME,
  ]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:">
<title>${escapeHtml(spec.title)}</title>
<style>:root { --sky: ${theme.sky}; --panel: ${theme.panel}; --ink: ${theme.ink}; --accent: ${theme.accent}; --on-accent: ${theme.onAccent}; }${STYLES}</style>
</head>
<body>
<div id="world"></div>
<main id="game"></main>
<template id="how-to-play">${escapeHtml(HOW_TO_PLAY[spec.mechanic])}</template>
<script type="application/json" id="game-data">${data}</script>
<script>${inlineScript(phaser)}</script>
<script>${inlineScript(world)}</script>
<script>${inlineScript(activities)}</script>
</body>
</html>`;
}
