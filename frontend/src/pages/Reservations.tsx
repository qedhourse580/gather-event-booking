import { useCallback, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { api, type Page, type Reservation } from "../api";
import {
  Auth,
  DateBlock,
  Empty,
  ErrorBox,
  Loading,
} from "../components/shared";
import { timeRange } from "../lib/format";
function Reservations() {
  const { user } = useContext(Auth);
  const [data, setData] = useState<Page<Reservation> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Reservation | null>(null);
  const [message, setMessage] = useState("");
  const load = useCallback(
    () => api<Page<Reservation>>(`reservations/?page=${page}`).then(setData),
    [page],
  );
  useEffect(() => {
    if (user) {
      setData(null);
      load().catch((e) => setError(e.message));
    }
  }, [user, load]);
  const cancel = async () => {
    if (!confirm) return;
    setBusy(confirm.id);
    setError("");
    try {
      await api(`reservations/${confirm.id}/cancel/`, "POST");
      setConfirm(null);
      setMessage("予約をキャンセルしました。");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  if (!user)
    return (
      <main className="main">
        <Empty title="ログインして予約を確認">
          <Link className="button" to="/login?next=/reservations">
            ログインする
          </Link>
        </Empty>
      </main>
    );
  return (
    <main className="main">
      <div className="page-head">
        <h1 className="page-title">予約したイベント</h1>
      </div>
      {error && <ErrorBox message={error} />}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {!data && !error ? (
        <Loading />
      ) : data?.results.length ? (
        <>
          <div className="reservation-list">
            {data.results.map((r) => (
              <article key={r.id} className="reservation-card">
                <DateBlock value={r.event.starts_at} />
                <div className="reservation-info">
                  <span
                    className={`status-pill ${r.status === "active" ? "active" : ""}`}
                  >
                    {r.status === "active" ? "予約済み" : "キャンセル済み"}
                  </span>
                  {r.event.status === "cancelled" && (
                    <span className="status-pill">開催中止</span>
                  )}
                  <Link to={`/events/${r.event.id}`}>
                    <h2>{r.event.title}</h2>
                  </Link>
                  <p>
                    {timeRange(r.event.starts_at, r.event.ends_at)} ／{" "}
                    {r.event.location}
                  </p>
                </div>
                {r.can_cancel && (
                  <button
                    className="button outline small"
                    onClick={() => setConfirm(r)}
                  >
                    キャンセル
                  </button>
                )}
              </article>
            ))}
          </div>
          <div className="pagination">
            <button
              disabled={!data.previous}
              onClick={() => setPage((v) => v - 1)}
            >
              前へ
            </button>
            <span>{page}</span>
            <button disabled={!data.next} onClick={() => setPage((v) => v + 1)}>
              次へ
            </button>
          </div>
        </>
      ) : (
        !error && (
          <Empty title="まだ予約したイベントがありません">
            <Link to="/" className="button">
              イベントを探す
            </Link>
          </Empty>
        )
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
          >
            <button
              className="modal-close"
              aria-label="閉じる"
              onClick={() => setConfirm(null)}
              disabled={busy !== null}
            >
              <X size={20} />
            </button>
            <h2 id="cancel-title">予約をキャンセルしますか？</h2>
            <p>{confirm.event.title}</p>
            <p>受付期間内で空席があれば、再度予約できます。</p>
            {error && <ErrorBox message={error} />}
            <div className="modal-actions">
              <button
                className="button outline"
                onClick={() => setConfirm(null)}
                disabled={busy !== null}
              >
                予約を残す
              </button>
              <button
                className="button danger"
                onClick={cancel}
                disabled={busy !== null}
              >
                {busy ? "処理しています…" : "キャンセルする"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Reservations;
