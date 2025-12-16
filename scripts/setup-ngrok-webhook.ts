#!/usr/bin/env bun

/**
 * Script to start ngrok tunnel with real-time request logging
 * This script starts ngrok for port 8787 and displays all requests in real-time
 * Use this script to run ngrok and see request logs
 */

import { spawn } from "node:child_process";

const NGROK_PORT = 8787;

let ngrokProcess: ReturnType<typeof spawn> | null = null;

// Cleanup on exit
process.on("SIGINT", () => {
  if (ngrokProcess) {
    ngrokProcess.kill();
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (ngrokProcess) {
    ngrokProcess.kill();
  }
  process.exit(0);
});

async function main() {
  console.log(`🚀 Starting ngrok tunnel for port ${NGROK_PORT}...`);
  console.log("   Request logs will be displayed in real-time below.\n");

  ngrokProcess = spawn("ngrok", ["http", String(NGROK_PORT)], {
    stdio: "inherit",
    detached: false,
  });

  ngrokProcess.on("error", error => {
    console.error(`❌ Failed to start ngrok: ${error.message}. Make sure ngrok is installed and in your PATH.`);
    process.exit(1);
  });

  ngrokProcess.on("exit", code => {
    process.exit(code ?? 0);
  });

  // Keep the process alive
  await new Promise(() => {
    // Keep running indefinitely
  });
}

main();
