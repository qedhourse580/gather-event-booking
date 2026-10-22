import React, { useContext, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Auth, Empty, ErrorBox } from "../components/shared";
function AuthPage({ register = false }: { register?: boolean }) {
  const { user, refresh } = useContext(Auth);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(
        `auth/${register ? "register" : "login"}/`,
        "POST",
        register
          ? {
              username: form.get("username"),
              display_name: form.get("display_name"),
              password: form.get("password"),
              is_organizer: form.get("is_organizer") === "on",
            }
          : { username: form.get("username"), password: form.get("password") },
      );
      await refresh();
      const next = params.get("next");
      navigate(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (user)
    return (
      <main className="main">
        <Empty title="ログイン済みです">
          <Link to="/">イベントを探す</Link>
        </Empty>
      </main>
    );
  return (
    <main className="auth-layout">
      <div className="auth-intro">
        <h1>{register ? "アカウント登録" : "ログイン"}</h1>
        <p>
          ログインすると、イベントの予約と、予約したイベントの確認・キャンセルができます。主催者として登録すると、イベントを作成・公開できます。
        </p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>{register ? "アカウント情報" : "ユーザー名とパスワード"}</h2>
        <p>
          {register
            ? "表示名・ユーザー名・パスワードを入力してください。"
            : "ユーザー名とパスワードを入力してください。"}
        </p>
        {error && <ErrorBox message={error} />}
        {register && (
          <label>
            表示名
            <input
              name="display_name"
              required
              maxLength={80}
              autoComplete="nickname"
              placeholder="例：山田 太郎"
            />
          </label>
        )}
        <label>
          ユーザー名
          <input
            name="username"
            required
            maxLength={150}
            autoComplete="username"
            placeholder="例：gather_user"
          />
        </label>
        <label>
          パスワード
          <input
            name="password"
            type="password"
            required
            minLength={register ? 8 : 1}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {register && (
          <>
            <small>
              8文字以上。ユーザー名と異なる、推測しにくいものを設定してください。
            </small>
            <label className="checkbox">
              <input type="checkbox" name="is_organizer" />
              イベントの主催も希望する
            </label>
          </>
        )}
        <button type="submit" className="button wide" disabled={busy}>
          {busy ? "処理しています…" : register ? "登録する" : "ログイン"}
        </button>
        <p className="auth-switch">
          {register ? "アカウントをお持ちの方" : "はじめての方"}
          <Link to={register ? "/login" : "/register"}>
            {register ? "ログイン" : "新規登録"}
          </Link>
        </p>
      </form>
    </main>
  );
}

export default AuthPage;
