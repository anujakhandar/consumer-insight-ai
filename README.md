# Consumer Insight AI

A modern dark-themed React dashboard with a secure backend proxy for Google Gemini, persistent shared reports, and multi-page PDF export.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

3. Start app:

```bash
npm start
```

This runs both:

- Frontend: `http://localhost:3000`
- API server: `http://localhost:5000`

## Features

- Gemini API key stays on backend (`server/index.js`)
- Persistent shared reports stored in local DB file
- Rich 3-page PDF report export

## Tech stack

- React + react-scripts
- Tailwind CSS
- Recharts
- Framer Motion
- jsPDF
- Express + NeDB
