import type { Event } from "../api";

export type EventStatus = "draft" | "published" | "cancelled";

export const statusLabels: Record<EventStatus, string> = {
  draft: "下書き",
  published: "公開する",
  cancelled: "開催中止",
};

/**
 * 編集画面で選べる公開状態。
 * バックエンドの遷移ルール（Event.ALLOWED_TRANSITIONS）と同じ内容にしている。
 */
export function selectableStatuses(
  event?: Pick<Event, "status" | "reserved_count"> | null,
): EventStatus[] {
  if (!event) return ["draft", "published"];
  switch (event.status as EventStatus) {
    case "draft":
      return ["draft", "published"];
    case "published":
      // 予約のあるイベントは下書きに戻せない
      return event.reserved_count > 0
        ? ["published", "cancelled"]
        : ["published", "draft", "cancelled"];
    default:
      return [];
  }
}

export function isEditable(event?: Pick<Event, "status"> | null): boolean {
  return event?.status !== "cancelled";
}

/** ISO形式の日時を、datetime-local 入力欄用（端末のタイムゾーン）の文字列にする */
export function toLocalInput(value: string): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
