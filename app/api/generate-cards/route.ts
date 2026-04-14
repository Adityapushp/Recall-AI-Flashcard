import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, title } = await req.json();
    if (!text || text.length < 50) {
      return NextResponse.json({ error: 'Text too short' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;

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
            role: 'user',
            content: `You are an expert educator creating high-quality flashcards from study material.

Document title: "${title}"

Content:
${text.slice(0, 12000)}

Create 15-25 flashcards covering this material comprehensively. Focus on key concepts, definitions, relationships, examples, and common misconceptions.

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "front": "Clear specific question",
    "back": "Complete informative answer (2-4 sentences)",
    "category": "Topic name"
  }
]`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq API error');

    const rawText = data.choices[0].message.content;
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const cards = JSON.parse(cleaned);

    if (!Array.isArray(cards)) throw new Error('Invalid response format');
    return NextResponse.json({ cards });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Generate cards error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}