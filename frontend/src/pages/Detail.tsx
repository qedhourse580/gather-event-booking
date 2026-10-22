import { useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import { api, ApiError, type Event } from "../api";
import {
  Auth,
  Cover,
  ErrorBox,
  Loading,
  date,
  time,
  categoryLabel,
} from "../components/shared";
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
  return (
    <main className="main detail">
      <Link to="/" className="back-link">
        <ChevronLeft size={17} />
        イベント一覧へ
      </Link>
      <div className="detail-layout">
        <article>
          <Cover event={event} large />
          <span className="category">{categoryLabel(event.category)}</span>
          <h1>{event.title}</h1>
          <div className="detail-meta">
            <p>
              <CalendarDays size={19} />
              {date(event.starts_at)} {time(event.starts_at)}–
              {time(event.ends_at)}
            </p>
            <p>
              <MapPin size={19} />
              {event.location}
            </p>
            <p>
              <Users size={19} />
              定員 {event.capacity} 人
            </p>
          </div>
          <div className="article-section">
            <h2>このイベントについて</h2>
            <p className="description">{event.description}</p>
          </div>
          <div className="article-section">
            <h2>主催者</h2>
            <p className="host-name">
              <span className="avatar">{event.organizer_name.slice(0, 1)}</span>
              {event.organizer_name}
            </p>
          </div>
        </article>
        <aside className="booking-panel">
          <span className="eyebrow dark">YOUR NEXT EXPERIENCE</span>
          <h2>この体験に参加する</h2>
          <div className="price">
            無料<span>／ 1名</span>
          </div>
          <p className="remaining">
            <span />
            残り {event.remaining} 席 / 定員 {event.capacity} 人
          </p>
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
              {busy ? (
                "予約しています…"
              ) : event.can_book ? (
                <>
                  {user ? "このイベントを予約する" : "ログインして予約する"}
                  <ArrowRight size={18} />
                </>
              ) : (
                "予約受付は終了しました"
              )}
            </button>
          )}
          <p className="panel-note">1アカウントにつき1席まで予約できます。</p>
          <div className="deadline">
            <Clock size={16} />
            <div>
              予約締切
              <br />
              <strong>
                {date(event.booking_deadline)} {time(event.booking_deadline)}
              </strong>
            </div>
          </div>
          <div className="deadline">
            <CalendarDays size={16} />
            <div>
              キャンセル期限
              <br />
              <strong>
                {date(event.cancellation_deadline)}{" "}
                {time(event.cancellation_deadline)}
              </strong>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default Detail;
