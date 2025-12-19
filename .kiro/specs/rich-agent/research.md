# rich-agent - Research Log

## Summary

本機能は、LangGraph.jsベースのRAG（Retrieval-Augmented Generation）エージェントを実装する複雑な新規機能です。Telegram Bot上で、事前登録されたドキュメント、ローカル文書、ユーザー送信画像を根拠として引用付き回答を提供します。

**発見スコープ**: フルディスカバリー（新規機能・複雑な統合）

**主要な技術決定**:
- LangGraph.jsのconditional edgesによるAgentic RAG実装
- Neon PostgreSQL + pgvectorによるベクトル検索
- LangGraph Store（`put/get/search` API）によるlong-term memory
- Neon PostgreSQLベースのcheckpointer（`@langchain/langgraph-checkpoint-postgres`）
- GPT-4o Vision APIによる画像処理
- Tavily Search APIによるWeb検索

## Research Log

### 1. LangGraph.js Memory Architecture（重要な発見）

**調査内容**: LangGraph.jsのメモリ管理アーキテクチャの正確な理解

**情報源**:
- [LangGraph Memory Documentation](https://docs.langchain.com/oss/javascript/langgraph/memory)
- [LangGraph.js API Reference - InMemoryStore](https://reference.langchain.com/javascript/classes/_langchain_langgraph-checkpoint.InMemoryStore.html)

**主要な発見（Critical）**:

LangGraph.jsには**2つの異なる永続化機構**が存在する：

| 機構 | 用途 | スコープ | API |
|------|------|----------|-----|
| **Checkpointer** | State スナップショット | thread単位 | `getTuple/putWrites` |
| **Store** | Cross-thread メモリ | user/org単位 | `put/get/search/delete` |

**Store API（long-term memory用）の正確なシグネチャ**:

```typescript
// 保存
put(
  namespace: string[],
  key: string,
  value: Record<string, unknown>,
  index?: false | string[]
): Promise<void>;

// 取得
get(
  namespace: string[],
  key: string
): Promise<Item | undefined>;

// 検索
search(
  namespacePrefix: string[],
  options?: {
    filter?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    query?: string;  // semantic search用
  }
): Promise<SearchItem[]>;

// 削除
delete(
  namespace: string[],
  key: string
): Promise<void>;
```

**Item インターフェース**:
```typescript
interface Item {
  key: string;
  value: Record<string, unknown>;
  namespace: string[];
  createdAt?: string;
  updatedAt?: string;
}
```

**設計への影響（Critical）**:
- 当初の設計で想定していた `BaseStore`（`mget/mset/mdelete/yieldKeys`）はLangChain.jsのkey-value store用であり、LangGraph.jsのlong-term memory用Store（`put/get/search`）とは**別物**
- Cloudflare KVアダプタは `put/get/search/delete` を実装する必要がある

### 2. configurable の設計パターン

**調査内容**: LangGraph.jsでのthread_idとuserIdの分離パターン

**情報源**:
- [LangGraph Cross-Thread Persistence](https://langchain-ai.github.io/langgraphjs/how-tos/cross-thread-persistence/)
- [LangGraph Configuration](https://langchain-ai.github.io/langgraphjs/how-tos/configuration/)

**主要な発見**:

```typescript
const config = {
  configurable: {
    thread_id: "conversation-abc123",  // 会話/セッション単位（short-term）
    userId: "tg:12345",                // ユーザー単位（long-term memory用）
  }
};
```

- `thread_id`: Checkpointerが使用。同一thread内でStateを復元
- `userId`: Store操作時にnamespaceの一部として使用
- ノード内では `config.configurable?.userId` でアクセス

**設計への影響**:
- `thread_id`と`userId`を分離し、会話単位とユーザー単位のデータを適切に管理
- `thread_id`の命名: `"conv:{telegram_chat_id}:{message_id}"` または `"conv:{uuid}"`
- `userId`の命名: `"tg:{telegram_user_id}"`

### 3. Store のグラフ統合方法

**調査内容**: Store をグラフに統合し、ノード内でアクセスする方法

**主要な発見**:

```typescript
// 1. グラフコンパイル時に store を渡す
const graph = workflow.compile({
  checkpointer,
  store,  // ← 必須
});

// 2. ノード内で config から store にアクセス
import { LangGraphRunnableConfig } from "@langchain/langgraph";

const myNode = async (
  state: typeof graphState.State,
  config: LangGraphRunnableConfig
) => {
  const store = config.store;
  const userId = config.configurable?.userId;
  
  // Store操作
  const namespace = ["users", userId];
  const memories = await store?.search(namespace);
  // ...
};
```

**設計への影響**:
- 全ノードは第2引数で `LangGraphRunnableConfig` を受け取る
- `config.store` から Store インスタンスにアクセス
- `config.configurable` からカスタム設定（userId等）にアクセス

### 4. PostgresSaver の Cloudflare Workers 互換性

**調査内容**: PostgresSaverをCloudflare Workers環境で使用する方法

**情報源**:
- [Neon Serverless Driver](https://github.com/neondatabase/serverless)
- [Cloudflare Workers + Neon Integration](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/)

**主要な発見**:

1. **`@neondatabase/serverless` の Pool は `pg.Pool` と API 互換**
2. **Workers では WebSocket 経由で接続**:
   ```typescript
   import { Pool, neonConfig } from '@neondatabase/serverless';
   
   // Workers では WebSocket が標準で利用可能
   neonConfig.webSocketConstructor = WebSocket;
   
   const pool = new Pool({ connectionString: env.DATABASE_URL });
   ```

3. **PostgresSaver へのカスタム Pool 注入**:
   ```typescript
   import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
   
   const checkpointer = new PostgresSaver(pool, undefined, {
     schema: "langgraph"
   });
   await checkpointer.setup();
   ```

4. **Workers の制約**:
   - Pool/Client は**リクエストスコープ内**で作成・終了する必要がある
   - 長時間のコネクションは不可（リクエスト終了時に切断される）

**リスク**:
- `checkpointer.setup()` が Workers の CPU 時間制限内で完了するか未検証
- WebSocket 経由のレイテンシが許容範囲か未検証

**対策**:
- `setup()` は初回デプロイ時にBunスクリプトで実行（Workers外）
- Workers内では `setup()` をスキップし、テーブルが存在する前提で動作

### 5. Drizzle × Neon 接続（Cloudflare Workers対応）

**調査内容**: Drizzle ORMをNeon PostgreSQLに接続する方法（Workers環境）

**情報源**:
- [Drizzle ORM - Database connection](https://orm.drizzle.team/docs/connect-overview)
- [Drizzle ORM - Neon connection](https://orm.drizzle.team/docs/connect-neon)

**主要な発見**:

**2つの接続方式**:

| 方式 | パッケージ | 用途 | Workers互換 |
|------|-----------|------|-------------|
| HTTP | `drizzle-orm/neon-http` | 単発クエリ | ✅ |
| WebSocket | `drizzle-orm/neon-serverless` | Pool/トランザクション | ✅ |

**推奨構成（設計）**:
- **RAG/Vision cache クエリ**: `drizzle-orm/neon-http`（シンプル・低レイテンシ）
- **Checkpointer**: `@neondatabase/serverless` の Pool（PostgresSaverとの互換性）

```typescript
// neon-http 方式（単発クエリ用）
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

const sql = neon(env.DATABASE_URL);
export const db = drizzle(sql);

// neon-serverless 方式（Pool用）
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const dbPool = drizzle(pool);
```

### 6. Cloudflare KV を LangGraph Store として実装

**調査内容**: KVをLangGraph Storeインターフェースに適合させる方法

**主要な発見**:

KV の制約と Store API のマッピング:

| Store API | KV API | 実装方法 |
|-----------|--------|----------|
| `put(ns, key, value)` | `kv.put(key, value)` | namespace+keyを結合してKVキーに |
| `get(ns, key)` | `kv.get(key)` | 同上 |
| `search(nsPrefix)` | `kv.list({ prefix })` | prefixで一覧取得→各キーをget |
| `delete(ns, key)` | `kv.delete(key)` | 同上 |

**課題**:
- KV の `list()` はキー一覧のみ返し、値は含まない
- `search()` 実装時に N+1 問題が発生（list後に各キーをget）
- semantic search（`query` オプション）はKV単体では不可

**対策**:
- `search()` で返すメモリ数を制限（limit: 10程度）
- semantic search が必要な場合は Neon(pgvector) と併用
- 頻繁にアクセスするメモリはキャッシュ戦略を検討

### 7. Vision Summary キャッシュ

**調査内容**: 画像要約のキャッシュ戦略

**設計決定**:
- キャッシュキー: `image_sha256`
- ストレージ: Neon PostgreSQL（`vision_images` + `vision_summaries` テーブル）
- キャッシュヒット時: DBから要約JSONを取得
- キャッシュミス時: GPT-4o Vision API呼び出し → DBに保存

### 8. Tavily Search 統合

**調査内容**: LangChain.jsでのTavily Search統合

**情報源**:
- [LangChain Tavily Integration](https://docs.langchain.com/oss/javascript/integrations/tools/tavily_search/)

**主要な発見**:
- `@langchain/community` パッケージに `TavilySearchResults` ツールが含まれる
- 検索結果には自動的に引用（URL、タイトル、スニペット）が含まれる

## Architecture Pattern Evaluation

### Pattern 1: Sequential Node Flow with Conditional Edges（採用）

**説明**: 各ノードを順次実行し、conditional edgesで動的に分岐

**メリット**:
- LangGraph.jsの標準パターンに準拠
- checkpointが各ノード境界で自動的に作成される
- 各ノードを独立してテスト可能

### Pattern 2: Dual Storage（採用）

**説明**: D1（既存）+ Neon（新規）+ KV（新規）の役割分担

- **D1**: 既存のusers/messagesテーブル（監査ログ）
- **Neon**: checkpoints/RAGコーパス/Visionキャッシュ/decision log
- **KV**: long-term memory（Store実装）

**メリット**:
- 既存コードへの影響を最小化
- 各ストレージの特性を活かした設計

## Technology Decisions

### Checkpointer
- **選択**: `@langchain/langgraph-checkpoint-postgres` + Neon serverless Pool
- **理由**: 公式サポート、durable execution、Workers互換（検証要）

### Long-term Memory Store
- **選択**: Cloudflare KV（カスタムStore実装）
- **理由**: 高読み取り性能、namespace対応、Workers native

### Embedding Model
- **選択**: OpenAI `text-embedding-3-small`（1536次元）
- **理由**: 高品質、pgvectorとの統合が容易

### Vision Model
- **選択**: `gpt-4o`
- **理由**: マルチモーダル対応、構造化出力が可能

## Risks & Mitigation

### Risk 1: PostgresSaver の Workers 互換性（High）
- **影響**: checkpointerが動作しない場合、durable executionが不可能
- **対策**: 
  - 実装前にPoC実施
  - 代替案: カスタムcheckpointer（KVベース）を検討

### Risk 2: KV Store の search() パフォーマンス（Medium）
- **影響**: N+1問題による遅延
- **対策**: limit制限、頻繁アクセスデータのキャッシュ

### Risk 3: Workers CPU時間制限（Medium）
- **影響**: 複雑なグラフ実行がタイムアウト
- **対策**: ノード分割、重い処理の非同期化

## Integration Points

### Existing Codebase
- `src/agents/telegram/index.ts`: Graph定義を拡張
- `src/agents/telegram/graph-state.ts`: State Annotationを拡張
- `src/bot/handler.ts`: 画像入力・reply context処理を追加
- `src/db/schema/`: Neon用スキーマを追加（別ディレクトリ推奨）

### External Dependencies（追加）
- `@langchain/langgraph-checkpoint-postgres`: PostgreSQL checkpointer
- `@neondatabase/serverless`: Neon serverless driver
- `drizzle-orm/neon-http`: Drizzle Neon HTTP接続

## Parallelization Considerations

以下のタスクは並列実行可能:
- ドキュメント取り込みと埋め込み生成（バッチ処理）
- Vision summary生成とlong-term memory読み込み

以下のタスクは順次実行が必要:
- route_and_plan → retrieve/web_search → synthesize（依存関係）
