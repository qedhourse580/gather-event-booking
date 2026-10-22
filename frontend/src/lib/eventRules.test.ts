import { describe, expect, it } from "vitest";
import { isEditable, selectableStatuses, toLocalInput } from "./eventRules";

describe("selectableStatuses（編集画面で選べる公開状態）", () => {
  it("新規作成では下書きと公開だけ選べる（開催中止は選べない）", () => {
    expect(selectableStatuses(null)).toEqual(["draft", "published"]);
  });

  it("下書きからは公開にできるが、開催中止にはできない", () => {
    expect(selectableStatuses({ status: "draft", reserved_count: 0 })).toEqual([
      "draft",
      "published",
    ]);
  });

  it("予約のない公開イベントは、下書きにも開催中止にもできる", () => {
    expect(
      selectableStatuses({ status: "published", reserved_count: 0 }),
    ).toEqual(["published", "draft", "cancelled"]);
  });

  it("予約のある公開イベントは下書きに戻せない", () => {
    expect(
      selectableStatuses({ status: "published", reserved_count: 1 }),
    ).toEqual(["published", "cancelled"]);
  });

  it("開催中止したイベントはどの状態にも変更できない", () => {
    expect(
      selectableStatuses({ status: "cancelled", reserved_count: 0 }),
    ).toEqual([]);
  });
});

describe("isEditable", () => {
  it("開催中止したイベントだけ編集できない", () => {
    expect(isEditable(null)).toBe(true);
    expect(isEditable({ status: "draft" })).toBe(true);
    expect(isEditable({ status: "published" })).toBe(true);
    expect(isEditable({ status: "cancelled" })).toBe(false);
  });
});

describe("toLocalInput", () => {
  it("datetime-local 入力欄の形式（YYYY-MM-DDTHH:MM）にゼロ埋めして変換する", () => {
    const value = new Date(2026, 0, 5, 9, 7).toISOString(); // 端末時刻で 2026-01-05 09:07
    expect(toLocalInput(value)).toBe("2026-01-05T09:07");
  });
});
