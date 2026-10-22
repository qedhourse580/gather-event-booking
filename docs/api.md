# API

実行時の仕様書：`/api/docs/`。OpenAPI：`/api/schema/`。

## 認証

`GET /api/auth/session/` で現在のユーザーとCSRFトークンを取得する。ブラウザにCSRF Cookieが設定される。

更新系要求ではCookieに加えて `X-CSRFToken` を送信する。ログイン・登録時にセッションを作成しCSRF Cookieが更新されるので、フロントは毎回最新のCookieから取得する。

## エンドポイント

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/auth/session/` | セッション確認とCSRFトークン |
| POST | `/api/auth/register/` | 登録（username, display_name, password, is_organizer） |
| POST | `/api/auth/login/` | ログイン（username, password） |
| POST | `/api/auth/logout/` | ログアウト |
| GET | `/api/events/` | 一覧。q, category, location, available, page |
| GET | `/api/events/{id}/` | 公開イベントまたは開催中止の詳細 |
| POST | `/api/events/{id}/reserve/` | 自分の予約を作成・再有効化 |
| GET | `/api/reservations/` | 自分の予約一覧 |
| GET | `/api/reservations/{id}/` | 自分の予約詳細 |
| POST | `/api/reservations/{id}/cancel/` | 自分の予約をキャンセル |
| GET / POST | `/api/organizer/events/` | 自分の主催イベント一覧・作成 |
| GET / PUT / PATCH | `/api/organizer/events/{id}/` | 自分の主催イベント詳細・更新 |
| GET | `/api/organizer/events/{id}/attendees/` | 自分のイベントの予約者一覧 |
| GET | `/api/health/` | DB接続を含むヘルスチェック |

## ステータス

- 200：取得・更新・キャンセル成功。
- 201：登録・イベント作成・予約成功。
- 204：ログアウト成功。
- 400：入力不正、認証情報の誤り、定員の不正な変更。
- 403：未認証での保護対象操作、CSRF検証失敗、主催者以外による作成。
- 404：存在しないID、閲覧権限のない対象。
- 409：満席、予約重複、予約・キャンセル締切。
- 429：レート制限。

セッション認証のため未認証時はDRFの標準動作に従い403を返す。409のときは画面で理由を表示し、最新状態を再取得する。
