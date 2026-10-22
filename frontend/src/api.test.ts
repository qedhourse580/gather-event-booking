import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, messages } from "./api";

/** 失敗するはずの呼び出しから、投げられた ApiError を取り出す */
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("成功してしまいました");
    },
    (e: unknown) => e as ApiError,
  );

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("messages（エラー内容を表示用の文にする）", () => {
  it("文字列はそのまま返す", () => {
    expect(messages("満席のため予約できません。")).toBe(
      "満席のため予約できません。",
    );
  });

  it("detail は項目名を付けずに表示する", () => {
    expect(messages({ detail: "予約が見つかりません。" })).toBe(
      "予約が見つかりません。",
    );
  });

  it("項目ごとのエラーは「項目: 内容」をつなげて表示する", () => {
    expect(
      messages({
        capacity: ["定員は1〜10000人にしてください。"],
        title: ["必須です。"],
      }),
    ).toBe("capacity: 定員は1〜10000人にしてください。 / title: 必須です。");
  });

  it("想定外の値は共通のメッセージにする", () => {
    expect(messages(null)).toBe("操作を完了できませんでした。");
  });
});

describe("api", () => {
  it("成功したらJSONを返し、CSRFトークンをヘッダーに付ける", async () => {
    document.cookie = "csrftoken=abc%3D123";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(201, { id: 1 }));

    await expect(api("events/1/reserve/", "POST")).resolves.toEqual({ id: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/events/1/reserve/");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["X-CSRFToken"]).toBe(
      "abc=123",
    );
  });

  it("204 のときは undefined を返す", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await expect(api("auth/logout/", "POST")).resolves.toBeUndefined();
  });

  it("エラーのときはステータスとメッセージを持つ ApiError を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(409, { detail: "満席のため予約できません。" }),
    );

    const error = await failure(api("events/1/reserve/", "POST"));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe("満席のため予約できません。");
  });

  it("サーバーがJSON以外を返したときは、共通のメッセージにする", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>Bad Gateway</html>", { status: 502 }),
    );

    const error = await failure(api("events/"));

    expect(error.status).toBe(502);
    expect(error.message).toContain("サーバーでエラーが発生しました");
  });

  it("通信できないときはステータス0の ApiError を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed"));

    const error = await failure(api("events/"));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toContain("通信できませんでした");
  });

  it("中断（AbortError）はそのまま投げ直す", async () => {
    const abort = new DOMException("aborted", "AbortError");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(abort);

    await expect(api("events/")).rejects.toBe(abort);
  });
});
