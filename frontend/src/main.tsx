import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { api, type User } from "./api";
import { Auth, Empty, ErrorBox, Header, Loading } from "./components/shared";
import Home from "./pages/Home";
import Detail from "./pages/Detail";
import AuthPage from "./pages/AuthPage";
import Reservations from "./pages/Reservations";
import Organizer from "./pages/Organizer";
import Editor from "./pages/Editor";
import "./styles.css";
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = async () => {
    const session = await api<{ user: User | null }>("auth/session/");
    setUser(session.user);
  };
  const initialize = () => {
    setLoading(true);
    setError("");
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(initialize, []);
  return (
    <Auth.Provider value={{ user, refresh }}>
      <BrowserRouter>
        <Header />
        {loading ? (
          <Loading />
        ) : error ? (
          <main className="main">
            <ErrorBox message={error} />
            <button className="button" onClick={initialize}>
              再接続する
            </button>
          </main>
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/events/:id" element={<Detail />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage register />} />
            <Route path="/reservations" element={<Reservations />} />
            <Route path="/organizer" element={<Organizer />} />
            <Route path="/organizer/new" element={<Editor />} />
            <Route path="/organizer/:id/edit" element={<Editor />} />
            <Route
              path="*"
              element={
                <main className="main">
                  <Empty title="ページが見つかりません">
                    <Link to="/">トップへ戻る</Link>
                  </Empty>
                </main>
              }
            />
          </Routes>
        )}
        <footer>
          <Link to="/" className="logo">
            gather<span className="logo-period">.</span>
          </Link>
          <span>
            イベント予約サービス（ポートフォリオ用のデモ。掲載イベントは架空です）
          </span>
          <small>© {new Date().getFullYear()} Gather</small>
        </footer>
      </BrowserRouter>
    </Auth.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
