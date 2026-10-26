# Neuroeco research app

Research prototype for the course project *Analyzing the Behavioral Mechanics of App-Based Investment Frauds*.
It simulates an investment app (plain or fraud-style version) and runs the surveys described in
[`hypothesis-report.md`](hypothesis-report.md). **No real money, payments or identifying data are involved.**

## Requirements

- Node.js 20.19+ (tested with Node 22)
- npm 10+

## Setup

```bash
npm install
cp .env.example .env   # then edit ADMIN_PASSWORD
```

## Run in development

```bash
npm run dev
```

- Client (Vite): http://localhost:5173
- API (Express): http://localhost:3001 (the client proxies `/api` and `/admin` to it)

## Other scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the client and the server |
| `npm start` | Runs the built server, which also serves the built client |
| `npm test` | Runs all unit tests |
| `npm run lint` | ESLint + Prettier check |
| `npm run format` | Formats the code with Prettier |
| `npm run typecheck` | TypeScript checks for client and server |

## Repo layout

```
client/   React + TypeScript + Vite + Tailwind (participant-facing app)
server/   Express + TypeScript + SQLite (API, randomization, export)
docs/     Data dictionary, screen list, QA checklist
```
