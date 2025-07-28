import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";

export const gpt4o = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
});

export const gpt4oMini = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
});

// Lazy initialization for Groq to avoid test errors
export const createLlama3370bVersatile = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  return new ChatGroq({
    apiKey,
    model: "llama-3.3-70b-versatile",
  });
};
