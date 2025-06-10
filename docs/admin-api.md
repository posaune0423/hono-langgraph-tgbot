# Admin API Documentation

## 概要

このAPIは管理者がTelegramボットを通じてユーザーにメッセージを送信するためのエンドポイントを提供します。

## 認証

すべてのエンドポイントは管理者認証が必要です。リクエストヘッダーに以下を含める必要があります：

```
X-Admin-API-Key: <ADMIN_API_KEY>
```

## エンドポイント

### 1. 特定ユーザーへのメッセージ送信

**POST** `/admin/send-message`

特定のユーザーにメッセージを送信します。

#### リクエスト

**Content-Type**: `application/json` | `multipart/form-data` | `application/x-www-form-urlencoded`

**パラメータ**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `userId` | string | ✓ | 送信先ユーザーのTelegram ID |
| `message` | string | ✓ | 送信するメッセージ（最大4096文字） |
| `parseMode` | string | - | メッセージの解析モード（`HTML`, `Markdown`, `MarkdownV2`） |

#### レスポンス

**成功時 (200)**:
```json
{
  "success": true,
  "messageId": 123
}
```

**エラー時 (400)**:
```json
{
  "success": false,
  "error": "Message is required"
}
```

```json
{
  "success": false,
  "error": "Message too long",
  "maxLength": 4096,
  "currentLength": 5000
}
```

```json
{
  "success": false,
  "error": "Invalid parse mode",
  "validModes": ["HTML", "Markdown", "MarkdownV2"]
}
```

**エラー時 (500)**:
```json
{
  "success": false,
  "error": "Internal server error"
}
```

#### 使用例

**JSON形式**:
```bash
curl -X POST "https://your-domain.com/admin/send-message" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: your-admin-api-key" \
  -d '{
    "userId": "123456789",
    "message": "こんにちは！これは管理者からのメッセージです。",
    "parseMode": "HTML"
  }'
```

**フォーム形式**:
```bash
curl -X POST "https://your-domain.com/admin/send-message" \
  -H "X-Admin-API-Key: your-admin-api-key" \
  -F "userId=123456789" \
  -F "message=こんにちは！これは管理者からのメッセージです。" \
  -F "parseMode=HTML"
```

### 2. 全ユーザーへのブロードキャスト

**POST** `/admin/broadcast`

登録されている全ユーザーにメッセージをブロードキャストします。

#### リクエスト

**Content-Type**: `application/json` | `multipart/form-data` | `application/x-www-form-urlencoded`

**パラメータ**:

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `message` | string | ✓ | 送信するメッセージ（最大4096文字） |
| `parseMode` | string | - | メッセージの解析モード（`HTML`, `Markdown`, `MarkdownV2`） |
| `excludeUserIds` | string[] | - | 除外するユーザーIDの配列 |

#### レスポンス

**成功時 (200)**:
```json
{
  "success": true,
  "totalUsers": 150,
  "successCount": 148,
  "failureCount": 2,
  "results": [
    {
      "userId": "123456789",
      "success": true,
      "messageId": 456
    },
    {
      "userId": "987654321",
      "success": false,
      "error": "User blocked the bot"
    }
  ]
}
```

**エラー時 (400)**:
```json
{
  "success": false,
  "error": "Message is required"
}
```

```json
{
  "success": false,
  "error": "excludeUserIds must be an array of strings"
}
```

**エラー時 (500)**:
```json
{
  "success": false,
  "error": "Internal server error",
  "totalUsers": 0,
  "successCount": 0,
  "failureCount": 0,
  "results": []
}
```

#### 使用例

**JSON形式**:
```bash
curl -X POST "https://your-domain.com/admin/broadcast" \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: your-admin-api-key" \
  -d '{
    "message": "重要なお知らせ：システムメンテナンスを実施します。",
    "parseMode": "HTML",
    "excludeUserIds": ["123456789", "987654321"]
  }'
```

**フォーム形式**:
```bash
curl -X POST "https://your-domain.com/admin/broadcast" \
  -H "X-Admin-API-Key: your-admin-api-key" \
  -F "message=重要なお知らせ：システムメンテナンスを実施します。" \
  -F "parseMode=HTML" \
  -F "excludeUserIds=123456789,987654321"
```

## エラーハンドリング

### 認証エラー

管理者認証に失敗した場合：

```json
{
  "error": "Unauthorized"
}
```

### バリデーションエラー

リクエストパラメータが不正な場合、詳細なエラーメッセージが返されます：

- メッセージが空の場合
- メッセージが4096文字を超える場合
- 無効なparseMode指定
- 不正なContent-Type
- リクエストボディの解析エラー

### レート制限

ブロードキャスト機能では、Telegramのレート制限（25メッセージ/秒）を考慮した並列処理を行います。

## 注意事項

1. **メッセージ長制限**: Telegramの制限により、メッセージは最大4096文字です
2. **parseMode**: HTMLタグやMarkdown記法を使用する場合は適切なparseModeを指定してください
3. **ブロードキャスト**: 大量のユーザーがいる場合、処理に時間がかかる可能性があります
4. **エラー処理**: ユーザーがボットをブロックしている場合など、個別の送信失敗は結果に含まれます

## 実装詳細

- 認証は`adminAuth`ミドルウェアで処理
- ログは構造化ログ（`logger`）で記録
- Telegramレート制限を考慮した並列処理
- 部分的失敗を含む詳細な結果レポート
