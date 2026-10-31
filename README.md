# Envision

Envision lets teachers build learning games for grade 8 and high school students. A teacher describes the game in plain words, Envision builds it, and students play it in the browser. Teachers can change a game by describing what to change, string games together into a storyline, and publish to their class with a link.

## What you can do

- **Build a game from a prompt.** Describe what students should learn and how they should play, or start from one of the example ideas grouped by subject. A companion suggests a type of game and asks a few quick questions with options before it builds.
- **Choose from five types of game.** Quiz adventure, Physics lab (gravity and electric forces), Simulation lab (sliders and a live graph), Decision story (a branching story with consequences) and Arrange and sort.
- **Watch it build.** The title, characters, world and questions appear as the model writes them, with a progress bar and elapsed time. **Stop building** cancels the run at any point.
- **Review doubtful questions.** When Envision can't confirm an answer, the question goes to a review list, where you pick the right answer and add it, or leave it out.
- **Change a game by describing it.** For example, "Set it in space" or "Make question 3 harder". Only what you ask for changes, each change is a new version, and **Undo last change** goes back.
- **Keep your games.** Every game is saved with its version history. **Your games** lists them for opening, renaming and deleting.
- **Publish to students.** Publishing saves a separate copy at `/play/<id>`, so later edits don't reach students until you publish again.
- **Plan a storyline.** At **Storylines**, turn a subject into chapters and levels, where each level is one game with the same hero running through it. Drag the story notes on each chapter's board, and **Build all games** builds the missing levels one at a time. Publishing a storyline gives students one link at `/path/<id>`, where winning a game unlocks the next.

## Getting started

You need [Node.js](https://nodejs.org) LTS.

```bash
git clone https://github.com/aditya222k/envision.git
cd envision
npm install
npm run dev
```

Then open http://localhost:3000.

To build games you also need an AI provider. The quickest is a local [Ollama](https://ollama.com) model:

```bash
ollama serve
ollama pull gemma4:12b
```

Then open **AI settings** in the navigation bar and set the Ollama model to `gemma4:12b`.

## AI providers

Envision can use Claude, OpenAI, Gemini or a local Ollama host. Choose one from the dropdown on the home page.

| Provider | Status |
| --- | --- |
| Ollama | Works. Uses `gemma4:12b`, and `gemma4:e2b` works on smaller machines. |
| Claude, OpenAI, Gemini | Not built yet. They return "not implemented". |

To configure a provider, do one of the following:

- **Local development:** open `/settings` and enter the API endpoint, key and model. These are saved on your machine in `.envision/providers.json`, which git ignores. Saved keys are only ever shown masked.
- **Deployments:** copy `.env.example` to `.env.local`, or set the same values as environment variables. The `/settings` page is read-only in production builds because there's no login yet.

`LLM_PROVIDER` only applies to API requests that don't name a provider.

## How a game is built

Before designing, the model picks search terms and Envision reads the matching Wikipedia introductions, so games start from real facts. The sources are listed with the game. Web text is passed to the model as reference only, and a failed search never stops a build.

1. The model fills in a structured game design instead of writing code: a title, a story, a player and challenger, a world, a game type and 6 to 8 rounds of questions (`src/lib/games/spec.ts`).
2. Envision checks the design and asks the model to fix any problems, up to three tries (`src/lib/games/pipeline.ts`).
3. The model answers each question again without seeing the answer key. Any question where the answers disagree is dropped, so students never see a doubtful answer.
4. Envision draws the game with code. There are six worlds (jungle, space, ocean, city, castle and lab) and three game types (journey, beat the clock and boss battle), built with Phaser (`src/lib/games/engine/world.js` and `src/lib/games/render.ts`). Games need no image files or network access.
5. The game runs in a sandboxed frame, so it can't reach the rest of the app.

Labs, decision stories and arrange games use the same steps. The model fills in a design for a hand-built engine (`src/lib/games/lab.ts`, `src/lib/games/engine/lab.js` and `src/lib/games/engine/activities.js`), and the simulation checks its own missions.

Changes work the same way. The model proposes specific edits, and Envision applies them to a copy and checks any new questions (`src/lib/games/revise.ts`).

## Teach mode

The **Teach mode** switch in the navigation bar is a demo mode. It plays a simulated build of about ten seconds and shows a ready-made game from `src/lib/games/prebuilt/`, without calling any AI provider or changing saved games. In a storyline, it plans a sample outline and links each level to a saved game. If there are no saved games, it adds three samples from `src/lib/games/samples.ts`.

## Where things are saved

| What | Where |
| --- | --- |
| Games and their versions | `.envision/games/<id>.json` |
| Storylines | `.envision/storylines/<id>.json` |
| Provider settings and API keys | `.envision/providers.json` |

Git ignores the whole `.envision/` folder.

## Project structure

```
src/
├── app/
│   ├── page.tsx              Home: build and change games
│   ├── storylines/           Plan storylines and build their levels
│   ├── games/                Your games: rename, delete and publish
│   ├── settings/             AI settings
│   ├── play/[id]/            Published games for students
│   ├── path/[id]/            Published storylines for students
│   └── api/                  generate, companion, games, storylines, path and config routes
├── components/               Page components, including the navigation bar
└── lib/
    ├── games/                Game design, checks, drawing and storage
    └── llm/                  AI providers, prompts and settings
scripts/
├── preview-worlds.mjs        Screenshots of each world, no model needed
├── preview-labs.mjs          Tries each lab with a real mouse, no model needed
└── eval-games.mjs            Builds and plays the example games
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app at http://localhost:3000 |
| `npm run build` | Builds the app for production |
| `npm run lint` | Checks the code with ESLint |
| `npm run preview:worlds` | Previews every world without calling a model |
| `npm run preview:labs` | Tries every lab with a real mouse, without calling a model |
| `npm run eval:games` | Builds and plays the example games with your provider. Start `npm run dev` first. |

## Known limitations

- **No logins.** Anyone who can reach the app can manage every game. `npm run dev` also listens on your local network.
- **Local file storage.** Games are saved as files, so Envision can't run on hosts like Vercel yet.
- **CSS reloading.** After changing `src/app/globals.css`, restart `npm run dev` to see it.
- **Shared Ollama servers.** Stopping a build closes the model for everyone using that server.
- **Build all games runs in the open page.** Closing the page stops it. Running it again builds whatever is still missing.

See `docs/UPDATE_TRACE.md` for the full change log, decisions and next steps.

## Claude Code

The repo includes the `frontend-design` skill in `.claude/skills/` and a Playwright MCP server in `.mcp.json` for testing the UI in a real browser. Run `npm install` first, and approve the server when Claude Code asks. It needs Google Chrome installed.

## How we work

- Don't push directly to `main`. Create a branch, then open a pull request.
- Run `npm run lint` and `npm run build` before opening a pull request.
- Never commit secrets. `.env*` files are ignored by git, so keep API keys there.

## Tech stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4 and Phaser 4. The interface uses Atkinson Hyperlegible for text and Shantell Sans for headings.
