# Earnings Call Mention Analyzer

## Overview

An AI-powered tool for analyzing Polymarket earnings mention markets. It calculates fair value prices for individual words mentioned in earnings calls by researching historical data and comparing them to current market prices on Polymarket.

## How It Works

### 1. Event Search

Search for earnings mention events using Polymarket's slug format:
```
earnings-mentions-{company}-{date}
```

Example: `earnings-mentions-celsius-2025-11-05`

The tool queries the Polymarket Gamma API to fetch all markets associated with that event.

### 2. Market Display

Each event contains multiple markets representing different words that may be mentioned in the earnings call. For each market, the tool displays:

- **Word**: The term being tracked (extracted from the market question)
- **Market Price**: Current price on Polymarket (probability the word will be mentioned)
- **Volume**: Total trading volume for this market
- **Liquidity**: Available liquidity

### 3. AI Analysis

Click "Analyze" on any market to trigger AI-powered research:

#### Real-Time Web Research
Uses GPT-4.1 with web search capabilities to:
- Search Seeking Alpha for earnings call transcripts
- Find company investor relations resources
- Locate YouTube earnings call recordings
- Review financial news and SEC filings
- Access real-time company information

#### Data Collection
- Fetches historical earnings call transcripts (last 5 calls) via web search
- Counts exact word mentions in each transcript
- Analyzes word frequency and usage patterns
- Researches company context and recent news with citations

#### Fair Value Calculation
The AI (GPT-4.1 with web search) determines a fair value price based on:
- Historical mention frequency from actual transcripts
- Context of past mentions (positive, negative, neutral)
- Recent company developments found via web search
- Industry trends and competitive landscape
- Seasonal patterns or cyclical mentions
- Management's typical language and focus areas

#### Edge Calculation
```
Edge = ((Fair Value - Market Price) / Market Price) × 100
```

- **Positive Edge**: AI believes word is underpriced (good buy opportunity)
- **Negative Edge**: AI believes word is overpriced (potential sell)

### 4. Analysis Results

The analysis panel shows:

#### Price Comparison
- Current market price
- AI-calculated fair value
- Edge percentage (color-coded: purple for positive, red for negative)

#### AI Reasoning
Detailed explanation of how the fair value was calculated, including:
- Historical patterns observed
- Relevant company context
- Risk factors
- Confidence level

#### Key Insights
Bullet points summarizing the most important findings.

#### Historical Data
Bar chart showing mention frequency across the last 5 earnings calls.

## Technical Architecture

### Frontend
- **Framework**: Next.js 15 (Pages Router)
- **Language**: TypeScript
- **Styling**: CSS Modules with terminal aesthetic
- **Design**: Clean, monospaced Apple-inspired UI

### Backend
- **API Routes**: Server-side proxy to avoid CORS
  - `/api/events` - Polymarket event data
  - `/api/analyze` - AI analysis endpoint with web search
- **AI Model**: OpenAI GPT-4.1 with web_search_preview
- **Web Search**:
  - Real-time internet access via Responses API
  - High context size for comprehensive research
  - Citation tracking and source verification
- **External APIs**:
  - Polymarket Gamma API
  - OpenAI Responses API (GPT-4.1)

### Data Flow

```
User Input (slug)
    ↓
/api/events?slug={slug}
    ↓
Polymarket Gamma API
    ↓
Display Markets
    ↓
User Clicks "Analyze"
    ↓
/api/analyze (word, company, ticker)
    ↓
OpenAI GPT-4.1 + Web Search
    ↓
Real-time earnings transcript research
    ↓
Display Analysis Results with Citations
```

## API Endpoints

### GET /api/events
Query parameters:
- `slug` - Event slug (e.g., "earnings-mentions-celsius-2025-11-05")
- `limit` - Number of events to fetch (default: 100)
- `offset` - Pagination offset (default: 0)
- `closed` - Include closed events (default: false)

### POST /api/analyze
Request body:
```json
{
  "word": "revenue",
  "company": "Celsius",
  "ticker": "earnings-mentions-celsius-2025-11-05"
}
```

Response:
```json
{
  "fairValuePrice": 0.75,
  "confidence": 85,
  "reasoning": "Detailed explanation...",
  "historicalData": [
    { "quarter": "Q1 2024", "mentions": 15 },
    { "quarter": "Q2 2024", "mentions": 18 }
  ],
  "keyInsights": [
    "Word mentioned in every call",
    "Usually in financial overview section"
  ],
  "research": "Full research notes..."
}
```

## AI Analysis Details

### Web Search Implementation
Uses OpenAI GPT-4.1 with web_search_preview tool via the Responses API:
- **Model**: `gpt-4.1`
- **Tool**: `web_search_preview` with high context size
- **Capabilities**: Real-time web browsing and data retrieval
- **Sources**: Seeking Alpha, investor relations sites, YouTube, SEC filings

### Research Process
The AI performs deep research by:
1. Searching the web for earnings call transcripts
2. Locating and analyzing the last 5 earnings calls
3. Counting exact mentions of the target word
4. Analyzing context and trends
5. Calculating fair value probability based on findings

### System Prompt
The AI acts as a financial analyst with web search access. It:
- Searches for real earnings call transcripts online
- Counts actual word mentions from source documents
- Identifies historical patterns with citations
- Considers current company context via web search
- Calculates probability-based fair value with evidence

### Response Parsing
GPT-4.1 Responses API returns text format:
- Primary: Direct JSON parsing
- Fallback 1: Extract from markdown code blocks
- Fallback 2: Find JSON object in text response

### Advantages Over Previous Approach
- **Real Data**: Accesses actual earnings transcripts, not simulated
- **Citations**: Provides source URLs and references
- **Current Info**: Gets latest company news and developments
- **Accuracy**: Based on verifiable web research, not model knowledge
- **Transparency**: Shows research methodology and sources used

## UI Features

### Terminal Aesthetic
- SF Mono monospace font throughout
- Minimal 1px borders
- No gradients or shadows
- Simple opacity-based hover states
- Terminal colors (purple/red for positive/negative edge)

### Theme Toggle
Circle icon in top-right corner:
- ○ Light mode
- ● Dark mode

### Responsive Design
Mobile-optimized with collapsible sections and touch-friendly buttons.

## Environment Variables

Required in `.env`:
```
NEXT_PUBLIC_POLYMARKET_API_URL=https://gamma-api.polymarket.com
OPENAI_API_KEY=your_openai_api_key_here
```

## Running the Tool

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build
pnpm start
```

Default port: 3000 (or next available)

## Use Cases

1. **Identify Mispriced Markets**: Find words with significant edge
2. **Research Company Trends**: Understand which terms are frequently mentioned
3. **Historical Analysis**: Compare mention frequency across quarters
4. **Risk Assessment**: Review AI confidence levels before trading

## Word Extraction

Words are extracted from market questions using regex:
```typescript
const match = question.match(/"([^"]+)"/);
```

This captures quoted terms like:
- 'Will "revenue" be mentioned?'
- 'Earnings call mentions "growth"'

## Company Extraction

Company names are parsed from the slug:
```typescript
const parts = slug.split('-');
// earnings-mentions-celsius-2025-11-05
// parts[2] = "celsius"
```

## Edge Cases Handled

- **Zero Market Price**: Edge = 100% if fair value > 0
- **Zero Fair Value**: Edge = 0%
- **Missing Data**: Fallback to 0 with validation
- **Invalid Slugs**: Error handling with user feedback
- **API Failures**: Graceful degradation with error messages

## Performance Considerations

- Server-side API calls prevent CORS issues
- Client-side caching of event data
- Lazy loading of analysis (only when requested)
- Optimized re-renders with React hooks

## Future Enhancements

- Real earnings transcript integration
- Historical price tracking
- Portfolio tracking for multiple markets
- Alert system for high-edge opportunities
- Backtesting fair value accuracy
