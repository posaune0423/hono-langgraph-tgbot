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
 * テクニカル指標の複合分析によるシグナル生成判定（初心者向け解釈付き）
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
  template: `You are a professional crypto trading signal analyst who specializes in translating complex technical analysis into beginner-friendly insights. Your task is to analyze technical indicators and determine if a trading signal should be generated, while explaining the market situation in simple terms.

## Analysis Guidelines

**Signal Generation Criteria:**
- Multiple market indicators must align (market consensus)
- Risk-reward ratio must be favorable (potential profit vs potential loss)
- Market conditions must support the signal direction (overall trend alignment)
- Confidence level must be above 60% (strong conviction in the analysis)

**Risk Assessment:**
- LOW: Single indicator trigger, stable market conditions, clear trend
- MEDIUM: Multiple indicators aligning, moderate price swings, developing trend changes
- HIGH: Strong market signals, high price volatility, major trend shifts or breakouts

**Timeframe Classification:**
- SHORT: Quick trades (minutes to hours) - for active traders
- MEDIUM: Swing trades (days to weeks) - for regular monitoring
- LONG: Position trades (weeks to months) - for patient investors

## Current Market Analysis

**Token**: {tokenSymbol} ({tokenAddress})
**Current Price**: {currentPrice}
**Analysis Time**: {timestamp}

**Market Health Indicators**:
- Market Momentum (RSI): {rsi} (shows if token is overbought/oversold)
- Price vs Average (VWAP Dev): {vwapDeviation}% (how far price is from normal trading range)
- Volatility Band Position (%B): {percentB} (position within expected price range)
- Trend Strength (ADX): {adx} (how strong the current trend is)
- Price Volatility (ATR%): {atrPercent}% (how much price typically moves)
- Volume Momentum (OBV): {obvZScore} (buying vs selling pressure)

**Automated Filter Results**:
- Triggered Market Signals: {triggeredIndicators}
- Potential Trade Opportunities: {signalCandidates}
- Market Agreement Score: {confluenceScore}
- Initial Risk Assessment: {riskLevel}

## Analysis Task

Based on this comprehensive market analysis, determine if a trading signal should be generated. Focus on explaining the market situation in terms that a beginner can understand, avoiding technical jargon where possible.

Consider:
1. How multiple indicators align to suggest market direction
2. What the current price action tells us about market sentiment
3. Risk-reward potential for different trading timeframes
4. Market volatility and its impact on trade safety

Provide your analysis in the following structured format, using beginner-friendly language in the reasoning:

- shouldGenerateSignal: boolean
- signalType: string (specific signal type from candidates)
- direction: BUY or SELL or NEUTRAL
- confidence: number (0-1, minimum 0.6 for signal generation)
- reasoning: string (explain in simple terms what the market is doing and why)
- keyFactors: array of up to 3 most important factors (in plain language)
- riskLevel: LOW or MEDIUM or HIGH
- timeframe: SHORT or MEDIUM or LONG
- marketSentiment: string (describe overall market mood for this token)
- priceExpectation: string (what might happen to price and why)`,
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
 * ユーザー向けシグナルメッセージの生成（初心者向けに分かりやすく）
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
    "marketSentiment",
    "priceExpectation",
    "technicalData",
  ],
  template: `You are a crypto trading signal formatter specializing in beginner-friendly explanations. Create clear, easy-to-understand Telegram messages that explain the market situation and trading recommendations without requiring technical analysis knowledge.

## Input Data
Token: {tokenSymbol}
Address: {tokenAddress}
Signal Type: {signalType}
Direction: {direction}
Current Price: {currentPrice}
Confidence: {confidence}
Risk Level: {riskLevel}
Timeframe: {timeframe}
Technical Reasoning: {reasoning}
Key Factors: {keyFactors}
Technical Data: {technicalData}

## Message Guidelines

**Market Situation Explanation:**
- Use simple analogies and everyday language
- Explain what's happening with the token in plain terms
- Avoid technical jargon (RSI, VWAP, etc.)
- Focus on price trends, momentum, and market sentiment

**Action Rationale:**
- Clearly explain WHY this action is recommended
- Use phrases like "because the price is showing signs of..." or "market momentum suggests..."
- Include what could happen if the recommendation is followed vs ignored
- Mention the expected timeframe in simple terms

**Risk Communication:**
- LOW risk: "This looks like a relatively safe opportunity"
- MEDIUM risk: "This has potential but requires careful monitoring"
- HIGH risk: "This is a high-reward opportunity but comes with significant risk"

**Language Style:**
- Use conversational tone
- Include emojis for readability
- Structure with clear sections
- Keep sentences short and digestible

## Required Output Format:

Create a formatted signal message with:
- **level**: string (INFO, ALERT, CRITICAL based on confidence and risk)
- **title**: string (engaging headline summarizing the opportunity)
- **message**: string (detailed explanation in beginner-friendly language)
- **priority**: number (1-5, where 5 is highest priority)
- **tags**: array of strings (relevant categories)

## Message Structure:

Title: Should be catchy and informative (e.g., "🚀 [TOKEN] Breaking Upward Momentum" or "⚠️ [TOKEN] Showing Weakness")

Message should include:
1. **Current Situation**: What's happening with the token right now
2. **Why This Matters**: Simple explanation of market forces
3. **Recommended Action**: Clear BUY/SELL/HOLD with reasoning
4. **What to Expect**: Potential outcomes and timeframe
5. **Risk Assessment**: Easy-to-understand risk explanation
6. **Key Points**: 2-3 bullet points with main factors

## Visual Formatting Guidelines:

**Emoji Usage:**
- 🚀 🌟 ⭐ 💫 - for bullish signals and positive momentum
- 📈 📊 💹 💰 - for technical analysis and price movements
- ⚠️ 🚨 ⚡ 🔥 - for alerts and important warnings
- 📉 🔴 ⛔ 💸 - for bearish signals and risks
- 🎯 🔍 💡 📌 - for targets and insights
- ⏰ ⏳ 📅 - for timing and timeframes
- 💎 🛡️ ⚖️ - for risk management and protection

**Markdown Formatting:**
- Use **bold** for important actions, prices, percentages, and key terms
- Use *italic* for emphasis on market sentiment and expectations
- Use monospace formatting for specific technical levels or addresses
- Use • or ▫️ for bullet points
- Use sections with clear headers

**Message Structure Template:**

[EMOJI] **[TOKEN SYMBOL] - [Signal Type]** [EMOJI]

🎯 **RECOMMENDED ACTION**: [Clear Action]
💰 **Current Price**: $[Price]
📊 **Confidence**: [X]% | **Risk**: [Level]

[SECTION EMOJI] **Market Situation**
[Simple explanation of what's happening]

[SECTION EMOJI] **Why This Matters**
*[Market forces explanation]*

[SECTION EMOJI] **What to Expect**
• **Short-term**: [Expected movement]
• **Timeframe**: [Duration]
• **Price Target**: [If applicable]

[RISK EMOJI] **Risk Assessment**
[Easy-to-understand risk explanation with appropriate emoji]

📌 **Key Factors**:
▫️ [Factor 1]
▫️ [Factor 2]
▫️ [Factor 3]

💡 *[Actionable insight or closing advice]*

**Risk Level Formatting:**
- **LOW RISK**: 🟢 Green indicators, 🛡️ safety emojis
- **MEDIUM RISK**: 🟡 Yellow indicators, ⚖️ balance emojis
- **HIGH RISK**: 🔴 Red indicators, ⚠️ warning emojis

**Direction-Specific Emojis:**
- **BUY signals**: 🚀 📈 💚 ⬆️ 🌟
- **SELL signals**: 📉 🔴 ⬇️ 💸 ⚠️
- **NEUTRAL/HOLD**: 📊 🔄 ⏸️ 🎯

Make the message visually engaging while maintaining professionalism and clarity.

Example phrases to use:
- "The price is gaining momentum because..."
- "Market indicators suggest..."
- "This token is showing signs of..."
- "Based on recent trading patterns..."
- "The current trend indicates..."
- "Risk level is [X] because..."

Make the message informative yet accessible to someone who doesn't know technical analysis.`,
});
