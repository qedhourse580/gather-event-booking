import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
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
      <section className="search-hero">
        <div className="search-hero-inner">
          <h1>イベントを探す</h1>
          <p>勉強会・ワークショップ・交流会を探して、そのまま予約できます。</p>
          <form
            className="search-bar"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              update("q", draft);
            }}
          >
            <Search size={20} aria-hidden="true" />
            <input
              aria-label="キーワードでイベントを検索"
              placeholder="キーワード・場所（例：Python、渋谷、オンライン）"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="button" type="submit">
              検索する
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
              空席のあるイベントだけ表示
            </label>
          </div>
        </div>
      </section>
      <main id="events" className="main">
        <div className="results-header" aria-live="polite">
          <strong>
            {loading ? "検索しています…" : `${data?.count || 0}件のイベント`}
          </strong>
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
            <h2>イベントを主催する方へ</h2>
            <p>
              主催者として登録すると、イベントの作成・公開と、予約者の確認ができます。
            </p>
          </div>
          <Link className="button outline" to="/organizer">
            主催者ページへ
          </Link>
        </section>
      </main>
    </>
  );
}

export default Home;
