import { Annotation, MemorySaver } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { messagesStateReducer } from "@langchain/langgraph";
import type { User } from "../../db";
import type { DAS } from "helius-sdk";

export const memory = new MemorySaver();

export const graphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  userAssets: Annotation<DAS.GetAssetResponse[]>({
    reducer: (oldValue, newValue) => newValue ?? oldValue,
    default: () => [],
  }),

  userProfile: Annotation<User | null>({
    reducer: (oldValue, newValue) => newValue ?? oldValue,
    default: () => null,
  }),

  isDataFetchNodeQuery: Annotation<boolean>({
    reducer: (oldValue, newValue) => newValue ?? oldValue,
    default: () => false,
  }),

  isGeneralQuery: Annotation<boolean>({
    reducer: (oldValue, newValue) => newValue ?? oldValue,
    default: () => false,
  }),

  // Signal生成用の追加フィールド
  token: Annotation<string | null>({
    reducer: (oldValue, newValue) => newValue ?? oldValue,
    default: () => null,
  }),

  collectedData: Annotation<any[]>({
    reducer: (oldValue, newValue) => newValue ?? oldValue,
    default: () => [],
  }),

  generatedSignal: Annotation<any | null>({
    reducer: (oldValue, newValue) => newValue ?? oldValue,
    default: () => null,
  }),
});
