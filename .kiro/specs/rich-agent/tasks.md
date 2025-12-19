# rich-agent - Implementation Tasks

> Generated from `design.md (v5)`.
> **Policy**: Neon(Postgres) only (no sqlite/d1-http, no D1, no KV).
> Note: `.kiro/settings/` に tasks テンプレート/ルールが存在しないため、本ファイルは既存 `tasks.md` の形式に合わせて生成する。

## 1. Project Infrastructure & Configuration

### 1.1 Add Neon/Postgres dependencies and secrets (P)
- [ ] Neon(Postgres) 接続と checkpointer に必要な依存を追加する（Neon serverless driver / LangGraph Postgres checkpointer / Drizzle Postgres driver）。
- [ ] `DATABASE_URL` をローカル `.dev.vars` と本番 secret に設定できるようにする（値はコミットしない）。
- [ ] 開発/本番で同一の env 名（`DATABASE_URL`）で参照できるようにする。
- **Requirements**: 8.8, 8.9

### 1.2 Switch Drizzle schema + migrations to Postgres-only
- [ ] `src/db/schema/*` を Postgres(pg-core) 前提に書き換える（`users/messages` を含む）。
- [ ] RAG/Vision/Decision/Checkpointer/Long-term memory の永続化テーブルを Postgres として定義する。
- [ ] drizzle-kit の生成/適用を Postgres 用に一本化する（migration 出力先も Postgres 前提に統一）。
- **Requirements**: 5.2.2, 5.3.2, 5.3.5, 5.4.2, 7.1.1, 7.2.1, 7.3.1, 7.4.1, 7.5.1

## 2. Persistence Layer (Repositories)

### 2.1 Define repository interfaces for business logic (P)
- [ ] Graph/Nodes から参照する永続化インターフェース（RAG, Vision cache, Decision log, Conversation log, Long-term memory, Checkpointer）を定義する。
- [ ] Repository は thread_id / userId（`tg:{telegram_user_id}`）を入力として受け取れる形にする。
- **Requirements**: 5.4.3, 5.4.5, 5.6.8, 7.1.1, 7.5.1

### 2.2 Implement Neon(Postgres) repositories
- [ ] RAG 取得（top-K + citation metadata）を Neon(Postgres) に対して実装する。
- [ ] Vision cache（sha256 キー）を Neon(Postgres) に対して実装する。
- [ ] retrieval decision log を Neon(Postgres) に対して実装する。
- [ ] conversation logs（users/messages）を Neon(Postgres) に対して実装する。
- [ ] long-term memory（namespace/key + json）を Neon(Postgres) に対して実装する。
- **Requirements**: 5.2.2, 5.3.4, 5.4.3, 5.4.4, 5.4.5, 5.6.8, 7.2.1, 7.3.1, 7.4.1, 7.5.1

### 2.3 Implement Neon(Postgres) checkpointer integration
- [ ] `@langchain/langgraph-checkpoint-postgres` の `PostgresSaver` を Neon(Pool 互換)で初期化できるようにする。
- [ ] Workers では `setup()` を実行しない前提で、migrations で必要テーブルが存在することを前提に動かす。
- **Requirements**: 5.4.1, 5.4.2, 5.5.1, 7.1.1, 8.1

## 3. Agent State & Nodes

### 3.1 Define agent state schema and validation
- [ ] 要件の State 形状を満たす State を定義する（messages/user/input/vision/rag/memory/routing/answer）。
- [ ] Vision summary の JSON 形状をスキーマで検証できるようにする。
- **Requirements**: 5.2.1, 5.2.3, 6.1.1

### 3.2 Implement Telegram input ingestion (text/photo/reply-photo)
- [ ] テキスト入力と画像入力（reply-to を含む）を正規化し、State の `input` に入れる。
- [ ] `thread_id` / `userId` を `tg:{telegram_user_id}` で固定して config に設定する。
- **Requirements**: 5.1.1, 5.1.2, 5.1.3

### 3.3 Implement vision summarize with sha256 cache
- [ ] sha256 を計算し、キャッシュヒット時は再推論せず DB から復元する。
- [ ] キャッシュミス時は vision 対応モデルで JSON 形状の summary を生成し、DB に保存して State に格納する。
- **Requirements**: 5.2.1, 5.2.2, 5.2.3, 8.6, 9.5

### 3.4 Implement routing + retrieval + web search
- [ ] intent を分類し、Direct/RAG/Web/RAG+Web を選択する。
- [ ] RAG を選択した場合は top-K chunk を取得し、引用メタデータを State に載せる。
- [ ] Web 検索を選択した場合は Tavily を呼び、引用として扱える形で State に載せる。
- [ ] 「なぜその選択をしたか」を decision log として保存する。
- **Requirements**: 5.3.4, 5.3.6, 5.6.1, 5.6.2, 5.6.3, 5.6.4, 5.6.5, 5.6.6, 5.6.7, 5.6.8, 6.3.2, 6.3.3, 8.4

### 3.5 Implement synthesis with explicit citations
- [ ] 回答生成で引用（source URL + section + chunk identifier / web source）を本文に含める。
- [ ] 可能ならストリーミング（部分テキスト）に対応する。
- **Requirements**: 5.1.4, 5.3.4, 5.6.7, 8.5, 9.1

### 3.6 Implement persistence + compaction
- [ ] 対話完了時に conversation logs と long-term memory（facts/preferences/tasks 等）を更新する。
- [ ] messages が肥大化した場合の compaction（要約 + windowing）を導入できる形にする。
- **Requirements**: 5.4.4, 5.5.2, 7.3.1, 7.5.1, 8.3

## 4. Graph Orchestration & Telegram Integration

### 4.1 Construct LangGraph StateGraph with conditional edges
- [ ] 要件のノードセットを持つ Graph を構築する。
- [ ] 画像が無い場合は vision をスキップする分岐を入れる。
- [ ] routing の結果により retrieve/web をスキップする分岐を入れる。
- [ ] node 境界での再実行安全性（冪等キー）を前提に組み立てる。
- **Requirements**: 6.2.1, 6.3.1, 6.3.2, 6.3.3, 6.3.4

### 4.2 Wire handler for streaming + per-user threading
- [ ] Telegram handler から Graph を起動し、`tg:{telegram_user_id}` を thread_id に設定する。
- [ ] typing/中間ステータス/部分テキスト等のストリーミングを Telegram に返す。
- **Requirements**: 5.1.1, 5.1.4, 8.5, 9.3

### 4.3 Enable durable execution (restart/resume)
- [ ] checkpointer を有効化し、再起動後に同一 thread_id で復元できることを担保する。
- [ ] interrupt/resume を導入できる拡張点を残す（入力不足/承認待ち）。
- **Requirements**: 5.4.1, 5.4.2, 5.5.1, 5.5.3, 8.1, 8.2, 9.4

## 5. RAG Ingestion Tooling

### 5.1 Implement ingestion pipeline with diff updates
- [ ] URL list / sitemap / local file を取り込みできるようにする。
- [ ] Document/Chunk 正規化、content_hash による差分判定、変更 chunk のみ embedding 更新を行う。
- [ ] citation に必要なメタデータ（source_url/title/section/chunk_id）を保存する。
- **Requirements**: 5.3.1, 5.3.2, 5.3.3, 5.3.5, 7.2.1, 8.7, 9.6

## 6. Verification

### 6.1 Unit tests for routing and repositories
- [ ] routing（intent/plan/skip 条件）を単体で検証する。
- [ ] repository の I/F 契約と主要クエリを単体で検証する（外部依存はモック化）。
- **Requirements**: 6.3.1, 6.3.2, 6.3.3, 8.3

### 6.2 Manual verification against acceptance criteria
- [ ] テキスト質問で引用付き回答が返ることを確認する。
- [ ] 画像入力（reply を含む）で vision 要約に基づく回答が返ることを確認する。
- [ ] 画像 sha256 キャッシュが効いて再推論しないことを確認する。
- [ ] 再起動後も同一 user の会話が継続できることを確認する。
- [ ] intent/plan に応じて Direct/RAG/Web が選択され、理由が記録されることを確認する。
- **Requirements**: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9
