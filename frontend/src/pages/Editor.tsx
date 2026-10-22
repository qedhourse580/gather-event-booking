import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft } from "lucide-react";
import { api, type Event } from "../api";
import {
  Auth,
  Empty,
  ErrorBox,
  Loading,
  categories,
} from "../components/shared";
const localInput = (value: string) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
function Editor() {
  const { id } = useParams();
  const { user } = useContext(Auth);
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (id && user?.is_organizer)
      api<Event>(`organizer/events/${id}/`)
        .then(setEvent)
        .catch((e) => setError(e.message));
  }, [id, user]);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(form);
    for (const k of [
      "starts_at",
      "ends_at",
      "booking_deadline",
      "cancellation_deadline",
    ])
      payload[k] = new Date(String(payload[k])).toISOString();
    payload.capacity = Number(payload.capacity);
    setBusy(true);
    setError("");
    try {
      await api(
        `organizer/events/${id ? id + "/" : ""}`,
        id ? "PATCH" : "POST",
        payload,
      );
      navigate("/organizer");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!user?.is_organizer)
    return (
      <main className="main">
        <Empty title="主催者としてログインしてください">
          <Link to="/login">ログイン</Link>
        </Empty>
      </main>
    );
  if (id && !event)
    return (
      <main className="main">
        {error ? <ErrorBox message={error} /> : <Loading />}
      </main>
    );
  return (
    <main className="main editor">
      <Link to="/organizer" className="back-link">
        <ChevronLeft size={17} />
        主催者ページへ
      </Link>
      <h1>{id ? "イベントを編集" : "新しいイベントを作成"}</h1>
      <p className="muted">
        体験の内容と参加条件を、わかりやすく伝えましょう。
      </p>
      <form className="editor-form" onSubmit={submit}>
        {error && <ErrorBox message={error} />}
        <label>
          タイトル
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={event?.title}
          />
        </label>
        <label>
          イベントの説明
          <textarea
            name="description"
            required
            maxLength={10000}
            rows={7}
            defaultValue={event?.description}
          />
        </label>
        <div className="form-grid">
          <label>
            カテゴリー
            <select
              name="category"
              defaultValue={event?.category || "community"}
            >
              {categories
                .filter(([k]) => k)
                .map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
            </select>
          </label>
          <label>
            開催場所
            <input
              name="location"
              required
              maxLength={150}
              placeholder="東京・渋谷 / オンライン"
              defaultValue={event?.location}
            />
          </label>
          {(
            [
              ["starts_at", "開始日時"],
              ["ends_at", "終了日時"],
              ["booking_deadline", "予約締切"],
              ["cancellation_deadline", "キャンセル期限"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="datetime-local"
                name={key}
                required
                defaultValue={event ? localInput(event[key]) : ""}
              />
            </label>
          ))}
          <label>
            定員
            <input
              type="number"
              min={Math.max(1, event?.reserved_count || 0)}
              max={10000}
              name="capacity"
              required
              defaultValue={event?.capacity || 20}
            />
          </label>
          <label>
            公開状態
            <select name="status" defaultValue={event?.status || "draft"}>
              <option value="draft">下書き</option>
              <option value="published">公開する</option>
              <option value="cancelled">開催中止</option>
            </select>
          </label>
        </div>
        <p className="form-note">
          日時はお使いの端末のタイムゾーンで入力します。予約のあるイベントは下書きに戻せません。開催中止後も予約履歴は保持されます。
        </p>
        <div className="form-actions">
          <Link className="button outline" to="/organizer">
            戻る
          </Link>
          <button className="button" disabled={busy}>
            {busy ? "保存しています…" : "保存する"}
            <Check size={17} />
          </button>
        </div>
      </form>
    </main>
  );
}

export default Editor;
