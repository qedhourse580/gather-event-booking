import { useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  MapPin,
  UserRound,
} from "lucide-react";
import { api, ApiError, type Event } from "../api";
import {
  Auth,
  CategoryTag,
  ErrorBox,
  Loading,
  SeatMeter,
  date,
  time,
} from "../components/shared";
import { timeRange } from "../lib/format";
function Detail() {
  const { id } = useParams();
  const { user } = useContext(Auth);
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setEvent(null);
    setError("");
    setSuccess(false);
    api<Event>(`events/${id}/`, "GET", undefined, c.signal)
      .then(setEvent)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [id]);
  const book = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/events/${id}`)}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`events/${id}/reserve/`, "POST");
      setSuccess(true);
      setEvent(await api<Event>(`events/${id}/`));
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409)
        setEvent(await api<Event>(`events/${id}/`).catch(() => event));
    } finally {
      setBusy(false);
    }
  };
  if (!event)
    return (
      <main className="main">
        {error ? <ErrorBox message={error} /> : <Loading />}
      </main>
    );
  const cancelled = event.status === "cancelled";
  return (
    <main className="main detail">
      <Link to="/" className="back-link">
        <ChevronLeft size={17} />
        イベント一覧へ
      </Link>
      <div className="detail-layout">
        <header className="detail-header">
          <CategoryTag category={event.category} />
          <h1>{event.title}</h1>
          {cancelled && (
            <div className="notice warning" role="status">
              このイベントは開催中止になりました。
            </div>
          )}
          <dl className="detail-summary">
            <div>
              <dt>
                <CalendarDays size={18} aria-hidden="true" />
                日時
              </dt>
              <dd>
                {date(event.starts_at)}{" "}
                {timeRange(event.starts_at, event.ends_at)}
              </dd>
            </div>
            <div>
              <dt>
                <MapPin size={18} aria-hidden="true" />
                場所
              </dt>
              <dd>{event.location}</dd>
            </div>
            <div>
              <dt>
                <UserRound size={18} aria-hidden="true" />
                主催
              </dt>
              <dd>{event.organizer_name}</dd>
            </div>
          </dl>
        </header>
        <aside className="booking-panel" aria-labelledby="booking-title">
          <h2 id="booking-title">参加予約</h2>
          <SeatMeter event={event} />
          <dl className="booking-facts">
            <div>
              <dt>参加費</dt>
              <dd>無料</dd>
            </div>
            <div>
              <dt>定員</dt>
              <dd>{event.capacity}人</dd>
            </div>
          </dl>
          {error && <ErrorBox message={error} />}
          {success ? (
            <div className="notice success" role="status">
              <Check size={19} />
              予約が完了しました。<Link to="/reservations">予約を確認する</Link>
            </div>
          ) : (
            <button
              className="button wide"
              onClick={book}
              disabled={busy || !event.can_book}
            >
              {busy
                ? "予約しています…"
                : event.can_book
                  ? user
                    ? "このイベントを予約する"
                    : "ログインして予約する"
                  : cancelled
                    ? "開催中止のため予約できません"
                    : event.remaining === 0
                      ? "満席のため予約できません"
                      : "予約受付は終了しました"}
            </button>
          )}
          <p className="panel-note">1アカウントにつき1席まで予約できます。</p>
          <ul className="deadlines">
            <li>
              <Clock size={16} aria-hidden="true" />
              <span>予約締切</span>
              <strong>
                {date(event.booking_deadline)} {time(event.booking_deadline)}
              </strong>
            </li>
            <li>
              <Clock size={16} aria-hidden="true" />
              <span>キャンセル期限</span>
              <strong>
                {date(event.cancellation_deadline)}{" "}
                {time(event.cancellation_deadline)}
              </strong>
            </li>
          </ul>
        </aside>
        <article className="detail-body">
          <section className="article-section">
            <h2>イベントの内容</h2>
            <p className="description">{event.description}</p>
          </section>
        </article>
      </div>
    </main>
  );
}

export default Detail;
