import { describe, expect, it } from "vitest";
import { dateBlock, seatStatus, timeRange } from "./format";

describe("dateBlock", () => {
  it("日本時間の月・日・曜日に分ける", () => {
    expect(dateBlock("2026-10-28T05:00:00Z")).toEqual({
      month: "10",
      day: "28",
      weekday: "水",
    });
  });

  it("UTCでは前日でも、日本時間の日付で表示する", () => {
    expect(dateBlock("2026-10-28T15:30:00Z")).toMatchObject({
      day: "29",
      weekday: "木",
    });
  });
});

describe("timeRange", () => {
  it("同じ日なら開始と終了の時刻だけを表示する", () => {
    expect(timeRange("2026-10-28T05:00:00Z", "2026-10-28T07:30:00Z")).toBe(
      "14:00〜16:30",
    );
  });

  it("日付をまたぐ場合は終了側に日付を付ける", () => {
    expect(timeRange("2026-10-28T13:00:00Z", "2026-10-28T16:00:00Z")).toBe(
      "22:00〜10/29 01:00",
    );
  });
});

describe("seatStatus", () => {
  const event = (remaining: number, capacity: number, can_book = true) => ({
    remaining,
    capacity,
    can_book,
  });

  it("余裕があれば残席と定員を表示する", () => {
    expect(seatStatus(event(15, 20))).toEqual({
      level: "open",
      label: "残り15席 / 20席",
      filled: 0.25,
    });
  });

  it("残り3席以下は「残りわずか」として扱う（定員が少ないイベント）", () => {
    expect(seatStatus(event(3, 10)).level).toBe("few");
    expect(seatStatus(event(4, 10)).level).toBe("open");
  });

  it("定員の2割以下も「残りわずか」として扱う（定員が多いイベント）", () => {
    expect(seatStatus(event(20, 100)).level).toBe("few");
    expect(seatStatus(event(21, 100)).level).toBe("open");
  });

  it("残席0は満席", () => {
    expect(seatStatus(event(0, 20))).toEqual({
      level: "full",
      label: "満席",
      filled: 1,
    });
  });

  it("空席があっても予約を受け付けていなければ受付終了", () => {
    expect(seatStatus(event(10, 20, false))).toMatchObject({
      level: "closed",
      label: "受付終了",
    });
  });
});
