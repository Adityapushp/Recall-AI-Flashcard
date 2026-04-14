import { NextRequest, NextResponse } from 'next/server';

const PROMPT = (title: string, text: string) => `You are an expert educator creating flashcards from study material.

Document title: "${title}"

Content:
${text}

Create 15-25 flashcards covering this material. Focus on key concepts, definitions, relationships, examples, and common misconceptions.

CRITICAL: You must respond with ONLY a raw JSON array. No explanation, no markdown, no code fences, no text before or after. Start your response with [ and end with ].

Example of exact format required:
[{"front":"What is X?","back":"X is...","category":"Topic"},{"front":"How does Y work?","back":"Y works by...","category":"Topic"}]

Now generate the flashcards for the document above:`;

async function callGroq(apiKey: string, title: string, text: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a flashcard generator. You ONLY output valid JSON arrays. Never output any text outside the JSON array. Never use markdown. Never explain yourself.'
        },
        {
          role: 'user',
          content: PROMPT(title, text)
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Groq API error');
  return data.choices[0].message.content;
}

function extractJSON(raw: string): string {
  let cleaned = raw
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  if (cleaned.startsWith('{')) {
    const match = cleaned.match(/"(?:cards|flashcards|data|items)"\s*:\s*(\[[\s\S]*\])/);
    if (match) return match[1];
    const arrMatch = cleaned.match(/(\[[\s\S]*\])/);
    if (arrMatch) return arrMatch[1];
  }

  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.slice(start, end + 1);
  }

  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const { text, title } = await req.json();

    if (!text || text.length < 50) {
      return NextResponse.json({ error: 'Text too short' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 });
    }

    const truncated = text.slice(0, 12000);

    let lastError = '';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await callGroq(apiKey, title, truncated);
        const cleaned = extractJSON(raw);
        const cards = JSON.parse(cleaned);

        if (!Array.isArray(cards)) {
          if (cards && Array.isArray(cards.cards)) {
            return NextResponse.json({ cards: cards.cards });
          }
          throw new Error('Response is not an array');
        }

        const valid = cards.filter((c: Record<string, string>) =>
          c && typeof c.front === 'string' && typeof c.back === 'string'
        );

        if (valid.length === 0) throw new Error('No valid cards generated');

        return NextResponse.json({ cards: valid });

      } catch (parseErr) {
        lastError = parseErr instanceof Error ? parseErr.message : String(parseErr);
        console.error(`Attempt ${attempt} failed:`, lastError);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }

    return NextResponse.json({
      error: `Failed to generate cards after 2 attempts: ${lastError}`
    }, { status: 500 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Generate cards error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}