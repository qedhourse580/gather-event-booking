import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
} from "lucide-react";
import { api, type Event, type Page } from "../api";
import {
  categories,
  ErrorBox,
  Loading,
  Empty,
  EventCard,
} from "../components/shared";
function Home() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Page<Event> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(params.get("q") || "");
  const [retry, setRetry] = useState(0);
  const query = params.toString();
  useEffect(() => {
    setDraft(params.get("q") || "");
  }, [params]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<Page<Event>>(`events/?${query}`, "GET", undefined, controller.signal)
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, retry]);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> DISCOVER YOUR NEXT EXPERIENCE
          </div>
          <h1>
            いつもの日々に、
            <br />
            新しい<span>きっかけ</span>を。
          </h1>
          <p>
            気になることから、はじめよう。
            <br />
            好きなことと、まだ知らない仲間に出会う場所。
          </p>
          <a href="#events" className="hero-link">
            あなたの次の体験を見つける
            <ArrowRight size={19} />
          </a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-ring" />
          <div className="hero-sticker">
            HELLO,
            <br />
            NEW
            <br />
            <i>POSSIBILITIES.</i>
            <ArrowUpRight size={54} />
          </div>
          <div className="floating-tag">
            <Users size={17} /> 好きなことが、つながりになる。
          </div>
          <div className="tiny-star">✳</div>
        </div>
        <span className="hero-index">
          01 — EVERY GOOD THING STARTS WITH A MEETING.
        </span>
      </section>
      <main id="events" className="main">
        <div className="section-head">
          <div>
            <p className="eyebrow dark">FIND YOUR INTEREST</p>
            <h2>
              気になるイベントを探す<span className="accent-dot">.</span>
            </h2>
          </div>
          <span className="section-note">小さな一歩から、新しい出会いへ。</span>
        </div>
        <form
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            update("q", draft);
          }}
        >
          <Search size={21} />
          <input
            aria-label="キーワードでイベントを検索"
            placeholder="キーワードやエリアで検索"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="button" type="submit">
            検索する
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="filters">
          <div className="category-tabs" aria-label="カテゴリー">
            {categories.map(([key, label]) => (
              <button
                key={key}
                className={
                  params.get("category") === key ||
                  (!params.get("category") && !key)
                    ? "selected"
                    : ""
                }
                onClick={() => update("category", key)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={params.get("available") === "true"}
              onChange={(e) =>
                update("available", e.target.checked ? "true" : "")
              }
            />
            空席ありのみ
          </label>
        </div>
        <div className="results-header">
          <span>
            {loading ? "検索中…" : `${data?.count || 0} 件のイベント`}
          </span>
          <span>開催日が近い順</span>
        </div>
        {error ? (
          <>
            <ErrorBox message={error} />
            <button
              className="button outline"
              onClick={() => setRetry((v) => v + 1)}
            >
              もう一度読み込む
            </button>
          </>
        ) : loading ? (
          <Loading />
        ) : data?.results.length ? (
          <>
            <div className="event-grid">
              {data.results.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
            <div className="pagination">
              <button
                disabled={!data.previous}
                onClick={() =>
                  update("page", String(Number(params.get("page") || 1) - 1))
                }
              >
                <ChevronLeft size={16} />
                前へ
              </button>
              <span>
                {params.get("page") || 1} /{" "}
                {Math.max(1, Math.ceil(data.count / 9))}
              </span>
              <button
                disabled={!data.next}
                onClick={() =>
                  update("page", String(Number(params.get("page") || 1) + 1))
                }
              >
                次へ
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <Empty title="イベントが見つかりませんでした">
            キーワードやカテゴリーを変えて探してみてください。
          </Empty>
        )}
        <section className="host-banner">
          <div>
            <p className="eyebrow dark">BRING PEOPLE TOGETHER</p>
            <h2>あなたの「好き」を、イベントに。</h2>
            <p>小さな集まりから、はじめてみませんか。</p>
          </div>
          <Link className="button" to="/organizer">
            イベントを主催する
            <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
    </>
  );
}

export default Home;
