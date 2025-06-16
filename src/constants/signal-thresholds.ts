export const SIGNAL_THRESHOLDS = {
  // Phase 1: 静的事前フィルタ（コスト：ゼロ）
  STATIC_FILTERS: {
    // RSI極値
    RSI_EXTREME: {
      OVERSOLD: 25,
      OVERBOUGHT: 75,
      CRITICAL_OVERSOLD: 20,
      CRITICAL_OVERBOUGHT: 80,
    },

    // VWAP乖離率
    VWAP_DEVIATION: {
      MINOR: 1.0, // ±1%
      MODERATE: 2.0, // ±2%
      SIGNIFICANT: 3.0, // ±3%
      EXTREME: 4.0, // ±4%
    },

    // Bollinger Bands %B
    PERCENT_B: {
      OVERSOLD: 0.1, // 10%以下
      OVERBOUGHT: 0.9, // 90%以上
      BREAKOUT_UPPER: 1.0, // 上抜け
      BREAKOUT_LOWER: 0.0, // 下抜け
    },

    // ADX トレンド強度
    ADX_STRENGTH: {
      WEAK: 20, // 20以下：弱いトレンド
      DEVELOPING: 25, // 20-25：発展中
      ESTABLISHED: 40, // 25-40：確立
      OVERHEATED: 50, // 40+：過熱
    },

    // ATR% ボラティリティ
    ATR_VOLATILITY: {
      LOW: 1.0, // 1%以下：低ボラ
      NORMAL: 3.0, // 1-3%：通常
      HIGH: 5.0, // 3-5%：高ボラ
      EXTREME: 8.0, // 5%+：異常
    },

    // OBV Z-Score
    OBV_Z_SCORE: {
      NEUTRAL: 1.0, // ±1σ以内：中立
      MODERATE: 2.0, // ±1-2σ：注目
      STRONG: 3.0, // ±2-3σ：強い
      EXTREME: 4.0, // ±3σ+：異常
    },
  },

  // Phase 2: LLM判定用の複合条件
  LLM_TRIGGERS: {
    // 複数指標の同時発生
    CONFLUENCE_REQUIRED: 2, // 最低2つの指標が閾値を超える必要

    // 信頼度の最低基準
    MIN_CONFIDENCE: 0.6, // 60%以上の確信度が必要

    // 重要度による優先順位
    PRIORITY_WEIGHTS: {
      VWAP_DEVIATION: 0.3,
      RSI_EXTREME: 0.25,
      PERCENT_B_BREAKOUT: 0.2,
      ADX_STRENGTH: 0.15,
      OBV_Z_SCORE: 0.1,
    },
  },
} as const;

export const SIGNAL_TYPES = {
  // Level 1: Technical Only
  TECHNICAL: {
    RSI_OVERSOLD: "RSI_OVERSOLD",
    RSI_OVERBOUGHT: "RSI_OVERBOUGHT",
    VWAP_DEVIATION_HIGH: "VWAP_DEVIATION_HIGH",
    VWAP_DEVIATION_LOW: "VWAP_DEVIATION_LOW",
    BOLLINGER_BREAKOUT_UP: "BOLLINGER_BREAKOUT_UP",
    BOLLINGER_BREAKOUT_DOWN: "BOLLINGER_BREAKOUT_DOWN",
    HIGH_VOLATILITY: "HIGH_VOLATILITY",
    VOLUME_SPIKE: "VOLUME_SPIKE",
  },

  // Level 2: Evidence-Backed
  EVIDENCE_BACKED: {
    FUNDAMENTAL_BULLISH: "FUNDAMENTAL_BULLISH",
    FUNDAMENTAL_BEARISH: "FUNDAMENTAL_BEARISH",
    NEWS_DRIVEN_PUMP: "NEWS_DRIVEN_PUMP",
    SOCIAL_SENTIMENT_SHIFT: "SOCIAL_SENTIMENT_SHIFT",
  },

  // Level 3: Causal Analysis
  CAUSAL: {
    WHALE_ACTIVITY: "WHALE_ACTIVITY",
    PARTNERSHIP_ANNOUNCEMENT: "PARTNERSHIP_ANNOUNCEMENT",
    EXPLOIT_DETECTED: "EXPLOIT_DETECTED",
    REGULATORY_IMPACT: "REGULATORY_IMPACT",
  },
} as const;

export type SignalType =
  (typeof SIGNAL_TYPES)[keyof typeof SIGNAL_TYPES][keyof (typeof SIGNAL_TYPES)[keyof typeof SIGNAL_TYPES]];
