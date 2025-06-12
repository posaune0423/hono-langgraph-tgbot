import type { Bot, Context } from "grammy";
import { initGraph } from "../../agent/graph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { StreamChunk } from "../../types";
import { logger } from "../../utils/logger";
import { SetupStep } from "../../types";
import { proceedToNextStep } from "./command";
import { isValidSolanaAddress } from "../../utils/solana";
import { dumpTokenUsage, isAnalyzerMessage, isGeneralistMessage } from "../../utils";
import { getUserProfile, updateUserProfile, getChatHistory, saveChatMessage, createTokens } from "../../utils/db";
import { timeoutPromise } from "../../utils";
import { getAssetsByOwner } from "../helius";
import { NewToken, tokens } from "../../db";

export const setupHandler = (bot: Bot) => {
  bot.on("message:text", async (ctx: Context) => {
    const userId = ctx.from?.id.toString();
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;
    const lastName = ctx.from?.last_name;

    if (!userId || !ctx.message?.text) {
      logger.warn("message handler", "User ID or message text is null");
      return;
    }

    try {
      const profile = await getUserProfile(userId);

      // Check if user is in setup process
      if (profile?.waitingForInput) {
        // Handle setup process input
        const waitingFor = profile.waitingForInput;
        const text = ctx.message.text;

        // Process input values for setup
        switch (waitingFor) {
          case SetupStep.WALLET_ADDRESS: {
            if (!isValidSolanaAddress(text)) {
              await ctx.reply("Please enter a valid wallet address.", {
                parse_mode: "Markdown",
              });
              return;
            }

            await updateUserProfile(userId, {
              walletAddress: text,
              username,
              firstName,
              lastName,
              waitingForInput: null,
            });

            await ctx.reply(`Wallet address set to ${text}!`, {
              parse_mode: "Markdown",
            });

            const assets = await getAssetsByOwner(text);
            const userTokens: NewToken[] = assets.map((asset) => ({
              symbol: asset.content?.metadata?.symbol || asset.token_info?.symbol || "",
              name: asset.content?.metadata?.name || "",
              decimals: asset.token_info?.decimals || 9,
              address: asset.id,
              iconUrl: asset.content?.files?.[0]?.uri || "",
            }));

            // Insert tokens into database, ignoring duplicates
            await createTokens(userTokens);

            // Proceed to the next step
            await proceedToNextStep(ctx, userId, SetupStep.WALLET_ADDRESS);
            break;
          }
          // case SetupStep.AGE: {
          //     const age = Number.parseInt(text);
          //     if (Number.isNaN(age) || age <= 0 || age >= 120) {
          //         await ctx.reply("Please enter a valid age (numbers only).", {
          //             parse_mode: "Markdown",
          //         });
          //         return;
          //     }

          //     await kvStore.updateUserProfile(userId, {
          //         age,
          //         waitingForInput: null,
          //     });

          //     await ctx.reply(`Age set to ${age} years!`, {
          //         parse_mode: "Markdown",
          //     });

          //     // Proceed to the next step
          //     await proceedToNextStep(ctx, env, userId, SetupStep.AGE);
          //     break;
          // }

          // case SetupStep.TOTAL_ASSETS: {
          //     const totalAssets = Number.parseInt(text.replace(/[,\s]/g, ""));
          //     if (Number.isNaN(totalAssets) || totalAssets < 0) {
          //         await ctx.reply("Please enter a valid amount (numbers only).", {
          //             parse_mode: "Markdown",
          //         });
          //         return;
          //     }

          //     await kvStore.updateUserProfile(userId, {
          //         totalAssets,
          //         waitingForInput: null,
          //     });

          //     await ctx.reply(
          //         `Total assets set to ${totalAssets.toLocaleString()} USD!`,
          //         {
          //             parse_mode: "Markdown",
          //         },
          //     );

          //     // Proceed to the next step
          //     await proceedToNextStep(ctx, env, userId, SetupStep.TOTAL_ASSETS);
          //     break;
          // }

          // case SetupStep.CRYPTO_ASSETS: {
          //     const cryptoAssets = Number.parseInt(text.replace(/[,\s]/g, ""));
          //     if (Number.isNaN(cryptoAssets) || cryptoAssets < 0) {
          //         await ctx.reply("Please enter a valid amount (numbers only).", {
          //             parse_mode: "Markdown",
          //         });
          //         return;
          //     }

          //     await kvStore.updateUserProfile(userId, {
          //         cryptoAssets,
          //         waitingForInput: null,
          //     });

          //     await ctx.reply(
          //         `Crypto assets set to ${cryptoAssets.toLocaleString()} USD!`,
          //         {
          //             parse_mode: "Markdown",
          //         },
          //     );

          //     // Proceed to the next step
          //     await proceedToNextStep(ctx, env, userId, SetupStep.CRYPTO_ASSETS);
          //     break;
          // }
        }
        return;
      }

      // If user has completed setup or is not in setup process, handle as normal conversation
      const thinkingMessage = await ctx.reply("🧠 Thinking...");

      // initialize graph
      const { agent, config } = await initGraph(userId);
      logger.debug("message handler", "Initialized Graph");

      // Load chat history from database
      const userChatHistory = await getChatHistory(userId);

      // Add current user message to history
      const currentUserMessage = new HumanMessage(ctx.message.text);
      await saveChatMessage(userId, currentUserMessage);

      // analyzerまたはgeneralistのメッセージを格納する変数
      let latestAgentMessage: string | null = null;

      // send user message to agent
      const stream = await agent.stream(
        {
          messages: [...userChatHistory, currentUserMessage],
          userProfile: profile,
        },
        config,
      );
      logger.info("message handler", "Stream created");

      // process response from stream
      try {
        for await (const chunk of (await Promise.race([stream, timeoutPromise])) as AsyncIterable<StreamChunk>) {
          // Get analyzer or generalist message from chunk
          if (isAnalyzerMessage(chunk)) {
            const lastIndex = chunk.analyzer.messages.length - 1;
            if (chunk.analyzer.messages[lastIndex]?.content) {
              latestAgentMessage = String(chunk.analyzer.messages[lastIndex].content);
              logger.debug("message handler", "Got analyzer message", latestAgentMessage);
            }
          } else if (isGeneralistMessage(chunk)) {
            const lastIndex = chunk.generalist.messages.length - 1;
            if (chunk.generalist.messages[lastIndex]?.content) {
              latestAgentMessage = String(chunk.generalist.messages[lastIndex].content);
              logger.debug("message handler", "Got generalist message", latestAgentMessage);
            }
          }

          dumpTokenUsage(chunk);

          // latestAgentMessageが取得できた場合の処理
          if (latestAgentMessage) {
            if (!ctx.chat?.id) return;
            await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
            await ctx.reply(latestAgentMessage, {
              parse_mode: "Markdown",
            });

            // Save AI message to database
            const aiMessage = new AIMessage(latestAgentMessage);
            await saveChatMessage(userId, aiMessage);
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message === "Timeout") {
          await ctx.reply("I'm sorry, the operation took too long and timed out. Please try again.");
        } else {
          logger.error("message handler", "Error processing stream:", error);
          await ctx.reply("I'm sorry, an error occurred while processing your request.");
        }
      }
    } catch (error) {
      logger.error("message handler", "Error initializing agent:", error);
      await ctx.reply("I'm sorry, an error occurred while initializing the agent.");
    }
  });
};
