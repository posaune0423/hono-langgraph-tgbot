import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { welcomeMessage } from "./msg-template";
import { SetupStep } from "../../types";
import { getUserProfile, updateUserProfile, upsertUserProfile, clearChatHistory } from "../../utils/db";
import { NewUser } from "../../db";
import { logger } from "../../utils/logger";

export const setupCommands = (bot: Bot) => {
  bot.command("start", async (ctx) => {
    const keyboard = new InlineKeyboard().text("✅ Agree and start", "start_agree");

    await ctx.reply(welcomeMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  });

  // Callback query handler for agreement button
  bot.callbackQuery("start_agree", async (ctx) => {
    await ctx.answerCallbackQuery({
      text: "Thank you! Starting Daiko AI...",
    });

    if (!ctx.from) {
      await ctx.reply("Could not retrieve user information. Please try again.", {
        parse_mode: "Markdown",
      });
      return;
    }

    // Get existing profile or create a new one
    const userId = ctx.from.id.toString();
    let userProfile = await getUserProfile(userId);

    if (!userProfile) {
      // Create new user profile
      const newProfile: NewUser = {
        userId,
        walletAddress: "",
      };

      await upsertUserProfile(newProfile);
      userProfile = await getUserProfile(userId);
    }

    // Send confirmation message
    await ctx.reply("Thank you for agreeing to use Daiko AI! Let's set up your profile.", {
      parse_mode: "Markdown",
    });

    // Proceed to the first setup step
    await proceedToNextStep(ctx, userId, null);
  });

  // Register setup command handler
  bot.command("setup", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Could not retrieve user information. Please try again.", {
        parse_mode: "Markdown",
      });
      return;
    }

    const userId = ctx.from.id.toString();

    // Get existing profile or create a new one
    let userProfile = await getUserProfile(userId);

    if (!userProfile) {
      // Create new user profile
      const newProfile: NewUser = {
        userId,
        walletAddress: "",
      };

      await upsertUserProfile(newProfile);
      userProfile = await getUserProfile(userId);
    }

    await ctx.reply("Starting profile setup.", {
      parse_mode: "Markdown",
    });

    // Proceed to the first setup step
    await proceedToNextStep(ctx, userId, null);
  });

  // Risk tolerance selection handler (1-10)
  for (let i = 1; i <= 10; i++) {
    bot.callbackQuery(`risk_${i}`, async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id.toString();
      const profile = await getUserProfile(userId);

      if (!profile || profile.currentSetupStep !== SetupStep.RISK_TOLERANCE) return;

      await ctx.answerCallbackQuery({
        text: `Risk tolerance set to ${i}!`,
      });

      await updateUserProfile(userId, { cryptoRiskTolerance: i });

      // Proceed to the next step
      await proceedToNextStep(ctx, userId, SetupStep.RISK_TOLERANCE);
    });
  }

  bot.command("help", async (ctx) => {
    await ctx.reply("Please use /setup to start the setup process. If you need help, please contact @DaikoAI.", {
      parse_mode: "Markdown",
    });
  });

  bot.command("feedback", async (ctx) => {
    await ctx.reply(
      "If you have feedback or issues, please open an issue here: https://github.com/Daiko-AI/daiko-ai-mvp-tgbot/issues",
      {
        parse_mode: "Markdown",
      },
    );
  });

  bot.command("clear", async (ctx) => {
    const userId = ctx.from?.id.toString();

    if (!userId) {
      await ctx.reply("Could not retrieve user information. Please try again.", {
        parse_mode: "Markdown",
      });
      return;
    }

    try {
      await clearChatHistory(userId);
      await ctx.reply("🗑️ Chat history has been cleared!", {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("clear command", "Error clearing chat history:", error);
      await ctx.reply("❌ Error clearing chat history. Please try again.", {
        parse_mode: "Markdown",
      });
    }
  });
};

// Function to proceed to the next setup step
export const proceedToNextStep = async (ctx: Context, userId: string, currentStep: SetupStep | null) => {
  let nextStep: SetupStep;

  // Determine the next step based on the current step
  if (!currentStep) {
    nextStep = SetupStep.WALLET_ADDRESS;
  } else {
    switch (currentStep) {
      case SetupStep.WALLET_ADDRESS:
        // nextStep = SetupStep.AGE;
        nextStep = SetupStep.COMPLETE;
        break;
      // case SetupStep.AGE:
      //     nextStep = SetupStep.RISK_TOLERANCE;
      //     break;
      // case SetupStep.RISK_TOLERANCE:
      //     nextStep = SetupStep.TOTAL_ASSETS;
      //     break;
      // case SetupStep.TOTAL_ASSETS:
      //     nextStep = SetupStep.CRYPTO_ASSETS;
      //     break;
      // case SetupStep.CRYPTO_ASSETS:
      //     nextStep = SetupStep.COMPLETE;
      //     break;
      default:
        nextStep = SetupStep.COMPLETE;
    }
  }

  // Display prompts based on the next step
  switch (nextStep) {
    case SetupStep.WALLET_ADDRESS: {
      await ctx.reply("First, please tell me your wallet address:", {
        parse_mode: "Markdown",
      });
      await updateUserProfile(userId, {
        waitingForInput: SetupStep.WALLET_ADDRESS,
        currentSetupStep: SetupStep.WALLET_ADDRESS,
      });
      break;
    }

    // case SetupStep.AGE: {
    //     await ctx.reply("First, please tell me your age (numbers only):", {
    //         parse_mode: "Markdown",
    //     });
    //     await kvStore.updateUserProfile(userId, {
    //         waitingForInput: SetupStep.AGE,
    //         currentSetupStep: SetupStep.AGE,
    //     });
    //     break;
    // }

    // case SetupStep.RISK_TOLERANCE: {
    //     const riskKeyboard = new InlineKeyboard()
    //         .text("1️⃣", "risk_1")
    //         .text("2️⃣", "risk_2")
    //         .text("3️⃣", "risk_3")
    //         .row()
    //         .text("4️⃣", "risk_4")
    //         .text("5️⃣", "risk_5")
    //         .text("6️⃣", "risk_6")
    //         .row()
    //         .text("7️⃣", "risk_7")
    //         .text("8️⃣", "risk_8")
    //         .text("9️⃣", "risk_9")
    //         .row()
    //         .text("🔟", "risk_10");

    //     await ctx.reply(
    //         "Next, please select your risk tolerance for crypto assets on a scale of 1-10:\n\n" +
    //             "1️⃣ = Very conservative (risk-averse)\n" +
    //             "5️⃣ = Balanced\n" +
    //             "🔟 = Aggressive (high risk tolerance)",
    //         {
    //             parse_mode: "Markdown",
    //             reply_markup: riskKeyboard,
    //         },
    //     );
    //     await kvStore.updateUserProfile(userId, {
    //         currentSetupStep: SetupStep.RISK_TOLERANCE,
    //     });
    //     break;
    // }

    // case SetupStep.CRYPTO_ASSETS: {
    //     await ctx.reply(
    //         "Enter an approximate total value of all your crypto across all wallets (numbers only, in USD):",
    //         {
    //             parse_mode: "Markdown",
    //         },
    //     );
    //     await kvStore.updateUserProfile(userId, {
    //         waitingForInput: SetupStep.CRYPTO_ASSETS,
    //         currentSetupStep: SetupStep.CRYPTO_ASSETS,
    //     });
    //     break;
    // }

    // case SetupStep.TOTAL_ASSETS: {
    //     await ctx.reply(
    //         "Enter an approximate total value of all your assets, including stocks, real estate, etc (numbers only, in USD):",
    //         {
    //             parse_mode: "Markdown",
    //         },
    //     );
    //     await kvStore.updateUserProfile(userId, {
    //         waitingForInput: SetupStep.TOTAL_ASSETS,
    //         currentSetupStep: SetupStep.TOTAL_ASSETS,
    //     });
    //     break;
    // }

    case SetupStep.COMPLETE: {
      const profile = await getUserProfile(userId);

      // let profileSummary =
      //     "*Profile Setup Complete*\n\nHere is your profile information:\n\n";

      // if (profile) {
      //     if (profile.age) profileSummary += `🔢 Age: ${profile.age} years\n`;
      //     if (profile.cryptoRiskTolerance)
      //         profileSummary += `📊 Risk Tolerance: ${profile.cryptoRiskTolerance}/10\n`;
      //     if (profile.totalAssets)
      //         profileSummary += `💰 Total Assets: ${profile.totalAssets.toLocaleString()} USD\n`;
      //     if (profile.cryptoAssets)
      //         profileSummary += `🪙 Crypto Assets: ${profile.cryptoAssets.toLocaleString()} USD\n`;
      // }

      const profileSummary =
        "*Setup is complete!* \n I’ll keep an eye on your tokens and alert you with the reason when danger’s near.";

      await ctx.reply(profileSummary, {
        parse_mode: "Markdown",
      });

      // Mark setup as complete
      await updateUserProfile(userId, {
        waitingForInput: null,
        currentSetupStep: null,
        setupCompleted: true,
      });
      break;
    }
  }
};
