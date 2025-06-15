import { gpt4o } from "../model";
import { logger } from "../../../utils/logger";
import type { graphState } from "../graph-state";
import { getDB } from "../../../db";
import { signal } from "../../../db/schema";
import { generateId } from "../../../utils/id";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

// Signal生成用のスキーマ定義
const SignalSchema = z.object({
  signalType: z.string().describe("Signal type (e.g., 'RSI_OVERBOUGHT', 'NEWS_ALERT', 'PRICE_DROP')"),
  value: z.record(z.any()).describe("Structured data related to the signal"),
  title: z.string().describe("User-friendly title for Telegram (with emojis)"),
  body: z.string().describe("Telegram markdown formatted body with data source links"),
  direction: z.enum(["BUY", "SELL", "NEUTRAL"]).optional().describe("Trading direction"),
  confidence: z.number().min(0).max(1).describe("Confidence level (0.0-1.0)"),
  explanation: z.string().describe("Detailed explanation of the signal reasoning"),
});

const parser = StructuredOutputParser.fromZodSchema(SignalSchema);

const signalPrompt = PromptTemplate.fromTemplate(`
You are a cryptocurrency signal generation AI. Your task is to analyze the collected data and generate actionable trading signals.

Token: {token}

Collected Data:
{collectedData}

Based on the collected data, generate a comprehensive signal with the following requirements:

1. **Signal Analysis**: Analyze all available data sources to identify trading opportunities or risks
2. **Title**: Create an engaging title with appropriate emojis for Telegram users
3. **Body**: Write a detailed Telegram markdown formatted message that includes:
   - Key findings from the data
   - Reasoning behind the signal
   - Risk assessment
   - Data source links where applicable
4. **Confidence**: Assign a confidence level based on data quality and signal strength
5. **Direction**: Determine if this is a BUY, SELL, or NEUTRAL signal

Format your response according to:
{formatInstructions}

Focus on actionable insights and clear communication for retail crypto traders.
`);

export const signalGeneratorNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  logger.info("signalGeneratorNode", "Starting signal generation");

  try {
    if (!state.token) {
      throw new Error("Token is required for signal generation");
    }

    const chain = signalPrompt.pipe(gpt4o).pipe(parser);

    const result = await chain.invoke({
      token: state.token,
      collectedData: JSON.stringify(state.collectedData, null, 2),
      formatInstructions: parser.getFormatInstructions(),
    });

    logger.info("signalGeneratorNode", "Generated signal:", result);

    // データベースに保存
    const db = getDB();
    const signalId = generateId();

    await db.insert(signal).values({
      id: signalId,
      token: state.token,
      signalType: result.signalType,
      value: result.value,
      title: result.title,
      body: result.body,
      direction: result.direction || null,
      confidence: result.confidence.toString(),
      explanation: result.explanation,
      timestamp: new Date(),
    });

    logger.info("signalGeneratorNode", `Signal saved with ID: ${signalId}`);

    return {
      ...state,
      generatedSignal: {
        id: signalId,
        ...result,
      },
    };
  } catch (error) {
    logger.error("signalGeneratorNode", "Error generating signal:", error);
    throw error;
  }
};