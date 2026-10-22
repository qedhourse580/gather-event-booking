import React, { useContext, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
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
        <p className="eyebrow dark">A NEW EXPERIENCE AWAITS</p>
        <h1>
          出会いの先に、
          <br />
          新しい自分。
        </h1>
        <p>
          気になるイベントを見つけて、
          <br />
          次の一歩を踏み出そう。
        </p>
        <Sparkles size={70} />
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h1>{register ? "アカウントをつくる" : "おかえりなさい"}</h1>
        <p>
          {register
            ? "無料で登録して、イベントに参加しましょう。"
            : "ログインして、次の体験を見つけましょう。"}
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
          <ArrowRight size={18} />
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
