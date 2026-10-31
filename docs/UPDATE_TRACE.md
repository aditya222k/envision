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
| Logins | Not built |
| Deployment | Not ready, because games are stored as local files |

## Timeline

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
