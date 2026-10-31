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

## How we work

- Don't push directly to `main`. Create a branch, then open a pull request.
- Run `npm run lint` and `npm run build` before opening a pull request.
- Never commit secrets. `.env*` files are ignored by git, so keep API keys there.

## Tech stack

Next.js, TypeScript and Tailwind CSS.
