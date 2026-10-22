import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { api, type Event, type Page } from "../api";
import {
  Auth,
  Empty,
  ErrorBox,
  Loading,
  date,
  time,
} from "../components/shared";
type Attendee = {
  id: number;
  participant: string;
  status: string;
  created_at: string;
};
function Organizer() {
  const { user } = useContext(Auth);
  const [data, setData] = useState<Page<Event> | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [attendees, setAttendees] = useState<{
    event: Event;
    page: Page<Attendee>;
    number: number;
  } | null>(null);
  useEffect(() => {
    if (user?.is_organizer)
      api<Page<Event>>(`organizer/events/?page=${page}`)
        .then(setData)
        .catch((e) => setError(e.message));
  }, [user, page]);
  const show = async (event: Event, number = 1) => {
    try {
      const result = await api<Page<Attendee>>(
        `organizer/events/${event.id}/attendees/?page=${number}`,
      );
      setAttendees({ event, page: result, number });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (!user)
    return (
      <main className="main">
        <Empty title="イベントを主催しませんか？">
          <Link to="/register" className="button">
            主催者として登録する
          </Link>
        </Empty>
      </main>
    );
  if (!user.is_organizer)
    return (
      <main className="main">
        <Empty title="主催者アカウントが必要です">
          主催者として登録したアカウントでログインしてください。
        </Empty>
      </main>
    );
  return (
    <main className="main">
      <div className="page-head">
        <h1 className="page-title">主催イベント</h1>
        <Link className="button" to="/organizer/new">
          <Plus size={18} />
          イベントを作成
        </Link>
      </div>
      {error && <ErrorBox message={error} />}
      {!data && !error ? (
        <Loading />
      ) : data?.results.length ? (
        <>
          <div className="organizer-table">
            <table>
              <thead>
                <tr>
                  <th>イベント</th>
                  <th>公開状態</th>
                  <th>予約状況</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((event) => (
                  <tr key={event.id}>
                    <td data-label="イベント">
                      <strong>{event.title}</strong>
                      <small>
                        {date(event.starts_at)} {time(event.starts_at)}
                      </small>
                    </td>
                    <td data-label="公開状態">
                      <span className={`status-pill status-${event.status}`}>
                        {event.status === "published"
                          ? "公開中"
                          : event.status === "draft"
                            ? "下書き"
                            : "開催中止"}
                      </span>
                    </td>
                    <td data-label="予約状況">
                      {event.reserved_count} / {event.capacity} 人
                    </td>
                    <td data-label="操作">
                      <div className="table-actions">
                        <Link to={`/organizer/${event.id}/edit`}>編集</Link>
                        <button
                          className="text-button"
                          onClick={() => show(event)}
                        >
                          予約者
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <Empty title="まだイベントがありません">
            「イベントを作成」から、最初のイベントを登録してください。
          </Empty>
        )
      )}
      {attendees && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendees-title"
          >
            <button
              className="modal-close"
              aria-label="閉じる"
              onClick={() => setAttendees(null)}
            >
              <X size={20} />
            </button>
            <h2 id="attendees-title">予約者一覧</h2>
            <p>{attendees.event.title}</p>
            {attendees.page.results.length ? (
              attendees.page.results.map((a) => (
                <div className="attendee" key={a.id}>
                  <span>{a.participant}</span>
                  <span>
                    {a.status === "active" ? "予約済み" : "キャンセル済み"}
                  </span>
                </div>
              ))
            ) : (
              <p>予約者はいません。</p>
            )}
            <div className="pagination">
              <button
                disabled={!attendees.page.previous}
                onClick={() => show(attendees.event, attendees.number - 1)}
              >
                前へ
              </button>
              <span>{attendees.number}</span>
              <button
                disabled={!attendees.page.next}
                onClick={() => show(attendees.event, attendees.number + 1)}
              >
                次へ
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Organizer;
