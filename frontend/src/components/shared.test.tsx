import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Event } from "../api";
import { EventCard, categoryLabel, date, time } from "./shared";

const baseEvent: Event = {
  id: 7,
  title: "はじめての陶芸",
  description: "説明",
  category: "art",
  location: "東京・清澄白河",
  starts_at: "2026-10-28T05:00:00Z", // 日本時間 14:00
  ends_at: "2026-10-28T07:00:00Z",
  booking_deadline: "2026-10-28T04:00:00Z",
  cancellation_deadline: "2026-10-27T05:00:00Z",
  capacity: 12,
  reserved_count: 3,
  remaining: 9,
  can_book: true,
  status: "published",
  organizer_name: "Host",
};

const renderCard = (event: Event) =>
  render(
    <MemoryRouter>
      <EventCard event={event} />
    </MemoryRouter>,
  );

describe("表示用の変換", () => {
  it("カテゴリーのキーを日本語名にし、未知のキーはそのまま表示する", () => {
    expect(categoryLabel("art")).toBe("アート・カルチャー");
    expect(categoryLabel("unknown")).toBe("unknown");
  });

  it("日時は端末に関係なく日本時間で表示する", () => {
    expect(date("2026-10-28T05:00:00Z")).toBe("10月28日(水)");
    expect(time("2026-10-28T05:00:00Z")).toBe("14:00");
    // 日本時間では日付が変わる時刻
    expect(date("2026-10-28T15:30:00Z")).toBe("10月29日(木)");
  });
});

describe("EventCard", () => {
  it("タイトル・日時・場所・残席を表示し、詳細ページへリンクする", () => {
    renderCard(baseEvent);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/events/7");
    expect(screen.getByText("はじめての陶芸")).toBeInTheDocument();
    expect(screen.getByText(/10月28日\(水\) 14:00〜/)).toBeInTheDocument();
    expect(screen.getByText("東京・清澄白河")).toBeInTheDocument();
    expect(screen.getByText("残り 9 席")).toBeInTheDocument();
  });

  it("残席が0なら「満席」と表示する", () => {
    renderCard({ ...baseEvent, reserved_count: 12, remaining: 0 });

    expect(screen.getByText("満席")).toBeInTheDocument();
    expect(screen.queryByText(/残り/)).not.toBeInTheDocument();
  });
});
