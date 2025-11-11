import type { NextApiRequest, NextApiResponse } from 'next';
import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

interface AnalysisResult {
  fairValuePrice: number;
  confidence: number;
  reasoning: string;
  historicalFrequency: {
    word: string;
    occurrences: number[];
    average: number;
  };
  research: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { word, company, ticker } = req.body;

  if (!word || !company) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    console.log(`🔍 Analyzing "${word}" for ${company} earnings calls with web search...`);

    // Use GPT-3.5-turbo for basic analysis (OpenAI 3.3.0 doesn't have responses API)
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a financial analyst expert specializing in earnings call analysis.'
        },
        {
          role: 'user',
          content: `You are a financial analyst expert specializing in earnings call analysis.

TASK: Analyze the word "${word}" for ${company} (ticker: ${ticker || 'unknown'}) earnings calls.

STEP 1 - WEB RESEARCH:
Search the web and find the last 5 earnings call transcripts for ${company}. Look for:
1. Seeking Alpha earnings transcripts: site:seekingalpha.com ${company} earnings call transcript
2. ${company} investor relations earnings call transcript
3. YouTube earnings calls: ${company} earnings call Q3 2024, Q2 2024, etc.
4. Financial news coverage of ${company} earnings calls
5. SEC filings and 8-K reports

STEP 2 - WORD COUNT ANALYSIS:
For each of the last 5 earnings calls you find:
- Count exact mentions of the word "${word}"
- Note the quarter/date of each call
- Analyze the context (positive, negative, neutral)

STEP 3 - FAIR VALUE CALCULATION:
Based on historical frequency, calculate a fair probability (0-1) that "${word}" will be mentioned in the next earnings call.

Consider:
- Historical frequency trend (increasing/decreasing/stable)
- Current business trends for ${company}
- Recent company news and developments
- Industry context and competitive landscape
- Seasonal patterns or cyclical mentions
- Management's typical language and focus areas

STEP 4 - RETURN JSON RESPONSE:
Return ONLY a JSON object with this exact structure (no markdown, no code blocks):
{
  "fairValuePrice": 0.65,
  "confidence": 85,
  "reasoning": "Based on web search of recent earnings transcripts, ${word} was mentioned X times in Q3 2024 (source URL), Y times in Q2 2024 (source URL)... The trend shows...",
  "historicalData": [
    {"quarter": "Q3 2024", "mentions": 5},
    {"quarter": "Q2 2024", "mentions": 3},
    {"quarter": "Q1 2024", "mentions": 4},
    {"quarter": "Q4 2023", "mentions": 2},
    {"quarter": "Q3 2023", "mentions": 6}
  ],
  "keyInsights": ["Specific insight with data point 1", "Specific insight with data point 2", "Specific insight with data point 3"],
  "research": "Detailed summary of web research findings with actual sources found, URLs visited, and methodology used..."
}

The fairValuePrice must be between 0 and 1 (e.g., 0.75 = 75% probability).
Base your analysis ONLY on actual web research findings.`
        }
      ]
    });

    const result = response.data.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    // Extract JSON from response (GPT-4.1 responses API returns text)
    let analysis;
    try {
      // Try direct parse first
      analysis = JSON.parse(result);
    } catch {
      // If wrapped in markdown code blocks, extract JSON
      const jsonMatch = result.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        // Try to find JSON object in text
        const jsonStart = result.indexOf('{');
        const jsonEnd = result.lastIndexOf('}') + 1;
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          analysis = JSON.parse(result.substring(jsonStart, jsonEnd));
        } else {
          throw new Error('Could not parse JSON from response');
        }
      }
    }

    console.log(`✅ Analysis complete for "${word}"`);
    console.log(`Fair value: ${(analysis.fairValuePrice * 100).toFixed(1)}%`);

    res.status(200).json(analysis);
  } catch (error: any) {
    console.error('Error in analysis:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
}
