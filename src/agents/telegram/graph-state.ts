import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, MemorySaver, messagesStateReducer } from "@langchain/langgraph";
import type { User } from "../../db";

export const memory = new MemorySaver();

export const graphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  user: Annotation<User | null>({
    reducer: (oldValue, newValue) => newValue ?? oldValue,
    default: () => null,
  }),

  isDataFetchNodeQuery: Annotation<boolean>({
    reducer: (oldValue, newValue) => newValue ?? oldValue ?? false,
    default: () => false,
  }),

  isGeneralQuery: Annotation<boolean>({
    reducer: (oldValue, newValue) => newValue ?? oldValue ?? false,
    default: () => false,
  }),
});
