import type { Event } from "../api";

const TIME_ZONE = "Asia/Tokyo";

const parts = (value: string, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("ja-JP", { timeZone: TIME_ZONE, ...options })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );

/** カードの日付ブロック用（日本時間）：{ month: "10", day: "28", weekday: "水" } */
export function dateBlock(value: string) {
  const p = parts(value, {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  return { month: p.month, day: p.day, weekday: p.weekday };
}

/** 開催時間（日本時間）。日付をまたぐ場合は終了側に日付を付ける */
export function timeRange(start: string, end: string): string {
  const t = (v: string) => {
    const p = parts(v, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    return `${p.hour}:${p.minute}`;
  };
  const day = (v: string) => {
    const p = parts(v, { month: "numeric", day: "numeric" });
    return `${p.month}/${p.day}`;
  };
  return day(start) === day(end)
    ? `${t(start)}〜${t(end)}`
    : `${t(start)}〜${day(end)} ${t(end)}`;
}

export type SeatLevel = "open" | "few" | "full" | "closed";

/** 残席の少なさの基準：定員の2割以下、または残り3席以下 */
const isFew = (remaining: number, capacity: number) =>
  remaining <= 3 || remaining / capacity <= 0.2;

/** 残席の状態と、表示する文言・埋まり具合（0〜1） */
export function seatStatus(
  event: Pick<Event, "remaining" | "capacity" | "can_book">,
): { level: SeatLevel; label: string; filled: number } {
  const filled =
    event.capacity > 0
      ? (event.capacity - event.remaining) / event.capacity
      : 0;
  if (event.remaining <= 0) return { level: "full", label: "満席", filled: 1 };
  if (!event.can_book) return { level: "closed", label: "受付終了", filled };
  if (isFew(event.remaining, event.capacity))
    return { level: "few", label: `残り${event.remaining}席`, filled };
  return {
    level: "open",
    label: `残り${event.remaining}席 / ${event.capacity}席`,
    filled,
  };
}
