import { ChatOpenAI } from "@langchain/openai";

/**
 * Signal Generator用のLLMモデル設定
 *
 * GPT-4o-miniを使用してコスト効率を重視
 * 構造化出力に対応したモデルインスタンスを提供
 */
export const createSignalModel = () => {
  return new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.1, // 一貫性を重視した低温度設定
  });
};
