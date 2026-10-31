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

Games will be generated through `POST /api/generate`, which can use Claude, OpenAI, Gemini or a local Ollama host. The providers in `src/lib/llm/providers/` are stubs for now, so the route returns a 501 until they're implemented.

To configure a provider, copy `.env.example` to `.env.local` and fill in its values. Choose the provider from the dropdown on the home page. `LLM_PROVIDER` only applies to API requests that don't name one.

## How we work

- Don't push directly to `main`. Create a branch, then open a pull request.
- Run `npm run lint` and `npm run build` before opening a pull request.
- Never commit secrets. `.env*` files are ignored by git, so keep API keys there.

## Tech stack

Next.js, TypeScript and Tailwind CSS.
