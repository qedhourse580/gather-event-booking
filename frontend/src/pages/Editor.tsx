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
import {
  isEditable,
  selectableStatuses,
  statusLabels,
  toLocalInput,
} from "../lib/eventRules";

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
    if (
      form.get("status") === "cancelled" &&
      event?.status !== "cancelled" &&
      !window.confirm(
        "開催中止にすると、予約はすべてキャンセル扱いになり、元に戻せません。よろしいですか？",
      )
    )
      return;
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
  if (event && !isEditable(event))
    return (
      <main className="main">
        <Empty title="開催中止にしたイベントは編集できません">
          <Link to="/organizer">主催者ページへ戻る</Link>
        </Empty>
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
                defaultValue={event ? toLocalInput(event[key]) : ""}
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
              {selectableStatuses(event).map((status) => (
                <option value={status} key={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="form-note">
          日時はお使いの端末のタイムゾーンで入力します。予約のあるイベントは下書きに戻せません。開催中止にすると予約はすべてキャンセル扱いになり、元に戻せません（予約履歴は保持されます）。
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
