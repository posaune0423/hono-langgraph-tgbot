## Daiko Drift Bot Onboarding Flow（仕様案）

このドキュメントは、ユーザーの初回オンボーディングから入出金、ガス管理、資産統一（USDC）までを一貫して扱う最適な体験を定義します。pvp.trade に近い操作性を目標に、まずはシンプルに実装可能な仕様を提示し、将来的な 1tx バンドル等は拡張項目として切り出します。

### 目的（Goals）

- **ガス（SOL）確保**: Drift の `initializeUserAccount()` を実行するために必要最小限の SOL を自動的に確保。
- **資産は USDC に統一**: UX 簡便化のため、入金された資産は原則 USDC に自動スワップ（SOL は最小ガスのみ残す）。
- **入出金導線の単純化**: 入金はユーザーウォレット→Privy（Bot）→Drift、出金は Drift→Privy→ユーザーウォレット。

### 主要エンティティ

- **User Wallet**
- **Bot Wallet**
- **Drift User Account**
- **DB (Cloudflare D1)**
- **RPC (Helius)** = onchain data

### ポリシーとしきい値（抜粋）

- `minSol`: 0.02 SOL 目安（ガス最小残高）
- `targetSol`: 0.03 SOL 目安（ガス目標残高）
- `minDepositUSDC`: 15 USDC 目安（初期化に進む最低額）
- `minDepositSOL`: 0.15 SOL 目安（初期化に進む最低額）
- 入金は SOL/USDC を受け付けるが、オンボーディングの中で最終的に USDC に統一する

---

## コマンド別フロー

### `/start`（リファラルコード対応）

概要

- 既に Drift user があれば初期化はスキップ。
- いなければ最小入金の充足を確認し、満たしていれば最小限のガス（SOL）を確保してから `initializeUserAccount()` を実行。満たしていなければ、不足額を返信して終了。

### フローチャート

```mermaid
flowchart TD
  S0["/start (optional referral code)"] --> S1["Load or create Privy wallet"]
  S1 --> S2["Sync Helius webhook addresses"]
  S2 --> S3{"Drift user exists?"}
  S3 -- Yes --> S6S["Skip init"]
  S3 -- No --> S4{"Minimum deposit met?"}
  S4 -- Yes --> S5["Ensure min SOL gas (swap minimal USDC->SOL if needed)"]
  S5 --> S6I["Initialize Drift user account"]
  S4 -- No --> S8["Prompt user: show lacking amount; stop"]
  S6S --> S7["Show welcome & deposit instructions"]
  S6I --> S7["Show welcome & deposit instructions"]
```

### シーケンス（詳細: @Cloudflare Worker, @Drift SDK, @solana kit, @Helius）

```mermaid
sequenceDiagram
  participant U as User (Telegram)
  participant B as Bot (Cloudflare Worker)
  participant DB as Database
  participant P as Privy (Wallet API)
  participant H as Helius (Webhook)
  participant R as Solana RPC (@solana kit)
  participant D as Drift SDK

  U->>B: /start [referralCode?]
  B->>DB: getUser(userId)
  alt user not found
    B->>P: createWallet()
    P-->>B: {id: privyId, address}
    B->>DB: upsertUser(user, privyId, address, referralCode)
    B->>H: syncWebhookAddresses(address)
  else user exists
    B->>DB: load privyId, address, referralCode
  end

  B->>D: getDriftClient(privyId, address)
  B->>D: startSubscriptions()
  B->>D: user.exists()
  D-->>B: { exists: true|false }
  alt exists == false
    B->>R: getUSDCBalance(address)
    B->>R: getBalance(address)
    B-->>B: cond: (usdc >= minDepositUSDC) OR (sol >= minDepositSOL)
    alt below minimum
      B-->>U: reply missing amount to reach minimum
    else meets minimum
      B-->>B: cond: sol < minSol
      alt sol < minSol
        B->>R: quote USDC->SOL for (minSol - sol)
        R-->>B: quote
        B->>R: swap USDC->SOL using quote
        R-->>B: tx hash
      end
      B->>D: initializeUserAccount()
    end
  end
  B-->>U: welcome + deposit instructions
```

入出力（I/O）

- 入力: `referralCode?`
- 読み取り: DB（ユーザー/ウォレット）、RPC（SOL/USDC 残高）
- 副作用: Privy ウォレット作成、Helius アドレス同期、Drift user 初期化、ガス確保（USDC→SOL スワップ）

---

### `/deposit`（入金）

概要

- 入金は Helius Webhook で検知。最低入金を満たさない場合は、不足額を返信して終了。
- 充足していれば、（全 USDC のときは）init 前に最小 USDC→SOL スワップでガスを確保。
- Drift user が未作成なら init。以降は USDC に統一して、全 USDC を Drift に deposit。

### フローチャート

```mermaid
flowchart TD
  D0["Helius webhook: deposit detected"] --> D1{"Total >= minimum?"}
  D1 -- No --> D1a["Reply user: lacking amount; stop"]
  D1 -- Yes --> D2{"Asset == ALL USDC?"}
  D2 -- Yes --> D3["Ensure min SOL gas by swapping minimal USDC->SOL"]
  D2 -- No --> D4["Ensure min SOL gas (may be no-op)"]
  D3 --> D5{"Drift user exists?"}
  D4 --> D5
  D5 -- No --> D6["Initialize Drift user account"]
  D5 -- Yes --> D6S["Skip init"]
  D6 --> D7["Unify to USDC (swap remaining SOL -> USDC; keep min SOL)"]
  D6S --> D7
  D7 --> D8["Deposit all USDC to Drift"]
```

### シーケンス（詳細）

```mermaid
sequenceDiagram
  participant H as Helius (Webhook)
  participant B as Bot (Cloudflare Worker)
  participant R as Solana RPC (@solana kit)
  participant D as Drift SDK
  participant DB as Database
  participant TG as Telegram

  H-->>B: notify deposit {mint, amount, address}
  B->>R: getBalance(address)
  B->>R: getUSDCBalance(address)
  B-->>B: cond: (usdc >= minDepositUSDC) OR (sol >= minDepositSOL)
  alt below minimum
    B-->>TG: reply lacking amount to reach minimum
  else meets minimum
    B-->>B: cond: mint == USDC
    alt deposit == ALL USDC
      B-->>B: compute requiredSol = max(0, minSol - sol)
      alt requiredSol > 0
        B->>R: quote USDC->SOL for requiredSol
        R-->>B: quote
        B->>R: swap USDC->SOL using quote
        R-->>B: tx hash
      end
    else deposit has SOL
      B-->>B: ensure sol >= minSol (no-op if already)
    end
    B->>D: user.exists()
    D-->>B: { exists }
    alt exists == false
      B->>D: initializeUserAccount()
    end
    B-->>B: unify to USDC (keep minSol: swap remaining SOL->USDC)
    B->>D: deposit USDC (all USDC)
    B->>DB: log event/tx
    B-->>TG: notify user (balances, tx links)
  end
```

---

### `/withdraw`（出金: Drift → User Wallet）

概要

- 出金は **USDC のみ** 対応。Drift から USDC を受け、ユーザー ATA を確保して SPL トークン転送する。

### フローチャート

```mermaid
flowchart TD
  W0["/withdraw (dest, amount)"] --> W1["Validate dest & amount"]
  W1 --> W2["Drift withdraw USDC to Privy"]
  W2 --> W3["Ensure ATA & transfer USDC to user"]
  W3 --> W4["Reply success with tx link"]
```

### シーケンス（詳細）

```mermaid
sequenceDiagram
  participant U as User Wallet
  participant P as Bot Wallet (Privy)
  participant R as Solana RPC (@solana kit)
  participant D as Drift SDK

  U->>P: /withdraw (dest, amount)
  P->>P: validate dest (base58), amount > 0
  P->>D: withdraw(USDC)
  D-->>P: USDC received
  P->>R: ensure ATA + build SPL transfer
  P->>R: sign+send (Privy)
  R-->>P: tx hash
  P-->>U: confirm with tx hash
```

---

## 自動スワップ/ガス方針

- **ガス最小残高**: `minSol`（例: 0.02）未満なら、USDC→SOL を自動実行して補充。
- **資産統一**: 入金された SOL は `targetSol`（例: 0.03）を超える分を USDC に自動スワップ。
- **スリッページ**: `slippageBps` を設定（初期 50 = 0.5%）。Quote に基づき `minOut` を尊重。
- **手数料/優先料金**: Jupiter の `dynamicComputeUnitLimit` と `prioritizationFeeLamports: auto` を使用。

---

## エラー処理・リカバリ

- RPC エラー: リトライ戦略（指数バックオフ）、ユーザーへの再実行案内。
- スワップ失敗: Quote 取り直し、スリッページ拡大の提案、または最小金額での再試行。
- Drift アカウント未初期化: `/start` 誘導とガス残高不足の明示。
- アドレス検証: base58/ED25519 検証、USDC 送金時は ATA の作成を安全に実行。

---

## セキュリティ・運用

- Privy サーバーウォレットの署名は最小権限で実行。監査用ログ（tx hash、金額、先方アドレス）を記録。
- Helius Webhook 等で入金検知を一元管理。重複通知ガード。
- スワップ上限・一回当たりの最小/最大金額のガードレール設定。

---

## 将来拡張（スコープ外）

- 1tx バンドル（Drift withdraw + SPL Transfer / SOL Transfer を単一トランザクションに集約）。
- 自動入金→即時 deposit（ポリシーフラグ化、しきい値超過時のみ）。
- 価格情報の厳密化（Drift オラクル/Jupiter 見積りを用いた USDC 金額決定）。
- 失敗時の自動ロールバック/アラート。

---

## 開発メモ（実装の目安）

- Gas 管理: `ensureMinSolBalance(privyId, walletAddress, { minSol, targetSol, usdcTopUp })`
- スワップ: Jupiter v6 `quote`→`swap` で v0 トランザクションを取得し、Privy 署名→送信。
- Drift 操作: `deposit(USDC)` / `withdraw(USDC)` を基本とし、perp 取引の担保は USDC。

---

補足:

- `/start` コマンドは引数にリファラルコードを受け取り、ユーザー作成時に `referralCode` を保存します。
- すべての外部呼び出しは @Cloudflare Worker 上のサーバーハンドラ経由で行われ、@solana kit の接続、@Drift SDK のクライアント、@Helius Webhook 同期を使用します。
