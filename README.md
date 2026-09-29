# Qalam — English to Urdu Translation

Single-page Next.js app for English → Urdu machine translation. Deployable on Vercel.

## Features

- Paste English text, upload a `.txt` file, or upload a PDF
- PDF page-range picker with live preview before OCR / extraction
- Runs **NLLB-200** and **Qwen3-8B** together for side-by-side comparison
- Separate Urdu previews and downloadable `.txt` files per model

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Client-side PDF.js preview / extraction and Tesseract.js OCR
- `/api/translate` serverless route for model backends

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Push this repo to GitHub
2. Import the project in Vercel
3. Optionally add `HF_API_TOKEN` for Qwen3-8B
4. Deploy

## Models

| ID | Model |
| --- | --- |
| `nllb-200` | Meta NLLB-200 |
| `qwen3-8b` | Qwen3-8B |

Long OCR or pasted text is split on **sentence boundaries**, translated in parts, then concatenated into one Urdu result per model.
