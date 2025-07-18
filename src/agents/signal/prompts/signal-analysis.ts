import { PromptTemplate } from "@langchain/core/prompts";

/**
 * Signal Analysis Prompts
 *
 * シグナル生成プロセスで使用する各種プロンプトテンプレート
 * - LLM分析用プロンプト
 * - エビデンス評価用プロンプト
 * - シグナルフォーマット用プロンプト
 */

/**
 * LLM Signal Analysis Prompt
 * テクニカル指標の複合分析によるシグナル生成判定
 */
export const signalAnalysisPrompt = new PromptTemplate({
  inputVariables: [
    "tokenSymbol",
    "tokenAddress",
    "currentPrice",
    "timestamp",
    "rsi",
    "vwapDeviation",
    "percentB",
    "adx",
    "atrPercent",
    "obvZScore",
    "triggeredIndicators",
    "signalCandidates",
    "confluenceScore",
    "riskLevel",
  ],
  template: `You are a professional crypto trading signal analyst. Your task is to analyze technical indicators and determine if a trading signal should be generated.

## Analysis Guidelines

**Signal Generation Criteria:**
- Multiple indicators must align (confluence)
- Risk-reward ratio must be favorable
- Market conditions must support the signal direction
- Confidence level must be above 60%

**Risk Assessment:**
- LOW: Single indicator, low volatility, stable trend
- MEDIUM: Multiple indicators, moderate volatility, developing trend
- HIGH: Strong confluence, high volatility, breakout/breakdown

**Timeframe Classification:**
- SHORT: Intraday signals (minutes to hours)
- MEDIUM: Swing trading signals (days to weeks)
- LONG: Position trading signals (weeks to months)

## Current Analysis Data

 **Token**: {tokenSymbol} ({tokenAddress})
 **Current Price**: {currentPrice}
 **Timestamp**: {timestamp}

**Technical Indicators**:
- RSI: {rsi}
- VWAP Deviation: {vwapDeviation}%
- Bollinger %B: {percentB}
- ADX: {adx}
- ATR%: {atrPercent}%
- OBV Z-Score: {obvZScore}

**Static Filter Results**:
- Triggered Indicators: {triggeredIndicators}
- Signal Candidates: {signalCandidates}
- Confluence Score: {confluenceScore}
- Risk Level: {riskLevel}

Based on this comprehensive technical analysis, determine if a trading signal should be generated. Consider the confluence of indicators, market volatility, and potential risk-reward scenarios.

Provide your analysis in the following structured format:
- shouldGenerateSignal: boolean
- signalType: string (specific signal type from candidates)
- direction: BUY or SELL or NEUTRAL
- confidence: number (0-1, minimum 0.6 for signal generation)
- reasoning: string (detailed explanation)
- keyFactors: array of up to 3 most important factors
- riskLevel: LOW or MEDIUM or HIGH
- timeframe: SHORT or MEDIUM or LONG`,
});

/**
 * Evidence Evaluation Prompt
 * 外部データソースの評価とシグナル信頼度向上
 */
export const evidenceEvaluationPrompt = new PromptTemplate({
  inputVariables: ["tokenSymbol", "signalType", "direction", "technicalReasoning", "externalSources"],
  template: `You are a crypto market research analyst evaluating external evidence to support or contradict technical trading signals.

## Evaluation Task

**Technical Signal Context:**
- Token: {tokenSymbol}
- Signal Type: {signalType}
- Direction: {direction}
- Technical Reasoning: {technicalReasoning}

**External Data Sources:**
{externalSources}

## Evaluation Criteria

**Source Reliability:**
- Official announcements: High weight
- Verified news outlets: Medium-high weight
- Social media sentiment: Medium weight
- Unverified sources: Low weight

**Relevance Assessment:**
- Direct impact on token fundamentals
- Market timing alignment
- Causal relationship strength
- Historical precedent

**Confidence Scoring:**
- 0.9-1.0: Strong supporting evidence
- 0.7-0.8: Moderate supporting evidence
- 0.5-0.6: Neutral/mixed evidence
- 0.3-0.4: Contradictory evidence
- 0.0-0.2: Strong contradictory evidence

Analyze the external evidence and provide:
- relevantSources: array of most relevant data points
- overallConfidence: number (0-1)
- primaryCause: string (main driving factor if identified)
- recommendation: INCLUDE or EXCLUDE or UNCERTAIN`,
});

/**
 * Signal Formatting Prompt
 * ユーザー向けシグナルメッセージの生成
 */
export const signalFormattingPrompt = new PromptTemplate({
  inputVariables: [
    "tokenSymbol",
    "tokenAddress",
    "signalType",
    "direction",
    "currentPrice",
    "confidence",
    "riskLevel",
    "timeframe",
    "reasoning",
    "keyFactors",
    "technicalData",
  ],
  template: `You are a crypto trading signal formatter. Create clear Telegram messages.

Token: {tokenSymbol}
Address: {tokenAddress}
Signal Type: {signalType}
Direction: {direction}
Price: {currentPrice}
Confidence: {confidence}
Risk Level: {riskLevel}
Timeframe: {timeframe}

Technical Data: {technicalData}
Reasoning: {reasoning}
Key Factors: {keyFactors}

Create a formatted signal message with level, title, message, priority, and tags.`,
});
