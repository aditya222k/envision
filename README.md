# envision

Envision lets teachers build learning games for high school and pre-high school (grade 8) students. A teacher describes the game in a prompt, and the platform generates it and makes it ready to play.

This repo is currently a starter app. Game generation isn't built yet.

## Getting started

You need [Node.js](https://nodejs.org) LTS.

```bash
git clone https://github.com/aditya222k/envision.git
cd envision
npm install
npm run dev
```

Then open http://localhost:3000.

## AI providers

Games will be generated through `POST /api/generate`, which can use Claude, OpenAI, Gemini or a local Ollama host. Ollama works today and defaults to the `gemma4:e2b` model (run `ollama pull gemma4:e2b` to get it). Claude, OpenAI and Gemini are still stubs in `src/lib/llm/providers/`, so they return a 501. Generated games run in a sandboxed iframe.

To configure a provider, do one of the following:

- **Local development:** open `/settings` and enter the API endpoint, key and model. These are saved on your machine in `.envision/providers.json`, which git ignores. Saved keys are only ever shown masked.
- **Deployments:** copy the values in `.env.example` into environment variables. The `/settings` page is read-only in production builds because there's no login yet.

Choose the provider from the dropdown on the home page. `LLM_PROVIDER` only applies to API requests that don't name one.

## Claude Code

The repo includes the `frontend-design` skill in `.claude/skills/` and a Playwright MCP server in `.mcp.json` for testing the UI in a real browser. Run `npm install` first, and approve the server when Claude Code asks. It needs Google Chrome installed.

## How we work

- Don't push directly to `main`. Create a branch, then open a pull request.
- Run `npm run lint` and `npm run build` before opening a pull request.
- Never commit secrets. `.env*` files are ignored by git, so keep API keys there.

## Tech stack

Next.js, TypeScript and Tailwind CSS.
