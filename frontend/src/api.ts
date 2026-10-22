export type User = {
  id: number;
  username: string;
  display_name: string;
  is_organizer: boolean;
};
export type Event = {
  id: number;
  title: string;
  description: string;
  category: string;
  location: string;
  starts_at: string;
  ends_at: string;
  booking_deadline: string;
  cancellation_deadline: string;
  capacity: number;
  reserved_count: number;
  remaining: number;
  can_book: boolean;
  status: string;
  organizer_name: string;
};
export type Reservation = {
  id: number;
  event: Event;
  status: "active" | "cancelled";
  created_at: string;
  can_cancel: boolean;
};
export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/** APIのエラーレスポンス（文字列・配列・項目ごとのオブジェクト）を、画面に表示する1つの文にする */
export function messages(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(messages).join(" ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(([k, v]) => `${k === "detail" ? "" : k + ": "}${messages(v)}`)
      .join(" / ");
  return "操作を完了できませんでした。";
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const csrf =
    document.cookie
      .split("; ")
      .find((v) => v.startsWith("csrftoken="))
      ?.split("=")
      .slice(1)
      .join("=") || "";
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      signal,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": decodeURIComponent(csrf),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "通信できませんでした。接続を確認してもう一度お試しください。",
    );
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({
    detail: "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
  }));
  if (!response.ok) throw new ApiError(response.status, messages(data));
  return data as T;
}
