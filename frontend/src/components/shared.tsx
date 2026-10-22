import React, { createContext, useContext, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Clock,
  Compass,
  Laptop,
  MapPin,
  Mountain,
  Palette,
  Sparkles,
  UsersRound,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { api, type Event, type User } from "../api";
import { dateBlock, seatStatus, timeRange } from "../lib/format";
const categories = [
  ["", "すべて"],
  ["technology", "テクノロジー"],
  ["art", "アート・カルチャー"],
  ["food", "フード"],
  ["outdoor", "アウトドア"],
  ["community", "交流会"],
];
const categoryLabel = (key: string) =>
  categories.find(([k]) => k === key)?.[1] || key;
const date = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
const time = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
const Auth = createContext<{ user: User | null; refresh: () => Promise<void> }>(
  { user: null, refresh: async () => {} },
);
function ErrorBox({ message }: { message: string }) {
  return (
    <div className="notice error" role="alert">
      {message}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      読み込んでいます…
    </div>
  );
}
function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Compass size={38} />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
const categoryIcons: Record<string, LucideIcon> = {
  technology: Laptop,
  art: Palette,
  food: UtensilsCrossed,
  outdoor: Mountain,
  community: UsersRound,
};
function CategoryTag({ category }: { category: string }) {
  const Icon = categoryIcons[category] || Compass;
  return (
    <span className={`category category-${category}`}>
      <Icon size={14} aria-hidden="true" />
      {categoryLabel(category)}
    </span>
  );
}
function DateBlock({ value }: { value: string }) {
  const d = dateBlock(value);
  return (
    <span className="date-block">
      <span className="date-month">{d.month}月</span>
      <span className="date-day">{d.day}</span>
      <span className="date-weekday">（{d.weekday}）</span>
    </span>
  );
}
function SeatMeter({
  event,
}: {
  event: Pick<Event, "remaining" | "capacity" | "can_book">;
}) {
  const seat = seatStatus(event);
  return (
    <div className={`seat-meter seat-${seat.level}`}>
      <span className="seat-label">{seat.label}</span>
      <span className="seat-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(seat.filled * 100)}%` }} />
      </span>
    </div>
  );
}
function EventCard({ event }: { event: Event }) {
  return (
    <Link to={`/events/${event.id}`} className="event-card">
      <DateBlock value={event.starts_at} />
      <div className="card-body">
        <CategoryTag category={event.category} />
        <h3>{event.title}</h3>
        <p className="card-line">
          <Clock size={15} aria-hidden="true" />
          {timeRange(event.starts_at, event.ends_at)}
        </p>
        <p className="card-line">
          <MapPin size={15} aria-hidden="true" />
          {event.location}
        </p>
        <SeatMeter event={event} />
      </div>
    </Link>
  );
}
function Header() {
  const { user, refresh } = useContext(Auth);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  return (
    <>
      <header className="header">
        <Link to="/" className="logo">
          <span className="logo-mark">
            <Sparkles size={21} />
          </span>
          gather<span className="logo-period">.</span>
        </Link>
        <nav aria-label="メインナビゲーション">
          <NavLink to="/" end>
            イベントを探す
          </NavLink>
          {user && <NavLink to="/reservations">予約したイベント</NavLink>}
          {user?.is_organizer && (
            <NavLink to="/organizer">主催者ページ</NavLink>
          )}
        </nav>
        <div className="account">
          {user ? (
            <>
              <span className="user-name">{user.display_name}</span>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await api("auth/logout/", "POST");
                    await refresh();
                    navigate("/");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="login-link">
                ログイン
              </Link>
              <Link to="/register" className="button small">
                新規登録
              </Link>
            </>
          )}
        </div>
      </header>
      {error && <ErrorBox message={error} />}
    </>
  );
}

export {
  categories,
  categoryLabel,
  date,
  time,
  Auth,
  ErrorBox,
  Loading,
  Empty,
  CategoryTag,
  DateBlock,
  SeatMeter,
  EventCard,
  Header,
};
