import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai/provider';

const GENERATE_PROMPT = `You are CodeCoach Problem Generator. Generate a single technical interview problem based on the given topic and difficulty.

Output ONLY valid JSON matching this schema:
{
  "selected_problem": {
    "id": "uuid-like string",
    "title": "short problem title",
    "description": "detailed problem statement without giving the solution",
    "followups": ["followup question 1", "followup question 2", "followup question 3"],
    "concept_targets": ["concept1", "concept2", "concept3"]
  }
}

Rules:
- Do NOT include solutions or code
- Make the problem appropriate for the given difficulty
- Include 3-5 followup questions that probe deeper understanding
- Include 3-5 concept targets the problem tests
- Ensure strong variation in scenario, data shape, constraints, and core algorithmic angle
- If existing question titles are provided, avoid semantic duplicates and near-identical variants`;

export async function POST(req: NextRequest) {
  try {
    const { topic, difficulty, existingQuestionTitles = [] } = await req.json();

    if (!topic) {
      return NextResponse.json({ error: 'topic required' }, { status: 400 });
    }

    const userMessage = JSON.stringify({
      topic,
      difficulty: difficulty || 'medium',
      existing_question_titles: Array.isArray(existingQuestionTitles) ? existingQuestionTitles : [],
      variation_nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });

    const rawResponse = await callAI(GENERATE_PROMPT, userMessage, { temperature: 0.9 });
    const parsed = JSON.parse(rawResponse);

    if (!parsed.selected_problem || !parsed.selected_problem.id) {
      return NextResponse.json({ error: 'Invalid AI response structure' }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Generate question error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
