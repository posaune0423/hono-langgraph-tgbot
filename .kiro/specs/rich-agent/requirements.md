# rich-agent - Requirements

## 1. 目的

Telegram 上で、(a) 事前登録された複数の Product Docs URL 群、(b) 提供されたローカル文書（例: md/llm.text）、(c) ユーザーが送信した画像を根拠として、**引用付き回答**を返す対話エージェントを提供する。

本エージェントは **LangGraph.js の Graph（State / Nodes / Edges）**として実行され、永続化（checkpointer / thread / checkpoints）、短期/長期メモリ、ストリーミングを必須能力として備える。

## 2. スコープ

- Telegram Bot（Webhook 受信）からの入力（テキスト/画像）を処理対象とする
- ドキュメント知識は RAG（検索+生成）により提供する
- 画像入力がある場合は Vision（マルチモーダル）で要約を生成し、回答生成に利用する
- 会話は user_id 単位で分離し、再起動後も同じ user の会話状態が継続できる

## 3. 用語（LangGraph 準拠）

- **Graph**: State / Nodes / Edges からなる実行モデル
- **State**: ノード間で共有・更新される状態（会話履歴/入力/中間生成物/出力など）
- **Node**: State を入力に処理を行い、State を更新する単位
- **Edge**: 次の遷移（次に実行するノード）を決定する制御
- **Checkpointer**: 各 super-step（ノード境界）で State checkpoint を保存/復元する永続化機構
- **Thread**: checkpoint を紐づける一意 ID（`configurable.thread_id`）
- **Short-term memory**: thread スコープの会話履歴（State に保持し、checkpointer で復元可能）
- **Long-term memory**: ユーザー単位で JSON として永続化され、namespace/key で整理・検索可能なメモリ
- **Interrupt/Resume**: node 内の interrupt により停止し、外部入力で再開できる実行モデル
- **Durable execution**: 中断/失敗/再起動後も checkpoint から再開できる性質
- **Task**: 非決定性・副作用のある処理を分離し、再実行に耐える（idempotent）ことを前提とする単位

## 4. 前提・識別（thread_id）

- thread_id は Telegram の user_id を基準に決定する（例: `tg:{telegram_user_id}`）
- 同一 thread_id の invocations は short-term memory を共有し、別 user の状態と混ざらない

## 5. 機能要件

### 5.1 Telegram Inbound

- **5.1.1**: ユーザーがテキストメッセージを送信した場合、システムは `thread_id=tg:{telegram_user_id}` でグラフを起動しなければならない。（旧: REQ-TG-1）
- **5.1.2**: ユーザーが写真を送信した場合、システムは当該写真を現在の user thread の入力として関連付けなければならない。（旧: REQ-TG-2）
- **5.1.3**: ユーザーが写真を含むメッセージに reply して質問した場合、システムは reply 先の写真を解決し、その写真を入力として扱わなければならない。（旧: REQ-TG-3）
- **5.1.4**: グラフ実行中、システムは Telegram に対して部分応答（typing/部分テキスト等）をストリーミングしなければならない。（旧: REQ-TG-4）

### 5.2 Vision（Multi-modal）

- **5.2.1**: 画像入力がある場合、システムは vision 対応モデルを用いて、次の JSON 形状を満たす vision summary を生成しなければならない: `{"summary": string, "entities": array, "tables": array, "warnings": array}`。（旧: REQ-VIS-1）
- **5.2.2**: 画像入力がある場合、システムは `image_sha256` をキーとして vision summary をキャッシュし、同一画像では再推論を回避しなければならない。（旧: REQ-VIS-2）
- **5.2.3**: 画像入力がある場合、システムは vision summary を State に格納し、下流の検索・回答生成で参照可能にしなければならない。（旧: REQ-VIS-3）

### 5.3 RAG（Web Docs + Local Docs）

- **5.3.1**: システムは複数のドキュメントソース（URL リストまたは sitemap）を登録できなければならない。（旧: REQ-RAG-1）
- **5.3.2**: システムはローカル文書（例: md/llm.text）を取り込み対象として受け付け、Web Docs と同一の内部スキーマ（Document/Chunk）へ正規化しなければならない。（旧: REQ-RAG-2）
- **5.3.3**: システムは引用に十分なメタデータを chunk に付与しなければならない（少なくとも `source_url`, `title`, `section`, `chunk_id`）。（旧: REQ-RAG-3）
- **5.3.4**: ユーザーが質問した場合、システムは top-K chunk を検索し、回答内に明示的な引用（source URL + section + chunk identifier）を含めなければならない。（旧: REQ-RAG-4）
- **5.3.5**: システムは差分取り込みを提供しなければならない。ページおよび chunk の `content_hash` を計算し、変更がある chunk のみ再埋め込み対象としなければならない。（旧: REQ-RAG-5）
- **5.3.6**: ユーザーが質問した場合、システムは retrieval を実施するか、直接回答するかを判断し、その判断結果を記録しなければならない（Agentic RAG）。（旧: REQ-RAG-6）

### 5.4 Memory（Short-term + Long-term）

- **5.4.1**: システムは LangGraph checkpointer により short-term conversational state を永続化し、同一 thread_id の後続起動で復元しなければならない。（旧: REQ-MEM-1）
- **5.4.2**: 本番環境において、システムは DB-backed checkpointer を使用して durable execution を有効にしなければならない。（旧: REQ-MEM-2）
- **5.4.3**: システムは user 単位の long-term memory を JSON として永続化し、namespace に user_id を含めなければならない（例: `['users', '{telegram_user_id}']`）。（旧: REQ-MEM-3）
- **5.4.4**: 各対話が完了した場合、システムは対話から抽出した「facts/preferences/tasks」を long-term memory として更新しなければならない（上書き/マージ規則を適用）。（旧: REQ-MEM-4）
- **5.4.5**: システムは long-term memory を namespace/key によって取得できなければならない。さらに、提供される場合は意味検索（semantic search）による検索を提供しなければならない。（旧: REQ-MEM-5）

### 5.5 Durable Execution / Interrupts / Idempotency

- **5.5.1**: システムはプロセス再起動後でも、checkpointer に保存された state から再開できなければならない。（旧: REQ-DUR-1）
- **5.5.2**: システムは非決定性または副作用のある処理（例: LLM 呼び出し、Web fetch、冪等でない書き込み）を task として分離し、再実行されても安全（idempotent）でなければならない。（旧: REQ-DUR-2）
- **5.5.3**: 人手承認または入力不足が発生した場合、システムは interrupt により実行を停止し、外部入力により同一 thread state で再開できなければならない。（旧: REQ-INT-1）

### 5.6 質問タイプ判定とツール選択（Direct / RAG / Web Search）

- **5.6.1**: ユーザーがメッセージを送信した場合、システムは質問タイプ（intent/topic）を判定し、少なくとも次のいずれかへ分類しなければならない: `smalltalk_or_short`, `general_question`, `domain_solana_defi_trade`, `about_this_bot`, `docs_required`。（旧: REQ-ROUTE-1）
- **5.6.2**: ユーザーの入力が短い挨拶または単語のみ等で、追加の根拠が不要な場合、システムは retrieval を行わず直接回答しなければならない（Direct）。（旧: REQ-ROUTE-2）
- **5.6.3**: ユーザーが「この bot 自体」について質問した場合、システムは本プロダクトの内部ドキュメント/仕様/運用情報（例: 取り込み済み docs や登録済みソース）を優先して参照し、引用付きで回答しなければならない（RAG 優先）。（旧: REQ-ROUTE-3）
- **5.6.4**: ユーザーが Solana/Drift/trade/DeFi/blockchain に関する質問をした場合、システムは登録済み Docs（RAG）を優先して参照し、必要に応じて Web 検索を併用しなければならない。（旧: REQ-ROUTE-4）
- **5.6.5**: ユーザーが一般的な質問をした場合、システムは Direct / RAG / Web 検索のいずれかを選択できなければならない。選択にあたり、根拠が必要な場合は RAG または Web 検索を選択しなければならない。（旧: REQ-ROUTE-5）
- **5.6.6**: Web 検索が必要な場合、システムは Tavily Search を用いて関連情報を取得し、回答の根拠として扱わなければならない。（旧: REQ-TOOL-1）
- **5.6.7**: RAG または Web 検索を使用した場合、システムは回答に引用（出典）を含めなければならない。（旧: REQ-TOOL-2）
- **5.6.8**: システムは「なぜ Direct / RAG / Web 検索を選択したか」の意思決定（retrieval decision）を記録しなければならない。（旧: REQ-TOOL-3）

## 6. グラフ要件（構造）

### 6.1 State スキーマ（最低限）

- **6.1.1**: State は少なくとも次を含まなければならない。（旧: REQ 6.1）
  - `messages`: 会話メッセージ（short-term memory）
  - `user`: `{ telegram_user_id, locale?, ... }`
  - `input`: `{ text?, image? (file_id/sha256/url), reply_context? }`
  - `vision`: `{ summary?, image_id?, cached?: boolean }`
  - `rag`: `{ query?, retrieved_chunks?: [], citations?: [] }`
  - `memory`: `{ long_term_entries?: [], updated?: boolean }`
  - `routing`: `{ intent?: string, plan?: "direct" | "rag" | "web" | "rag+web", decision_log_id?: string }`
  - `answer`: `{ text?, citations?: [], debug?: unknown }`

### 6.2 Node セット（最低限）

- **6.2.1**: システムは少なくとも次の論理ノードを提供しなければならない。（旧: REQ 6.2）
  - `N1_ingest_input`: Telegram update を正規化
  - `N2_load_long_term_memory`: long-term memory を取得
  - `N3_vision_summarize`: 画像があれば vision 要約（キャッシュ優先）
  - `N4_build_effective_query`: user text + vision summary + memory を統合して検索クエリ生成
  - `N5_retrieve`: ベクトル検索により top-K chunk を取得
  - `N6_synthesize`: 回答生成（引用を付与）
  - `N7_persist`: 会話ログ保存と long-term memory 更新
  - `N8_web_search`: Web 検索（Tavily）により外部根拠を取得（必要時のみ）

### 6.3 制御フロー（Edges）

- **6.3.1**: 画像入力がない場合、システムは `N3_vision_summarize` を実行してはならない。（旧: REQ 6.3-1）
- **6.3.2**: retrieval decision が “retrieve不要” の場合、システムは `N5_retrieve` をスキップしなければならない。（旧: REQ 6.3-2）
- **6.3.3**: Web 検索が不要な場合、システムは `N8_web_search` を実行してはならない。（旧: REQ 6.3-3）
- **6.3.4**: システムは node 境界で checkpoint が作られる前提で、各 node を再実行しても安全な単位として扱わなければならない。（旧: REQ 6.3-4）

## 7. データ要件（永続化）

### 7.1 Checkpoints（checkpointer）

- **7.1.1**: thread と checkpoints を永続化し、同一 thread の復元に利用できなければならない。（旧: REQ 7.1）

### 7.2 RAG データ

- **7.2.1**: システムは少なくとも次の RAG データを保持できなければならない。（旧: REQ 7.2）
  - ドキュメントソース（識別子、種別、root URL、状態、更新時刻）
  - ドキュメント本文（URL、タイトル、取得時刻、content_hash、raw_text）
  - chunk（document 参照、section、chunk_index、content、token_count、content_hash）
  - embedding（chunk 参照、embedding、model、作成時刻）
  - citation に必要な情報（chunk_id、url、section、snippet など）

### 7.3 会話ログ（監査/改善）

- **7.3.1**: システムは少なくとも次の会話ログを保持できなければならない。（旧: REQ 7.3）
  - conversation（telegram_user_id、作成/更新時刻）
  - message（role、content、meta_json、作成時刻）

### 7.4 Vision キャッシュ

- **7.4.1**: システムは少なくとも次の Vision キャッシュを保持できなければならない。（旧: REQ 7.4）
  - image（telegram_file_id、sha256、mime、size、作成時刻）
  - image_summary（image 参照、model、summary_json、作成時刻）

### 7.5 Long-term memory

- **7.5.1**: システムは namespace に user_id を含め、JSON documents を key で管理できなければならない。（旧: REQ 7.5）

## 8. 非機能要件

- **8.1**: システムは checkpointer を必須とし、落ちても thread state から再開できなければならない。（旧: NFR-REL-1）
- **8.2**: システムは interrupt/resume を導入可能な設計でなければならない。（旧: NFR-REL-2）
- **8.3**: システムは node 再実行（resume 等）を前提に、外部副作用を idempotent に扱わなければならない。（旧: NFR-IDEMP-1）
- **8.4**: システムは少なくとも node 単位の観測情報（入力/出力の要約、所要時間、retrieval 件数）を記録しなければならない。（旧: NFR-OBS-1）
- **8.5**: システムは streaming により、処理中の応答性を提供しなければならない。（旧: NFR-UX-1）
- **8.6**: システムは同一画像の再推論を避けるため、sha256 キャッシュを必須としなければならない。（旧: NFR-COST-1）
- **8.7**: システムは doc 取り込み時に差分更新を行い、変更がないページ/chunk の再埋め込みを避けなければならない。（旧: NFR-COST-2）
- **8.8**: システムはローカル実行と本番実行の設定を分離できなければならない。（旧: NFR-DEP-1）
- **8.9**: システムは秘密情報（例: API キー、DB 接続情報）をソース管理へコミットしてはならない。（旧: NFR-DEP-2）

## 9. 受入基準（MUST）

- **9.1**: ユーザーが通常のテキスト質問を行った場合、システムは docs 由来の引用付き回答を返さなければならない。（旧: AC-1）
- **9.2**: ユーザーが画像を送信する、または画像への reply として質問する場合、システムは vision 要約に基づく回答を返さなければならない。（旧: AC-2）
- **9.3**: 複数ユーザーが利用する場合、システムは user_id ごとに会話 state を分離し、他ユーザーの state が混入してはならない。（旧: AC-3）
- **9.4**: Bot プロセスを再起動した場合、システムは同一 user の会話を継続できなければならない。（旧: AC-4）
- **9.5**: ユーザーが同一画像を 2 回送信した場合、システムは 2 回目に vision 推論を再実行してはならない。（旧: AC-5）
- **9.6**: docs を再クロール/再取り込みした場合、システムは変更がないページ/chunk を再埋め込みしてはならない。（旧: AC-6）
- **9.7**: ユーザーが短い挨拶等（例: "hi", "yo"）のみを送った場合、システムは retrieval を行わず短く自然な応答を返さなければならない。（旧: AC-7）
- **9.8**: ユーザーが Solana/Drift/DeFi/trade/blockchain 関連の質問をした場合、システムは RAG または Web 検索（Tavily）を用いた根拠付き回答を返し、かつ選択理由を記録しなければならない。（旧: AC-8）
- **9.9**: ユーザーが「この bot」について質問した場合、システムは内部情報を優先して引用付きで回答しなければならない。（旧: AC-9）

## 10. 参照資料（公式ドキュメント）

- **Agentic RAG（retrieval decision / conditional edges / ToolNode）**: [Build a custom RAG agent with LangGraph](https://docs.langchain.com/oss/javascript/langgraph/agentic-rag)
- **画像入力（multimodal messages / content blocks）**: [Messages - Multimodal](https://docs.langchain.com/oss/javascript/langchain/messages#multimodal)
