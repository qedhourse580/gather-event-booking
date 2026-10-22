import React, { createContext, useContext, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Compass,
  MapPin,
  Sparkles,
} from "lucide-react";
import { api, type Event, type User } from "../api";
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
function Cover({ event, large = false }: { event: Event; large?: boolean }) {
  return (
    <div
      className={`cover cover-${event.category} ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      <div className="art-orbit" />
      <div className="art-orbit two" />
      <div className="art-dot" />
      <span className="cover-caption">
        {event.category === "technology"
          ? "BUILD / CONNECT"
          : event.category === "art"
            ? "MAKE SOMETHING"
            : event.category === "food"
              ? "TASTE THE MOMENT"
              : event.category === "outdoor"
                ? "OUTSIDE THE EVERYDAY"
                : "GOOD PEOPLE, GOOD IDEAS"}
      </span>
      <span className="cover-brand">gather ↗</span>
    </div>
  );
}
function EventCard({ event }: { event: Event }) {
  return (
    <Link to={`/events/${event.id}`} className="event-card">
      <Cover event={event} />
      <div className="card-body">
        <div className="card-meta">
          <span className="category">{categoryLabel(event.category)}</span>
          <span className={`seats ${event.remaining === 0 ? "full" : ""}`}>
            {event.remaining === 0 ? "満席" : `残り ${event.remaining} 席`}
          </span>
        </div>
        <h3>{event.title}</h3>
        <p>
          <CalendarDays size={15} />
          {date(event.starts_at)} {time(event.starts_at)}〜
        </p>
        <p>
          <MapPin size={15} />
          {event.location}
        </p>
        <div className="card-bottom">
          <span>参加無料</span>
          <ArrowUpRight size={18} />
        </div>
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
                <ArrowUpRight size={15} />
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
  Cover,
  EventCard,
  Header,
};
