import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { TIMEOUT_MS } from "../constants";

export const gpt4o = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
});

export const gpt4oMini = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  timeout: TIMEOUT_MS, // 8 second timeout for faster response
  apiKey: process.env.OPENAI_API_KEY,
});

export const kimiK2 = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "moonshotai/kimi-k2-instruct",
  timeout: TIMEOUT_MS, // 15 second timeout
});

export const llama3370bVersatile = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  timeout: TIMEOUT_MS, // 15 second timeout
});

export const gptOss120b = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  timeout: TIMEOUT_MS, // 15 second timeout
});
