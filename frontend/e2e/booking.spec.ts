import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("visitor can sign up, reserve, see their reservation, and cancel", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "イベントを探す" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "新規登録" }).click();
  await page.getByLabel("表示名").fill("予約する人");
  await page
    .getByLabel("ユーザー名", { exact: true })
    .fill(`visitor_${Date.now()}`);
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("A-Long-Unique-Password-94!");
  await page.getByRole("button", { name: "登録する", exact: true }).click();
  await page
    .getByRole("link", { name: /週末のプロダクトづくり交流会/ })
    .click();
  await page
    .getByRole("button", { name: "このイベントを予約する", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("予約が完了しました");
  await page.getByRole("link", { name: "予約を確認する" }).click();
  await expect(page.getByText("予約済み", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page
    .getByRole("button", { name: "キャンセルする", exact: true })
    .click();
  await expect(page.getByText("キャンセル済み", { exact: true })).toBeVisible();
});

test("organizer can create, publish and edit an event", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("表示名").fill("新しい主催者");
  await page
    .getByLabel("ユーザー名", { exact: true })
    .fill(`host_${Date.now()}`);
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("Another-Long-Password-95!");
  await page.getByLabel("イベントの主催も希望する").check();
  await page.getByRole("button", { name: "登録する", exact: true }).click();
  await page.getByRole("link", { name: "主催者ページ", exact: true }).click();
  await page.getByRole("link", { name: "イベントを作成" }).click();
  await page.getByLabel("タイトル", { exact: true }).fill("新しい週末の集まり");
  await page
    .getByLabel("イベントの説明")
    .fill("初めての方も参加できる、小さな交流イベントです。");
  await page.getByLabel("開催場所").fill("東京・渋谷");
  const day = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("開始日時").fill(`${day}T14:00`);
  await page.getByLabel("終了日時").fill(`${day}T16:00`);
  await page.getByLabel("予約締切").fill(`${day}T12:00`);
  await page.getByLabel("キャンセル期限").fill(`${day}T10:00`);
  await page.getByLabel("公開状態").selectOption("published");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(
    page.getByText("新しい週末の集まり", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "編集", exact: true }).click();
  await page
    .getByLabel("タイトル", { exact: true })
    .fill("更新した週末の集まり");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(
    page.getByText("更新した週末の集まり", { exact: true }),
  ).toBeVisible();
});

test("search conditions persist in URL and empty results are explained", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "キーワードでイベントを検索" })
    .fill("no-such-event-94851");
  await page.getByRole("button", { name: "検索する" }).click();
  await expect(page).toHaveURL(/q=no-such-event-94851/);
  await expect(
    page.getByRole("heading", { name: "イベントが見つかりませんでした" }),
  ).toBeVisible();
});

test("desktop and mobile layouts keep all content inside the viewport", async ({
  page,
}) => {
  await mkdir("../docs/images", { recursive: true });
  for (const [name, width, height] of [
    ["desktop", 1440, 1080],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /週末のプロダクトづくり交流会/ }),
    ).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);
    await page.screenshot({
      path: `../docs/images/home-${name}.png`,
      fullPage: true,
    });
  }
});
