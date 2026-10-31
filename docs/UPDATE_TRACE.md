# Envision update trace

This log tracks what changed in Envision, why, and what's still open. Add new entries at the top of the timeline.

Envision lets teachers of grade 8 and high school students describe a learning game, then generates it, refines it and publishes it to students.

## Current status

| Area | Status |
| --- | --- |
| Game generation | Works with Ollama and `gemma4:e2b`. Claude, OpenAI and Gemini are stubs. |
| Game graphics | Six code-drawn worlds and three mechanics, built with Phaser 4 |
| Changing a game | Works, with versions and undo |
| Catalog and publishing | Work, stored as local files |
| Incognito | Works, and never calls a model |
| Solar System explorer | Works, with reviewed static facts and no AI |
| Logins | Not built |
| Deployment | Not ready, because games are stored as local files |

## Timeline

### 2026-10-31: 3D worlds and a Game style choice

- Added a Game style option on the home page. What the teacher chooses always beats the model's suggestion, and mentioning 3D selects a 3D world.
- Added 3D worlds. Envision provides the stage (camera, light, controls and selection), and the model writes what is in the world using Three.js. The playtest rejects games that aren't real interactive 3D scenes.
- Bundled Three.js into `src/lib/games/engine/three.global.js`, so 3D games stay offline. `npm run bundle:three` rebuilds it.

### 2026-10-31: Simulation numbers tuned by code

- A simulation lab was being rejected over its numbers alone, wasting about 4 minutes.
- The model now sets the relationships, and Envision tests different speeds and graph ranges to find values that work. All rules change speed together, so their relationships stay the same.
- Failure messages now say what the problem was.

### 2026-10-31: NASA planet models and Who's That Planet quiz

- The Solar System explorer now shows detailed NASA 3D models of the Sun and all eight planets, with a switch back to the drawn planets.
- The models are optimised and served from `public/solar-system/models/`, so the explorer doesn't contact NASA. Credits and the script that rebuilds them are in that folder.
- Added a Who's That Planet quiz beside the explorer. Students read clues to name a mystery planet, then answer questions about it.

### 2026-10-31: Solar System explorer

- Replaced the "Cell city" idea under Science with "Solar System". It opens a 3D explorer at `/explore/solar-system` instead of filling in the prompt, so it needs no AI generation or camera.
- The explorer shows the Sun and all eight planets with orbit paths. Drag rotates, scroll or pinch zooms, **Play orbits** and **Pause orbits** control the animation, and **Reset view** restores the starting camera.
- Selecting a planet, on the scene or with the planet buttons, highlights it and shows its description, position from the Sun, average distance and orbital period.
- Facts and scene settings live in `src/lib/explorer/solarSystem.ts`. The facts are reviewed values from NASA fact sheets. A note on the page says sizes, distances and speeds are simplified.
- Built with three.js and React Three Fiber. The first version drew planet surfaces in code; the entry above adds NASA models.
- The page has loading and error states. Without WebGL it explains the problem, and the planet facts still work. When the browser asks for reduced motion, the orbits start paused.
- `npm run eval:games` skips ideas that open an explorer, since they have no prompt to build.

### 2026-10-31: Brought back the redesign on top of storylines

- Commit `ec5729a` restyled the shared components so the redesign from `e4617be` works with storylines, labs and the companion, and added the navigation bar back with a Storylines link.

### 2026-10-31: Custom games that the model designs itself

- Changed direction: general guardrails on how the model works, rather than rules for each subject.
- Added a Custom game path. The model thinks through the lesson and writes down the truths the game must obey, writes the whole game, then Envision playtests it in a real browser. The model reviews its code against its own truths and fixes what failed.
- The playtest works for any subject. It proves a game runs and responds, not that its content is right.

### 2026-10-31: Stronger guardrails for smaller models

- Moved to `gemma4:12b`. Output now has lower randomness and a length limit.
- Rewrote the lab prompts with strict rules, a worked example for each game type, and a self-check.
- Retries now tell the model exactly what was wrong, instead of repeating the same request.
- Simulation labs are now run before anyone sees them, and rejected if amounts hit their limits too fast, barely change, or a slider does nothing.
- Arrange games are now solved independently, and rejected if the answers disagree.
- Decide games are now rejected if they loop back or leave a meter unused.
- Rebuilt the physics lab on real laws. It now uses velocity Verlet with a fixed time step, correct orbit speeds, and collisions that keep mass, momentum and centre of mass. Measured energy drift is effectively zero, and Kepler's third law holds to within 0.2%.
- Added pull arrows and a live speed readout to the physics lab.
- Gravity and orbit lessons now always use the physics lab, so model-written formulas can't stand in for physics.
- Turned off hidden model thinking, which was using up time and cutting replies short.
- Added web research. Builds now look up the lesson on Wikipedia and give the facts to the model as reference material, and each game lists its sources.
- Tested 3D output: `gemma4:12b` returned methane coordinates with wrong bond lengths and angles, so model-written 3D data needs checking before students see it.

### 2026-10-31: Merged over the main redesign

- `main` had a UI redesign in commit `e4617be`, with a navigation bar, Teach mode and two pre-built games (Gravity Playground and Hard Times 1932).
- By decision, this work replaced that redesign in full. None of its changes are in the current code.
- The commit is still in the git history. To recover a file from it, run `git show e4617be:<path>`.

### 2026-10-31: Interactive labs and the companion

- Moved beyond question-and-answer games. Added two hand-built lab engines that the model configures: a bodies lab for gravity and electric forces, and a systems lab with sliders and a live graph.
- Added missions that the simulation checks by itself.
- Added two more game types that work for any lesson: Decide, a branching story with consequences, and Arrange, for ordering and sorting. All game types use the same pipeline, so they work with local and stronger models.
- Added a companion that suggests a type of game and asks the teacher quick questions with options before building.

### 2026-10-31: Interactive builds

- Added a live reveal. The title, hero, world and questions appear on the page as the model writes them.
- Made the answer check visible, with a status for each question.
- Doubtful questions now go to a review list, where a teacher picks the right answer and adds the question, or leaves it out.

### 2026-10-31: Storylines

- Added storylines at `/storylines`: subject, then chapters, then levels, where each level is one game.
- The model plans the overall story, each chapter's story, and a story note for each level. Each game receives the story so far, and Envision keeps the same hero and the chapter's world.
- A level can use a new game or a saved one.
- Added a sticky board for each chapter. Story notes can be dragged or moved between that chapter's levels, and a level warns when its game was built for a different note.
- Added a red string that joins the story notes in order, pin to pin and across chapters, with a story step number on each note.
- Added **Build all games**, which builds missing levels one at a time and shows a timeline. It runs in the open page, so closing the page ends it, and running it again resumes with what's missing.
- Publishing a storyline gives students one link at `/path/<id>`. Winning a game unlocks the next, and the overall ending appears at the end.

### 2026-10-31: Reliable game changes and the games drawer

- Added the **Your games** drawer on the left of the home page.
- Investigated the error "Envision couldn't make that change". The answer check was rejecting long calculations that the model can't do reliably, and one doubtful question failed the whole change.
- A change now keeps its good parts and reports any question it skipped. A doubtful question still never goes in.
- Updated the prompts so that broad requests like "make it easier" rewrite rounds instead of removing them, and to avoid long calculations.
- Fixed math text damaged by LaTeX, such as `\times` becoming "imes", and removed "a)" labels from answers.
- Fixed a change with nothing left to apply creating an empty version.

### 2026-10-30 to 31: Catalog, publishing, progress and Incognito

Commit `bd17a0b`

- Saved games with version history in `.envision/games/`, so a refresh no longer loses work.
- Added the catalog at `/games` for renaming, deleting and publishing.
- Added publishing. Students get a separate copy at `/play/<id>`, so later edits stay private until published again.
- Added a real progress bar with elapsed time. The server streams progress as the model writes.
- Added the Incognito switch, a demo mode that simulates a build from saved games. It adds three sample games if the catalog is empty.

### 2026-10-30: Changing a game by prompt

Commit `bd17a0b`

- Teachers can describe a change after a game is built.
- The model proposes specific edits, and Envision applies them to a copy, so anything not mentioned stays the same.
- A failed or stopped change leaves the game as it was.

### 2026-10-30: Structured games, graphics and Stop

Commit `b60fd91`

- **Tool calling test:** in a two-prompt test, structured JSON output met the round count and tool calling stopped at 3 rounds, so Envision drives the steps and requires structured output.
- **Structured games:** the model fills in a defined game design instead of writing code.
- **Answer check:** the model answers each question without the key. It found real wrong keys in a chemistry game, and disputed rounds are dropped.
- **Graphics:** all graphics are drawn by code in Phaser 4. The model doesn't generate images, and art packs were dropped.
- **Stop button:** cancels the run and unloads the model.
- **Stale CSS:** turned off the Turbopack disk cache. CSS changes still need a restart of `npm run dev`.

### 2026-10-30: Settings, redesign and Ollama

Commit `45877fe`

- Added the AI settings page with masked API keys.
- Redesigned the home and settings pages as a game board.
- Connected Ollama with `gemma4:e2b`.
- Added the `frontend-design` skill and a Playwright MCP server.

### 2026-10-30: Project start

Commits `d8e45fb` and `5784d14`

- Set up Next.js, TypeScript and Tailwind on top of the empty repo.
- Added provider stubs and a provider picker.

## Key decisions

| Decision | Reason |
| --- | --- |
| The model fills in a design, and code builds the game | Small models write unreliable code. This gives consistent games with variety from defined elements. |
| Graphics are drawn by code | The model can't produce good images, and code needs no image files or network access. |
| Phaser for the world, HTML for questions | Questions stay sharp, keyboard friendly and readable by screen readers. |
| Doubtful questions are never included | A wrong answer teaches students the wrong thing. |
| Students get a separate published copy | Teachers can edit without affecting a class that's playing. |

## Known issues and next steps

1. **Add logins.** Anyone who can reach the app can manage every game, and `npm run dev` also listens on the local network.
2. **Add a database.** Local files won't work on hosts like Vercel.
3. **Run the full evaluation.** The 11-game `npm run eval:games` run hasn't finished on the current code.
4. **Add teacher review.** The answer check can reject correct answers and miss wrong ones, and it doesn't check match rounds.
5. **Plan for shared Ollama servers.** Stopping one teacher's build unloads the model for everyone on that server.
6. **Test on school laptops.** Performance has only been measured on one development machine.
7. **Implement Claude, OpenAI and Gemini.** They still return "not implemented".
8. **Fix CSS reloading.** Edits to `globals.css` need a dev server restart.

## Testing notes

The last set of change-request fixes was only partly re-tested. Three of eight requests had finished when the run was stopped: "Make it harder" and "Add a harder round" made real changes. "Make the game easier" exposed the empty-version bug, which was then fixed without a re-run.
