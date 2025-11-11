import { useState } from 'react';
import styles from './EarningsAnalyzer.module.css';

interface Market {
  id: string;
  question: string;
  slug: string;
  outcomePrices: string; // This is a JSON string like "[\"0.25\", \"0.75\"]"
  volume: string;
}

interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  image: string;
  markets: Market[];
}

interface Analysis {
  word: string;
  marketPrice: number;
  fairValuePrice: number;
  confidence: number;
  reasoning: string;
  historicalData?: any[];
  keyInsights?: string[];
  research?: string;
  edge: number;
}

export default function EarningsAnalyzer() {
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [analyzingWord, setAnalyzingWord] = useState<string>('');
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!slug) return;

    setLoading(true);
    setEvent(null);
    setAnalyses([]);

    try {
      console.log(`🔍 Searching for slug: ${slug}`);

      const response = await fetch(`/api/events?slug=${slug}&closed=false`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const eventData = data[0];
        console.log(`✅ Found event: ${eventData.title}`);
        console.log(`📊 Markets found: ${eventData.markets?.length || 0}`);
        setEvent(eventData);
      } else {
        alert('No event found with that slug');
      }
    } catch (error) {
      console.error('Error searching:', error);
      alert('Failed to fetch event data');
    } finally {
      setLoading(false);
    }
  };

  const extractWordFromQuestion = (question: string): string => {
    const match = question.match(/"([^"]+)"/);
    return match ? match[1] : '';
  };

  const extractCompanyFromSlug = (slug: string): string => {
    const parts = slug.split('-');
    if (parts[0] === 'earnings' && parts[1] === 'mentions') {
      return parts[2]?.charAt(0).toUpperCase() + parts[2]?.slice(1) || '';
    }
    return '';
  };

  // Convert URLs in text to clickable links with simple labels
  const linkifyText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, idx) => {
      if (part.match(urlRegex)) {
        // Extract domain for simple label
        let label = '[source]';
        try {
          const url = new URL(part);
          label = `[${url.hostname.replace('www.', '')}]`;
        } catch {
          label = '[link]';
        }

        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
            title={part}
          >
            {label}
          </a>
        );
      }
      return part;
    });
  };

  const analyzeMarket = async (market: Market) => {
    const word = extractWordFromQuestion(market.question);
    if (!word) {
      alert('Could not extract word from market question');
      return;
    }

    const company = extractCompanyFromSlug(event!.slug);

    setAnalyzingWord(word);

    try {
      console.log(`🤖 Analyzing "${word}" for ${company}...`);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          company,
          ticker: company.toUpperCase(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const analysis = await response.json();

      // Parse outcomePrices from string to array
      const prices = JSON.parse(market.outcomePrices);
      const marketPrice = parseFloat(prices[0]) || 0;
      const fairValue = analysis.fairValuePrice || 0;

      // Fix NaN calculation
      let edge = 0;
      if (marketPrice > 0 && fairValue > 0) {
        edge = ((fairValue - marketPrice) / marketPrice) * 100;
      } else if (fairValue > 0 && marketPrice === 0) {
        edge = 100;
      }

      const fullAnalysis: Analysis = {
        word,
        marketPrice,
        fairValuePrice: fairValue,
        confidence: analysis.confidence || 0,
        reasoning: analysis.reasoning || '',
        historicalData: analysis.historicalData || [],
        keyInsights: analysis.keyInsights || [],
        research: analysis.research || '',
        edge,
      };

      console.log(`✅ Analysis complete for "${word}"`);
      console.log(`Market: ${(marketPrice * 100).toFixed(1)}% | Fair Value: ${(fairValue * 100).toFixed(1)}% | Edge: ${edge.toFixed(1)}%`);

      setAnalyses(prev => [...prev, fullAnalysis]);
    } catch (error) {
      console.error('Error analyzing:', error);
      alert(`Failed to analyze "${word}"`);
    } finally {
      setAnalyzingWord('');
    }
  };

  return (
    <div className={styles.container}>
      {!event ? (
        <div className={styles.heroSection}>
          <div className={styles.glowOrb}></div>
          <div className={styles.heroContent}>
            <div className={styles.badge}>
              <span className={styles.badgeDot}></span>
              AI-Powered Analysis
            </div>
            <h1 className={styles.heroTitle}>
              Earnings Call<br/>Mention Analyzer
            </h1>
            <p className={styles.heroSubtitle}>
              Uncover edge in Polymarket earnings mention markets with AI-powered research and historical analysis
            </p>

            <form onSubmit={handleSearch} className={styles.heroForm}>
              <div className={styles.inputWrapper}>
                <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM18 18l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  className={styles.heroInput}
                  placeholder="earnings-mentions-celsius-2025-11-05"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                className={styles.heroButton}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner}></span>
                    Searching...
                  </>
                ) : (
                  <>
                    Analyze Event
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className={styles.features}>
              <div className={styles.feature}>
                <svg className={styles.featureIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M7 16l4-4 3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Historical Data</span>
              </div>
              <div className={styles.feature}>
                <svg className={styles.featureIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>GPT-4 Analysis</span>
              </div>
              <div className={styles.feature}>
                <svg className={styles.featureIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Edge Calculation</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.resultsSection}>
          <button className={styles.backButton} onClick={() => setEvent(null)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Search
          </button>

          <div className={styles.eventCard}>
            <div className={styles.eventImageWrapper}>
              {event.image && (
                <img src={event.image} alt={event.title} className={styles.eventImage} />
              )}
              <div className={styles.eventGradient}></div>
            </div>
            <div className={styles.eventInfo}>
              <h2 className={styles.eventTitle}>{event.title}</h2>
              <p className={styles.eventDescription}>{event.description}</p>
              <div className={styles.eventStats}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{event.markets.length}</span>
                  <span className={styles.statLabel}>Markets</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{analyses.length}</span>
                  <span className={styles.statLabel}>Analyzed</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.marketsGrid}>
            {event.markets.map((market) => {
              const word = extractWordFromQuestion(market.question);
              const existingAnalysis = analyses.find(a => a.word === word);
              const isAnalyzing = analyzingWord === word;
              const isExpanded = expandedAnalysis === word;

              // Parse outcomePrices from string to array
              const prices = JSON.parse(market.outcomePrices);
              const marketPrice = parseFloat(prices[0]) || 0;

              return (
                <div key={market.id} className={`${styles.marketCard} ${existingAnalysis ? styles.analyzed : ''}`}>
                  <div className={styles.marketTop}>
                    <div className={styles.wordBadge}>{word}</div>
                    <div className={styles.marketPrice}>
                      <span className={styles.priceLarge}>{(marketPrice * 100).toFixed(0)}</span>
                      <span className={styles.priceSmall}>%</span>
                    </div>
                  </div>

                  <p className={styles.marketQuestion}>{market.question}</p>

                  <div className={styles.marketFooter}>
                    <span className={styles.volumeTag}>
                      ${(parseFloat(market.volume) / 1000).toFixed(1)}K vol
                    </span>
                    <button
                      className={styles.analyzeBtn}
                      onClick={() => analyzeMarket(market)}
                      disabled={isAnalyzing || !!existingAnalysis}
                    >
                      {isAnalyzing ? (
                        <>
                          <span className={styles.smallSpinner}></span>
                          Analyzing
                        </>
                      ) : existingAnalysis ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M11.667 3.5L5.25 9.917 2.333 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Analyzed
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          Analyze
                        </>
                      )}
                    </button>
                  </div>

                  {existingAnalysis && (
                    <div className={styles.analysisPanel}>
                      <div className={styles.analysisPanelHeader}>
                        <button
                          className={styles.toggleButton}
                          onClick={() => setExpandedAnalysis(isExpanded ? null : word)}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                              d={isExpanded ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4"}
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          {isExpanded ? 'Hide Details' : 'Show Details'}
                        </button>
                      </div>

                      <div className={styles.comparison}>
                        <div className={styles.comparisonItem}>
                          <div className={styles.comparisonLabel}>Market</div>
                          <div className={styles.comparisonValue}>
                            {(existingAnalysis.marketPrice * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className={styles.comparisonArrow}>→</div>
                        <div className={styles.comparisonItem}>
                          <div className={styles.comparisonLabel}>AI Fair Value</div>
                          <div className={styles.comparisonValue}>
                            {(existingAnalysis.fairValuePrice * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className={`${styles.edgeTag} ${existingAnalysis.edge > 0 ? styles.positive : styles.negative}`}>
                          {existingAnalysis.edge > 0 ? '+' : ''}{existingAnalysis.edge.toFixed(1)}% edge
                        </div>
                      </div>

                      {isExpanded && (
                        <>
                      <div className={styles.aiReasoning}>
                        <div className={styles.reasoningHeader}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M8 11V8M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          AI Reasoning
                        </div>
                        <p>{linkifyText(existingAnalysis.reasoning)}</p>
                      </div>

                      {existingAnalysis.keyInsights && existingAnalysis.keyInsights.length > 0 && (
                        <div className={styles.insights}>
                          <div className={styles.insightsHeader}>Key Insights</div>
                          <ul>
                            {existingAnalysis.keyInsights.map((insight, idx) => (
                              <li key={idx}>{insight}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {existingAnalysis.historicalData && existingAnalysis.historicalData.length > 0 && (
                        <div className={styles.history}>
                          <div className={styles.historyHeader}>Historical Mentions</div>
                          <div className={styles.historyBars}>
                            {existingAnalysis.historicalData.map((data, idx) => (
                              <div key={idx} className={styles.historyBar}>
                                <div className={styles.barFill} style={{ height: `${(data.mentions / 10) * 100}%` }}>
                                  <span className={styles.barValue}>{data.mentions}</span>
                                </div>
                                <span className={styles.barLabel}>{data.quarter}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
