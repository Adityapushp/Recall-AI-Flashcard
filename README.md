# 🧠 Recall — AI Flashcard Engine

> **AI Builder Challenge — Problem 1: The Flashcard Engine**

Turn any PDF into a smart, practice-ready flashcard deck in under 60 seconds. Powered by Groq AI and the SM-2 spaced repetition algorithm.

---

## Live Demo

**[→ your-deploy-link-here.vercel.app](https://your-deploy-link-here.vercel.app)** *(replace with your deployed URL)*

---

## What it does

1. **Drop a PDF** — lecture notes, a textbook chapter, anything
2. **Groq AI generates 15–25 cards** — key concepts, definitions, relationships, edge cases — written like a great teacher, not scraped by a bot
3. **Study with spaced repetition** — the SM-2 algorithm adapts to what you know. Hard cards come back sooner. Easy cards are pushed further out
4. **Track mastery** — see exactly what you know, what's shaky, and your overall progress

---

## How it works

```
PDF upload → Server extracts text → Groq AI generates cards → Cards saved to browser → Study with SM-2
```

- **PDF parsing** happens on the server (Next.js API route) — fast, private, never stored
- **AI card generation** happens on the server via Groq API — the AI key is never exposed to the browser
- **Deck data** is saved in the browser's localStorage — no login, no database, no account needed

---

## Problem this solves

Most students study by passively re-reading notes. Cognitive science is clear: **active recall + spaced repetition** dramatically outperforms re-reading for long-term retention. But most flashcard tools require you to write all the cards yourself, which is tedious and rarely done.

Recall closes that gap: the friction of creating cards drops to zero, while the quality of study goes up dramatically.

---

## Key design decisions

### Why Groq for card generation?
Groq runs Llama 3.3 70B with extremely fast inference — card generation completes in under 5 seconds. The free tier gives 14,400 requests per day which is more than enough for a study tool. The prompt is engineered to produce teacher-quality cards — explicitly asking for key concepts, definitions, worked examples, and common misconceptions rather than just copying visible text.

### Why SM-2?
SM-2 is the most research-validated spaced repetition algorithm. It tracks two things per card:
- **Repetitions** — how many times you've answered correctly in a row
- **Ease factor** — starts at 2.5, adjusts based on how you rate each card

Cards you rate "Again" reset to 0 repetitions. Cards you rate "Easy" have their next review interval multiplied by the ease factor. After 3 correct answers, a card is marked Mastered and counts toward the progress bar.

### Why localStorage instead of a database?
No login, no account, no latency. Your decks live entirely in the browser. For a study tool this is the right default — it's private, instant, and works offline. The full card state (repetitions, ease factor, interval, next review timestamp) is serialized into localStorage on every update. This works cleanly for decks up to a few hundred cards.

### Why server-side PDF parsing?
Running pdf-parse on the server instead of the browser means large PDFs don't freeze the UI, the user's file is never sent anywhere except to extract text, and the bundle size stays small.

### Tradeoffs I made
- **No cross-device sync** — would require auth + database; adds complexity for an MVP
- **Card count capped at 15–25** — more cards per deck degrades AI quality; better to generate focused sets
- **PDF only** — most study material lives in PDFs; adding URL/image ingestion would be v2
- **No card editing** — focused on the study experience; editing UI adds significant surface area

---

## Mastery system explained

| Repetitions | Status | Meaning |
|---|---|---|
| 0 | 🔘 New | Never studied |
| 1 | 🟡 Learning | Seen once correctly |
| 2 | 🟢 Review | Getting familiar |
| 3+ | ✅ Mastered | Counts toward progress bar |

**Overall mastery bar** = Mastered cards ÷ Total cards × 100%

Each session shows every card once. To reach 100% mastery:
- **3 sessions in one sitting** = 100% same day
- **3 sessions across 3 days** = optimal spaced repetition

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| AI | Groq API — Llama 3.3 70B (free tier) |
| PDF parsing | pdf-parse v1.1.1 (server-side) |
| Algorithm | SM-2 (custom TypeScript implementation) |
| Styling | Tailwind + custom CSS variables |
| Storage | localStorage (client-side, no database) |
| Fonts | Playfair Display + DM Mono + DM Sans |
| Deployment | Vercel |

---

## Running locally

```bash
git clone <your-repo-url>
cd flashcard-engine
npm install

# Get a free Groq API key at console.groq.com
# Create .env.local in the project root:
echo "GROQ_API_KEY=your-key-here" > .env.local

npm run dev
# Open http://localhost:3000
```

---

## Deploying to Vercel

```bash
npm i -g vercel
vercel
```

In the Vercel dashboard → Project → Settings → Environment Variables, add:
- `GROQ_API_KEY` = your Groq key

---

## What I'd improve with more time

1. **Cross-device sync** — Supabase for deck storage with auth
2. **Card editing UI** — let users fix or improve AI-generated cards before studying
3. **Multiple input sources** — paste text, URLs, YouTube transcripts, not just PDFs
4. **Study streaks** — daily review reminders and streak counters
5. **Difficulty heatmap** — visual grid showing where each card sits in the retention curve
6. **Better mobile UI** — swipe gestures for rating cards (left = Again, right = Easy)

---

## Interesting challenges

**pdf-parse compatibility with Next.js App Router**
pdf-parse v2 changed its export structure entirely, breaking with Next.js's ESM bundler. Fixed by pinning to v1.1.1 (the stable widely-used version) and using `require()` in the API route with `serverExternalPackages` in next.config.ts.

**SM-2 state in localStorage**
The full SM-2 state per card (repetitions, ease factor, interval, nextReview timestamp) lives in the deck JSON in localStorage. This means the entire deck serializes on every card rating. Works cleanly for up to a few hundred cards — for larger decks, IndexedDB would be the right move.

**Prompt engineering for quality**
Getting Groq to produce cards that feel like a teacher wrote them took several iterations. The key insight was explicitly telling the model to vary question types — definitions, applications, comparisons, edge cases — and to write answers that are complete but concise (2–4 sentences), not just copied sentences from the source material.

---

*Built for Cuemath AI Builder Challenge — April 2026*
