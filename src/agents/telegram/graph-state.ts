import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, MemorySaver, messagesStateReducer } from "@langchain/langgraph";
import type { User } from "../../db";

export const memory = new MemorySaver();

export const graphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  userProfile: Annotation<User | null>({
    reducer: (oldValue, newValue) => newValue ?? oldValue,
    default: () => null,
  }),
});
