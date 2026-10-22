# 実行・運用

## 環境変数

Django自体は.envを自動で読み込まない。Docker Composeはルート.envを読み込んで各コンテナの環境変数へ渡す。直接Pythonを起動する場合はシェルまたは実行環境で設定する。

| 変数 | 内容 |
|---|---|
| POSTGRES_HOST | 指定するとPostgreSQLを使用。未指定はSQLite |
| POSTGRES_PORT | 省略時5432 |
| POSTGRES_DB / POSTGRES_USER | 省略時gather |
| POSTGRES_PASSWORD | PostgreSQL接続時に必須 |
| DJANGO_SECRET_KEY | 公開環境では十分長いランダムな値を必須とする |
| DJANGO_DEBUG | localhostはtrue、公開環境ではfalse |
| DJANGO_ALLOWED_HOSTS | 許可するホスト名をカンマ区切りで指定 |
| CSRF_TRUSTED_ORIGINS | スキームを含む許可オリジンをカンマ区切りで指定 |
| DJANGO_TRUST_PROXY | 信頼できるTLS終端プロキシ配下の場合のみtrue |
| DEMO_PASSWORD | seed_demoで新規作成するアカウントのパスワード。省略時はランダム生成して表示 |

## 公開時

現在は外部ホスティング先未設定。以下は公開するときの作業手順であり、実施済みとは区別する。

1. PostgreSQLを用意し、アプリだけが接続できるようネットワークを制限する。
2. SECRET_KEYとDBパスワードを実行基盤のシークレット設定へ登録する。
3. 実ドメインのALLOWED_HOSTSとCSRF_TRUSTED_ORIGINSを設定し、DEBUGをfalseにする。
4. 信頼できるプロキシでHTTPSを終端する。プロキシが外部入力のX-Forwarded-Protoを上書きする構成の場合のみ、DJANGO_TRUST_PROXY=trueを指定する。
5. コンテナ間のヘッダー転送も確認する。付属Nginxは自身のschemeを転送するため、さらに前段にTLS終端を置く場合は、その信頼境界に合わせて設定を調整する。
6. `python manage.py migrate --noinput` と `collectstatic --noinput` を実行する。
7. `python manage.py check --deploy` と、HTTPSでのログイン・CSRF・Cookieを確認する。
8. APIヘルスチェック、ログ収集、バックアップ、復元、エラー監視を構成する。

DEBUG=falseではセッション・CSRF CookieはSecureとなり、HTTPSへリダイレクトする。DBヘルスチェックだけはリダイレクト対象外。

## ログ

`reservation.created` / `reservation.cancelled` にイベントID、予約ID、ユーザーIDを記録する。パスワードやCookieはログへ書き込まない。HTTPアクセスログと時刻を合わせて原因を調べる。個人情報を含むログの公開は避ける。

## 検証

```bash
docker compose exec backend python -m pytest
docker compose exec backend python manage.py check
docker compose logs backend
```

CIではPostgreSQLのサービスコンテナを利用する。Dockerが使えないローカル環境ではSQLiteで通常のAPIテストを実行できるが、同時実行3テストはPostgreSQLで別途実行する。

## 既知の制約

- DRFのレート制限は既定のプロセス内キャッシュを使用している。複数ワーカーをまたぐ厳密な制限やDDoS対策としては使わず、公開時は共有キャッシュやリバースプロキシで補う。
- イベント変更時・開催中止時のメール通知はない。
- 予約の履歴は保持するが、イベント内容の変更前スナップショットは保持しない。
- ページングは件数ベース。大量データ向けのカーソル方式や全文検索は未実装。
- デモ用の自己登録を許可する。商用化する際のメール確認・不正利用対策・アカウント回復は別途必要。
- 負荷試験・長期運用・障害復旧の実績を表すものではない。
