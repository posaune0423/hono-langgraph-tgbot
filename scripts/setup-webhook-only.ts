#!/usr/bin/env bun

/**
 * Script to register Telegram webhook using existing ngrok tunnel
 * This script waits for ngrok to be ready, gets the public URL, and registers it with Telegram
 * Exits after successful webhook registration
 */

const NGROK_API_URL = "http://localhost:4040/api/tunnels";
const NGROK_PORT = 8787;
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000; // 1 second

type NgrokTunnel = {
  public_url: string;
  config: { addr: string };
};

type NgrokApiResponse = {
  tunnels?: NgrokTunnel[];
};

function extractTunnelUrl(data: NgrokApiResponse): string | null {
  if (!data.tunnels || data.tunnels.length === 0) {
    return null;
  }

  const tunnel = data.tunnels.find(t => t.config.addr === `http://localhost:${NGROK_PORT}`);

  return tunnel?.public_url ?? data.tunnels[0]?.public_url ?? null;
}

async function fetchNgrokUrl(): Promise<string | null> {
  try {
    const response = await fetch(NGROK_API_URL);
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as NgrokApiResponse;
    return extractTunnelUrl(data);
  } catch {
    return null;
  }
}

async function waitForNgrok(maxRetries = MAX_RETRIES): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const url = await fetchNgrokUrl();
    if (url) {
      return url;
    }

    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }

  throw new Error(`ngrok not ready after ${maxRetries} retries`);
}

async function setWebhook(botToken: string, webhookUrl: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}/webhook/telegram`;

  try {
    const response = await fetch(url);
    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
      error_code?: number;
    };

    if (!data.ok) {
      throw new Error(`Failed to set webhook: ${data.description || "Unknown error"}`);
    }

    console.log(`✅ Webhook registered successfully: ${webhookUrl}/webhook/telegram`);
  } catch (error) {
    throw new Error(`Failed to set webhook: ${error}`);
  }
}

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error("❌ TELEGRAM_BOT_TOKEN environment variable is not set");
    console.error("   Make sure to run with: bun --env-file=.dev.vars run scripts/setup-webhook-only.ts");
    process.exit(1);
  }

  try {
    console.log("🔍 Waiting for ngrok to be ready...");
    const ngrokUrl = await waitForNgrok();
    console.log(`🌐 Found ngrok URL: ${ngrokUrl}`);

    console.log("📡 Registering webhook with Telegram...");
    await setWebhook(botToken, ngrokUrl);

    console.log("✨ Webhook setup complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
