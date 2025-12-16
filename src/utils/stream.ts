/**
 * Type for the reply function that can be injected
 * This allows the stream handler to work with any chat platform (Telegram, Slack, Discord, etc.)
 */
export type ReplyFunction = (content: string) => Promise<void>;

/**
 * Type for the LangGraph stream event output
 */
type StreamEventOutput = {
  messages?: Array<{ content?: string }>;
};

/**
 * Processes a LangGraph stream and sends messages using the provided reply function.
 * Handles deduplication to prevent sending the same message multiple times.
 *
 * @param stream - AsyncIterable stream from LangGraph
 * @param reply - Function to send messages (platform-agnostic)
 * @returns Set of sent message contents for tracking
 *
 * @example
 * // With Telegram
 * await processGraphStream(stream, (content) => ctx.reply(content));
 *
 * // With Slack
 * await processGraphStream(stream, (content) => slackClient.postMessage({ text: content }));
 *
 * // With Discord
 * await processGraphStream(stream, (content) => channel.send(content));
 */
export async function processGraphStream(
  stream: AsyncIterable<Record<string, unknown>>,
  reply: ReplyFunction,
): Promise<Set<string>> {
  const sentMessages = new Set<string>();

  for await (const event of stream) {
    for (const [_nodeName, nodeOutput] of Object.entries(event)) {
      const state = nodeOutput as StreamEventOutput;
      const content = state.messages?.[state.messages.length - 1]?.content?.toString();

      if (!content || sentMessages.has(content)) continue;

      // Send intermediate output from generalist node or final output from __end__
      sentMessages.add(content);
      await reply(content);
    }
  }

  return sentMessages;
}
