# Qalam — English to Urdu Translation

Single-page Next.js app for English → Urdu machine translation. Deployable on Vercel.

## Features

- Paste English text, upload a `.txt` file, or upload a PDF
- PDF text extraction via PDF.js; OCR fallback with Tesseract.js for scanned pages
- Selectable Hugging Face translation models
- Urdu preview (Nastaliq) and downloadable `.txt` export

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Client-side PDF / OCR extraction
- `/api/translate` serverless route → Hugging Face Inference API

## Setup

```bash
npm install
cp .env.example .env.local
# optional: add HF_API_TOKEN=hf_...
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Push this repo to GitHub
2. Import the project in Vercel
3. Add `HF_API_TOKEN` (recommended) under Project → Settings → Environment Variables
4. Deploy

## Models

| ID | Hugging Face model |
| --- | --- |
| `opus-mt-en-ur` | Helsinki-NLP/opus-mt-en-ur |
| `nllb-200` | facebook/nllb-200-distilled-600M |
| `mbart-50` | facebook/mbart-large-50-many-to-many-mmt |
