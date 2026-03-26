/**
 * MockNewsProvider — 30 realistic news items seeded for the 8 tracked tickers.
 *
 * TODO: Replace with a real provider:
 *   - Alpaca News API (NEWS_PROVIDER=alpaca, ALPACA_API_KEY)
 *   - Polygon.io Ticker News (NEWS_PROVIDER=polygon, POLYGON_API_KEY)
 *   - Benzinga Pro (NEWS_PROVIDER=benzinga, BENZINGA_API_KEY)
 *   - NewsAPI (NEWS_PROVIDER=newsapi, NEWSAPI_KEY)
 */

import type { INewsProvider } from "./interface";
import type { NewsItem, NewsCategory } from "../types";

// ─── Static news dataset ──────────────────────────────────────────────────────
// All dates relative to current date 2026-03-26.

const NEWS: NewsItem[] = [
  // ── NVDA ─────────────────────────────────────────────────────────────────
  {
    title:           "NVIDIA Blackwell GPU demand outstrips supply as data-center orders surge",
    summary:         "Hyperscalers are placing orders 12-18 months in advance for NVIDIA's GB200 NVL72 rack systems. TSMC CoWoS packaging remains the primary bottleneck, limiting meaningful supply expansion until late 2026.",
    source:          "The Information",
    url:             "https://example.com/nvda-blackwell-supply",
    publishedAt:     new Date("2026-03-24T14:32:00Z"),
    affectedTickers: ["NVDA", "TSM"],
    ticker:          "NVDA",
    category:        "company",
    sentiment:       "positive",
    importance:      "high",
    relevanceScore:  98,
  },
  {
    title:           "NVIDIA faces tightened China AI-chip export rules in expanded BIS order",
    summary:         "The Bureau of Industry and Security extended restrictions to cover the H20 chip, NVIDIA's only China-legal AI accelerator. Management estimated the affected revenue at ~$12B annually.",
    source:          "Wall Street Journal",
    url:             "https://example.com/nvda-china-export",
    publishedAt:     new Date("2026-03-21T17:00:00Z"),
    affectedTickers: ["NVDA"],
    ticker:          "NVDA",
    category:        "policy",
    sentiment:       "negative",
    importance:      "high",
    relevanceScore:  95,
  },
  {
    title:           "NVIDIA and Microsoft partner on sovereign AI infrastructure initiative",
    summary:         "A joint programme will provide governments with on-premise AI supercomputers based on DGX GB300 systems. Deals with seven European governments have already been announced.",
    source:          "Reuters",
    url:             "https://example.com/nvda-msft-sovereign-ai",
    publishedAt:     new Date("2026-03-19T10:15:00Z"),
    affectedTickers: ["NVDA", "MSFT"],
    ticker:          "NVDA",
    category:        "company",
    sentiment:       "positive",
    importance:      "medium",
    relevanceScore:  82,
  },
  {
    title:           "Analyst raises NVIDIA price target to $1,100 citing AI server upcycle",
    summary:         "Morgan Stanley raised its PT from $950 to $1,100 following channel checks confirming 40%+ sequential revenue growth in the data-centre segment through Q2 FY2027.",
    source:          "Bloomberg",
    url:             "https://example.com/nvda-pt-raise",
    publishedAt:     new Date("2026-03-18T09:00:00Z"),
    affectedTickers: ["NVDA"],
    ticker:          "NVDA",
    category:        "company",
    sentiment:       "positive",
    importance:      "medium",
    relevanceScore:  75,
  },
  {
    title:           "NVIDIA Q4 FY2026 earnings: EPS $5.16 vs $4.98 est., revenue +78% YoY",
    summary:         "NVIDIA reported record quarterly revenue of $39.3B, up 78% year-over-year, driven entirely by the data-centre segment. Gross margins expanded to 74.6%. Q1 guidance of $43B±2% exceeded consensus.",
    source:          "NVIDIA IR",
    url:             "https://example.com/nvda-q4-earnings",
    publishedAt:     new Date("2026-03-15T22:10:00Z"),
    affectedTickers: ["NVDA"],
    ticker:          "NVDA",
    category:        "earnings",
    sentiment:       "positive",
    importance:      "high",
    relevanceScore:  99,
  },

  // ── META ─────────────────────────────────────────────────────────────────
  {
    title:           "Meta's Llama 4 multimodal model outperforms GPT-4o on key benchmarks",
    summary:         "Llama 4 Scout and Maverick achieved state-of-the-art results on MMLU, MATH, and DocVQA while running at lower inference cost. Meta released the models under its community licence.",
    source:          "TechCrunch",
    url:             "https://example.com/meta-llama4",
    publishedAt:     new Date("2026-03-25T08:30:00Z"),
    affectedTickers: ["META"],
    ticker:          "META",
    category:        "company",
    sentiment:       "positive",
    importance:      "high",
    relevanceScore:  90,
  },
  {
    title:           "Meta Reality Labs Q4 operating loss widens to $4.8B; Zuckerberg doubles down",
    summary:         "The Reality Labs division posted a $4.8B operating loss in Q4 as Quest 3S adoption lags targets. Zuckerberg reiterated the company's multi-year metaverse commitment despite shareholder pressure.",
    source:          "Financial Times",
    url:             "https://example.com/meta-reality-labs-loss",
    publishedAt:     new Date("2026-03-22T16:45:00Z"),
    affectedTickers: ["META"],
    ticker:          "META",
    category:        "company",
    sentiment:       "negative",
    importance:      "medium",
    relevanceScore:  70,
  },
  {
    title:           "Meta advertising revenue accelerates as Reels time-on-app hits record high",
    summary:         "Average daily Reels views exceeded 600 billion, driving a 28% increase in ad impressions. CPM rates improved 11% YoY as targeting algorithms incorporated AI-generated creative data.",
    source:          "Business Insider",
    url:             "https://example.com/meta-reels-ad-revenue",
    publishedAt:     new Date("2026-03-20T13:00:00Z"),
    affectedTickers: ["META"],
    ticker:          "META",
    category:        "company",
    sentiment:       "positive",
    importance:      "medium",
    relevanceScore:  78,
  },
  {
    title:           "EU regulators open investigation into Meta's AI data-collection practices",
    summary:         "The European Data Protection Board launched a formal inquiry under the EU AI Act into Meta's use of European user data to train large language models. A preliminary ruling is expected within 6 months.",
    source:          "Reuters",
    url:             "https://example.com/meta-eu-ai-probe",
    publishedAt:     new Date("2026-03-17T11:20:00Z"),
    affectedTickers: ["META"],
    ticker:          "META",
    category:        "policy",
    sentiment:       "negative",
    importance:      "medium",
    relevanceScore:  65,
  },

  // ── MSFT ─────────────────────────────────────────────────────────────────
  {
    title:           "Microsoft Copilot adoption reaches 320M enterprise users",
    summary:         "Microsoft's AI productivity suite crossed 320 million monthly active enterprise users, making it the fastest-growing software product in company history. ARPU uplift from Copilot licences is now material to guidance.",
    source:          "Microsoft Blog",
    url:             "https://example.com/msft-copilot-users",
    publishedAt:     new Date("2026-03-24T16:00:00Z"),
    affectedTickers: ["MSFT"],
    ticker:          "MSFT",
    category:        "company",
    sentiment:       "positive",
    importance:      "high",
    relevanceScore:  88,
  },
  {
    title:           "Microsoft Azure cloud revenue accelerates to 33% growth, beats estimates",
    summary:         "Azure grew 33% in constant currency in Q3 FY2026, driven by AI workloads on H200 and Blackwell GPU clusters. CFO noted Azure AI revenue now exceeds $10B annualised run rate.",
    source:          "Bloomberg",
    url:             "https://example.com/msft-azure-growth",
    publishedAt:     new Date("2026-03-20T21:30:00Z"),
    affectedTickers: ["MSFT"],
    ticker:          "MSFT",
    category:        "earnings",
    sentiment:       "positive",
    importance:      "high",
    relevanceScore:  92,
  },
  {
    title:           "EU antitrust regulators target Microsoft over Teams bundling in Office 365",
    summary:         "The European Commission issued a Statement of Objections accusing Microsoft of unlawfully bundling Teams with Microsoft 365, potentially resulting in a fine of up to 10% of global revenue.",
    source:          "Wall Street Journal",
    url:             "https://example.com/msft-eu-teams",
    publishedAt:     new Date("2026-03-15T09:30:00Z"),
    affectedTickers: ["MSFT"],
    ticker:          "MSFT",
    category:        "policy",
    sentiment:       "negative",
    importance:      "low",
    relevanceScore:  50,
  },

  // ── AAPL ─────────────────────────────────────────────────────────────────
  {
    title:           "Apple unveils Vision Pro 2 with M4 chip at $2,499 — 44% lower than original",
    summary:         "The second-generation Vision Pro uses the M4 chip, drops the external battery pack, and adds native prescription lens support. Apple also announced developer tools for spatial AI apps.",
    source:          "9to5Mac",
    url:             "https://example.com/aapl-vision-pro-2",
    publishedAt:     new Date("2026-03-25T18:00:00Z"),
    affectedTickers: ["AAPL"],
    ticker:          "AAPL",
    category:        "company",
    sentiment:       "positive",
    importance:      "high",
    relevanceScore:  87,
  },
  {
    title:           "Apple Services revenue hits record $26.3B in Q2, up 15% YoY",
    summary:         "Apple's high-margin Services segment — including App Store, iCloud, Apple TV+, and financial services — posted record quarterly revenue of $26.3B with operating margins above 70%.",
    source:          "Apple IR",
    url:             "https://example.com/aapl-services-record",
    publishedAt:     new Date("2026-03-22T20:00:00Z"),
    affectedTickers: ["AAPL"],
    ticker:          "AAPL",
    category:        "earnings",
    sentiment:       "positive",
    importance:      "medium",
    relevanceScore:  80,
  },
  {
    title:           "iPhone market share slips in China as Huawei and Xiaomi gain ground",
    summary:         "IDC data shows Apple's China smartphone share fell to 14.8% in Q4 2025 from 17.3% a year earlier, as Huawei's Mate 70 Ultra and Xiaomi's 15 Ultra captured premium buyers.",
    source:          "IDC Research",
    url:             "https://example.com/aapl-china-share",
    publishedAt:     new Date("2026-03-18T07:00:00Z"),
    affectedTickers: ["AAPL"],
    ticker:          "AAPL",
    category:        "company",
    sentiment:       "negative",
    importance:      "medium",
    relevanceScore:  72,
  },

  // ── AMZN ─────────────────────────────────────────────────────────────────
  {
    title:           "Amazon launches Trainium3 AI training chips with 4× throughput improvement",
    summary:         "AWS unveiled Trainium3, built on a 2nm TSMC process, offering 4× faster training than Trainium2 for foundation models. Anthropic and Stability AI are first-party launch partners.",
    source:          "AWS Blog",
    url:             "https://example.com/amzn-trainium3",
    publishedAt:     new Date("2026-03-23T14:00:00Z"),
    affectedTickers: ["AMZN"],
    ticker:          "AMZN",
    category:        "company",
    sentiment:       "positive",
    importance:      "medium",
    relevanceScore:  76,
  },
  {
    title:           "Amazon Prime membership crosses 300M globally, ad tier drives growth",
    summary:         "Amazon disclosed that Prime has 300M members worldwide, with the ad-supported tier accounting for 40% of new sign-ups in 2025. Prime Video ad revenue grew to $6B annually.",
    source:          "CNBC",
    url:             "https://example.com/amzn-prime-300m",
    publishedAt:     new Date("2026-03-19T12:00:00Z"),
    affectedTickers: ["AMZN"],
    ticker:          "AMZN",
    category:        "company",
    sentiment:       "positive",
    importance:      "low",
    relevanceScore:  60,
  },

  // ── JPM ──────────────────────────────────────────────────────────────────
  {
    title:           "JPMorgan Q1 2026 earnings beat: EPS $4.61 vs $4.31 est., NII guidance raised",
    summary:         "JPMorgan Chase reported Q1 EPS of $4.61, topping estimates by $0.30. Net interest income came in at $23.4B. The bank raised full-year NII guidance to $90B, citing sticky deposit repricing.",
    source:          "JPMorgan IR",
    url:             "https://example.com/jpm-q1-2026",
    publishedAt:     new Date("2026-03-25T12:30:00Z"),
    affectedTickers: ["JPM"],
    ticker:          "JPM",
    category:        "earnings",
    sentiment:       "positive",
    importance:      "high",
    relevanceScore:  94,
  },
  {
    title:           "JPMorgan raises quarterly dividend 12% to $1.40 per share",
    summary:         "JPMorgan's board approved a 12% dividend increase following CCAR stress-test clearance. The bank also announced a $30B share repurchase authorisation for FY2026.",
    source:          "Reuters",
    url:             "https://example.com/jpm-dividend",
    publishedAt:     new Date("2026-03-16T16:00:00Z"),
    affectedTickers: ["JPM"],
    ticker:          "JPM",
    category:        "company",
    sentiment:       "positive",
    importance:      "medium",
    relevanceScore:  70,
  },

  // ── GOOGL ────────────────────────────────────────────────────────────────
  {
    title:           "Google DeepMind's Gemini 2.5 Ultra sets new MMLU and MATH benchmarks",
    summary:         "Gemini 2.5 Ultra scored 94.3 on MMLU and 87.7 on MATH, surpassing all competing models including Claude 4 Opus and GPT-5. The model is available via Google Cloud Vertex AI.",
    source:          "Google DeepMind Blog",
    url:             "https://example.com/googl-gemini-25",
    publishedAt:     new Date("2026-03-23T09:00:00Z"),
    affectedTickers: ["GOOGL", "GOOG"],
    ticker:          "GOOGL",
    category:        "company",
    sentiment:       "positive",
    importance:      "high",
    relevanceScore:  88,
  },
  {
    title:           "EU Court upholds €12.3B antitrust fine against Google in Shopping case",
    summary:         "The Court of Justice of the EU upheld the European Commission's landmark fine for Google's preferential treatment of Google Shopping. Google will pay the fine but has appealed on quantum.",
    source:          "Financial Times",
    url:             "https://example.com/googl-eu-fine",
    publishedAt:     new Date("2026-03-21T10:00:00Z"),
    affectedTickers: ["GOOGL"],
    ticker:          "GOOGL",
    category:        "policy",
    sentiment:       "negative",
    importance:      "high",
    relevanceScore:  80,
  },
  {
    title:           "YouTube Shorts ad revenue surpasses $8B annual run rate",
    summary:         "Alphabet disclosed that YouTube Shorts reached an $8B annual advertising run rate in Q4 2025. Shorts Watch time has grown 35% year-over-year, surpassing long-form video on mobile.",
    source:          "Alphabet IR",
    url:             "https://example.com/googl-shorts-revenue",
    publishedAt:     new Date("2026-03-17T14:30:00Z"),
    affectedTickers: ["GOOGL", "GOOG"],
    ticker:          "GOOGL",
    category:        "company",
    sentiment:       "positive",
    importance:      "medium",
    relevanceScore:  74,
  },

  // ── MACRO / SPY ───────────────────────────────────────────────────────────
  {
    title:           "Fed holds rates at 4.25-4.50%; Powell signals patience on cuts",
    summary:         "The FOMC voted unanimously to hold the federal funds rate target at 4.25-4.50%. Chair Powell cited firmer-than-expected inflation and a resilient labour market as reasons to wait before easing.",
    source:          "Federal Reserve",
    url:             "https://example.com/fomc-march-hold",
    publishedAt:     new Date("2026-03-20T18:00:00Z"),
    affectedTickers: ["SPY", "QQQ", "GLD"],
    ticker:          undefined,
    category:        "rates",
    sentiment:       "neutral",
    importance:      "high",
    relevanceScore:  96,
  },
  {
    title:           "February CPI +2.9% YoY, hotter than 2.7% forecast — equities sell off",
    summary:         "Core CPI rose 3.2% year-over-year in February, driven by shelter and services inflation. Markets priced out two of three expected 2026 rate cuts following the release.",
    source:          "Bureau of Labor Statistics",
    url:             "https://example.com/feb-cpi-2026",
    publishedAt:     new Date("2026-03-12T08:30:00Z"),
    affectedTickers: ["SPY", "QQQ", "BTC"],
    ticker:          undefined,
    category:        "macro",
    sentiment:       "negative",
    importance:      "high",
    relevanceScore:  95,
  },
  {
    title:           "Bank of Japan raises benchmark rate 25bps to 0.75%; yen strengthens",
    summary:         "The BoJ raised its policy rate to 0.75%, the highest since 2009, citing progress toward its 2% inflation target. USD/JPY fell 1.2% on the decision.",
    source:          "Bank of Japan",
    url:             "https://example.com/boj-rate-hike",
    publishedAt:     new Date("2026-03-19T03:00:00Z"),
    affectedTickers: ["SPY"],
    ticker:          undefined,
    category:        "fx",
    sentiment:       "neutral",
    importance:      "medium",
    relevanceScore:  68,
  },
  {
    title:           "S&P 500 closes at record 6,142 led by AI semiconductor rally",
    summary:         "The S&P 500 logged its third consecutive all-time high, with the semiconductor sector gaining 3.1% on the day. NVDA and AMD contributed 40% of the benchmark's point gain.",
    source:          "MarketWatch",
    url:             "https://example.com/sp500-record-march26",
    publishedAt:     new Date("2026-03-24T21:00:00Z"),
    affectedTickers: ["SPY", "QQQ", "NVDA"],
    ticker:          undefined,
    category:        "macro",
    sentiment:       "positive",
    importance:      "high",
    relevanceScore:  85,
  },

  // ── SECTOR ───────────────────────────────────────────────────────────────
  {
    title:           "Technology sector leads market as AI infrastructure spending shows no slowdown",
    summary:         "Goldman Sachs raised its 2026 Big Tech capex estimate to $420B, up from $380B prior. The firm sees AI infrastructure as a multi-year structural supercycle rather than a cyclical build.",
    source:          "Goldman Sachs Research",
    url:             "https://example.com/tech-sector-ai-capex",
    publishedAt:     new Date("2026-03-25T10:00:00Z"),
    affectedTickers: ["NVDA", "MSFT", "GOOGL", "AMZN", "META", "SPY"],
    ticker:          undefined,
    category:        "sector",
    sentiment:       "positive",
    importance:      "medium",
    relevanceScore:  82,
  },
  {
    title:           "Semiconductor cycle entering upcycle phase, WSTS forecasts +18% 2026 revenue",
    summary:         "The World Semiconductor Trade Statistics body revised 2026 global semiconductor revenue growth to +18.4%, driven by AI chips and automotive. DRAM prices rose 25% in Q1.",
    source:          "WSTS / Bloomberg",
    url:             "https://example.com/wsts-semiconductor-cycle",
    publishedAt:     new Date("2026-03-21T11:00:00Z"),
    affectedTickers: ["NVDA", "MSFT"],
    ticker:          undefined,
    category:        "sector",
    sentiment:       "positive",
    importance:      "medium",
    relevanceScore:  76,
  },
  {
    title:           "Bipartisan AI Safety Act passes Senate committee, targets frontier model oversight",
    summary:         "The bill would require safety evaluations for models above 10^26 FLOP training compute, mandatory incident reporting, and a new NIST AI Safety Board. Big Tech lobbied against mandatory pre-deployment testing.",
    source:          "Politico",
    url:             "https://example.com/ai-safety-act",
    publishedAt:     new Date("2026-03-18T19:00:00Z"),
    affectedTickers: ["NVDA", "MSFT", "GOOGL", "META", "AMZN"],
    ticker:          undefined,
    category:        "policy",
    sentiment:       "negative",
    importance:      "medium",
    relevanceScore:  70,
  },
];

// ─── Provider implementation ──────────────────────────────────────────────────

export class MockNewsProvider implements INewsProvider {
  readonly name = "Mock (built-in dataset)";

  async getLatestNews(limit: number): Promise<NewsItem[]> {
    return [...NEWS]
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, limit);
  }

  async getNewsByTicker(ticker: string, limit: number): Promise<NewsItem[]> {
    const upper = ticker.toUpperCase();
    return [...NEWS]
      .filter((n) => n.ticker === upper || n.affectedTickers.includes(upper))
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, limit);
  }

  async getNewsByCategory(category: string, limit: number): Promise<NewsItem[]> {
    return [...NEWS]
      .filter((n) => n.category === category)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, limit);
  }
}
