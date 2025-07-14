#!/usr/bin/env bun

import { createSignal } from "../src/utils/db";

async function testSignal() {
  const testSignalData = {
    id: "test_signal_123",
    token: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    signalType: "TEST_SIGNAL",
    value: { test: "value" },
    title: "Test Signal",
    body: "This is a test signal body",
    direction: "BUY",
    confidence: "0.8",
    explanation: "Test explanation",
    timestamp: new Date(),
  };

  try {
    console.log("Testing signal creation with data:", testSignalData);

    const result = await createSignal(testSignalData);
    console.log("Signal created successfully:", result);
  } catch (error) {
    console.error("Error creating signal:", error);

    // PostgreSQLのエラーをより詳細に出力
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
}

testSignal().catch(console.error);
