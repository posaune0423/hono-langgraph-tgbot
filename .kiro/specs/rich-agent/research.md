# rich-agent - Research Log

## Summary

本機能は、LangGraph.jsベースのRAG（Retrieval-Augmented Generation）エージェントを実装する複雑な新規機能です。Telegram Bot上で、事前登録されたドキュメント、ローカル文書、ユーザー送信画像を根拠として引用付き回答を提供します。

**発見スコープ**: フルディスカバリー（新規機能・複雑な統合）

**主要な技術決定**:
- LangGraph.jsのconditional edgesによるAgentic RAG実装
- Cloudflare Vectorizeによるベクトル検索
- Cloudflare KVによる長期メモリ保存
- Neon PostgreSQLベースのcheckpointer実装（`@langchain/langgraph-checkpoint-postgres`）
- GPT-4o Vision APIによる画像処理
- Tavily Search APIによるWeb検索

## Research Log

### 1. LangGraph.js Agentic RAG Patterns

**調査内容**: LangGraph.jsでの条件分岐エッジとretrieval decisionの実装パターン

**情報源**:
- [LangChain Agentic RAG Documentation](https://docs.langchain.com/oss/javascript/langgraph/agentic-rag)

**主要な発見**:
- `addConditionalEdges()`を使用して、retrievalが必要かどうかを判定するノードから動的に分岐可能
- 判定関数はStateを評価し、次のノード名（例: `"retrieve"`, `"generate"`）を返す
- retrieval decisionはStateの`routing.plan`フィールドに記録し、後続ノードで参照可能

**設計への影響**:
- `N4_build_effective_query`ノードでretrieval decisionを実施し、conditional edgeで`N5_retrieve`または`N6_synthesize`へ分岐
- Web検索の必要性も同様にconditional edgeで判定

### 2. Neon PostgreSQL Checkpointer Implementation

**調査内容**: LangGraph.jsのcheckpointerをNeon PostgreSQLで実装する方法

**情報源**:
- [LangGraph.js PostgreSQL Checkpointer](https://langchain-ai.github.io/langgraphjs/reference/modules/langgraph-checkpoint-postgres.html)
- Neon PostgreSQL Documentation

**主要な発見**:
- LangGraph.jsには`@langchain/langgraph-checkpoint-postgres`パッケージが存在
- `PostgresSaver.fromConnString()`でNeon PostgreSQL接続文字列から直接初期化可能
- `checkpointer.setup()`で自動的にテーブルスキーマを作成
- NeonはサーバーレスPostgreSQLで、Cloudflare Workersから接続可能

**設計への影響**:
- `PostgresSaver`を直接使用し、カスタム実装は不要
- Neon PostgreSQL接続文字列を環境変数`NEON_DATABASE_URL`で管理
- 本番環境ではPostgreSQL-backed checkpointerを必須とする（REQ-MEM-2）

### 3. Neon PostgreSQL + pgvector Integration with LangChain

**調査内容**: Neon PostgreSQLのpgvector拡張をLangChain.jsで使用する方法

**情報源**:
- [LangChain Neon Postgres Integration](https://docs.langchain.com/oss/javascript/integrations/vectorstores/neon)
- [Neon pgvector Documentation](https://neon.com/docs/extensions/pgvector)

**主要な発見**:
- `@langchain/community`パッケージに`NeonPostgres` vector storeが含まれる
- Neon PostgreSQLで`pgvector`拡張を有効化可能
- OpenAI Embeddings API（text-embedding-3-small）を使用してベクトル生成
- `similaritySearch()`, `addDocuments()`, `delete()`メソッドで操作
- IVFFlatインデックスで高速検索が可能

**設計への影響**:
- RAG検索は`NeonPostgres` vector storeを使用
- chunk埋め込みはOpenAI Embeddings APIで生成（text-embedding-3-small、1536次元）
- pgvector拡張をNeon PostgreSQLで有効化: `CREATE EXTENSION vector;`
- 差分更新時は`content_hash`を比較し、変更があるchunkのみ再埋め込み（REQ-RAG-5）

### 4. Cloudflare KV for Long-term Memory

**調査内容**: Cloudflare KVをLangGraph.jsのStoreとして使用する方法

**情報源**:
- Cloudflare Workers KV Documentation
- LangGraph Long-term Memory Documentation

**主要な発見**:
- KVは`BaseStore`インターフェースを実装する必要がある
- namespaceは配列形式（例: `["users", "{user_id}"]`）で階層構造を表現
- JSONドキュメントを値として保存
- 最終的な一貫性モデル（最大60秒の遅延）に注意

**設計への影響**:
- カスタム`KVStore`クラスを実装し、`BaseStore`インターフェースを実装
- namespace形式: `["users", "tg:{telegram_user_id}"]`
- 対話完了時にfacts/preferences/tasksを抽出してKVに保存（REQ-MEM-4）

### 5. GPT-4o Vision API Integration

**調査内容**: LangChain.jsでGPT-4o Vision APIを使用して画像要約を生成する方法

**情報源**:
- LangChain OpenAI Multimodal Documentation
- OpenAI GPT-4o Vision API

**主要な発見**:
- `ChatOpenAI`で`modelName: "gpt-4o"`を指定
- 画像はbase64エンコードまたはURL形式で渡す
- `HumanMessage`の`content`に配列形式でtextとimageを含める
- 構造化されたJSON応答を得るには、`response_format`またはプロンプトエンジニアリングが必要

**設計への影響**:
- Telegram画像は`file_id`から取得し、base64に変換
- Vision summaryは指定されたJSON形式（`{"summary", "entities", "tables", "warnings"}`）で生成
- `image_sha256`をキーとしてD1にキャッシュ（REQ-VIS-2）

### 6. Tavily Search API Integration

**調査内容**: LangChain.jsでTavily Search APIを統合し、引用付き検索結果を取得する方法

**情報源**:
- [LangChain Tavily Integration](https://docs.langchain.com/oss/javascript/integrations/tools/tavily_search/)
- Tavily Search API Documentation

**主要な発見**:
- `@langchain/community`パッケージに`TavilySearchResults`ツールが含まれる
- Tavilyは検索結果に引用（citations）を自動的に含める
- レート制限とAPIキー管理が必要

**設計への影響**:
- `N8_web_search`ノードで`TavilySearchResults`を使用
- 検索結果はStateの`rag.citations`に追加
- 回答生成時に引用を明示的に含める（REQ-TOOL-2）

## Architecture Pattern Evaluation

### Pattern 1: Sequential Node Flow with Conditional Edges

**説明**: 各ノードを順次実行し、conditional edgesで動的に分岐

**メリット**:
- LangGraph.jsの標準パターンに準拠
- checkpointが各ノード境界で自動的に作成される
- 各ノードを独立してテスト可能

**デメリット**:
- ノード数が増えるとグラフが複雑になる可能性

**決定**: 採用（要件に適合）

### Pattern 2: ToolNode for External API Calls

**説明**: LLM呼び出しや外部API呼び出しを`ToolNode`として分離

**メリット**:
- 副作用のある処理を明確に分離
- 再実行時の安全性向上

**デメリット**:
- 現在の要件では過剰な可能性

**決定**: 検討中（Vision処理やWeb検索で検討）

## Technology Decisions

### Embedding Model
- **選択**: OpenAI `text-embedding-3-small`（1536次元）
- **理由**: 高品質な埋め込み、広く使用されている標準モデル、Neon PostgreSQL + pgvectorとの統合が容易

### Vision Model
- **選択**: `gpt-4o`（OpenAI）
- **理由**: マルチモーダル対応、高精度な画像理解、構造化出力が可能

### Checkpointer Storage
- **選択**: Neon PostgreSQL（`@langchain/langgraph-checkpoint-postgres`）
- **理由**: 公式サポート、サーバーレスPostgreSQL、Cloudflare Workersから接続可能、自動スキーマ作成

### Long-term Memory Storage
- **選択**: Cloudflare KV
- **理由**: 高読み取り性能、namespaceによる階層構造、JSON保存に適している

## Integration Points

### Existing Codebase Integration
- **LangGraph Graph**: `src/agents/telegram/index.ts`を拡張
- **State Schema**: `src/agents/telegram/graph-state.ts`を拡張
- **Database**: `src/db/schema/`に新規テーブル追加（PostgreSQL形式）
- **Bot Handler**: `src/bot/handler.ts`で画像入力処理とreply context処理を追加

### External Dependencies
- `@langchain/community`: NeonPostgres vector store、Tavily統合
- `@langchain/langgraph-checkpoint-postgres`: PostgreSQL checkpointer
- `@langchain/openai`: Embeddings API統合
- `@neondatabase/serverless`: Neon PostgreSQL接続

## Risks & Mitigation

### Risk 1: Neon PostgreSQL接続の安定性
- **影響**: 中（永続化は必須機能）
- **対策**: 接続プーリング、リトライロジック、接続タイムアウト設定

### Risk 2: pgvectorインデックスのスケーラビリティ
- **影響**: 中（大量ドキュメント取り込み時）
- **対策**: IVFFlatインデックスの適切な設定、バッチ処理、必要に応じてHNSWインデックスへの移行を検討

### Risk 3: KVの最終的な一貫性
- **影響**: 低（長期メモリは即時一貫性が不要）
- **対策**: 読み取り時のリトライロジック、キャッシュ戦略

### Risk 4: Vision APIのコスト
- **影響**: 中（画像が多い場合）
- **対策**: sha256キャッシュを必須とし、同一画像の再推論を回避（REQ-VIS-2）

## Parallelization Considerations

以下のタスクは並列実行可能:
- ドキュメント取り込みと埋め込み生成（バッチ処理）
- Vision summary生成とRAG検索準備（画像がある場合）
- Long-term memory読み込みとinput正規化

以下のタスクは順次実行が必要:
- Retrieval decision → Retrieve/Skip → Synthesize（依存関係）
- Vision summary → Query building → Retrieve（依存関係）
