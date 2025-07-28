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
  timeout: 15000, // 15 second timeout
  apiKey: process.env.OPENAI_API_KEY,
});

export const kimiK2 = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "moonshotai/kimi-k2-instruct",
  timeout: 15000, // 15 second timeout
});

export const llama3370bVersatile = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  timeout: 15000, // 15 second timeout
});
