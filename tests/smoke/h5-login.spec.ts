import { expect, test } from "@playwright/test";

import { firstVisible } from "../support/locators";
import { hasEnv, optionalEnv, requiredEnv } from "../support/env";

test.describe("H5 member identity seam", () => {
  test.skip(!hasEnv("H5_BASE_URL"), "H5_BASE_URL is not set — skipping live H5 smoke test");

  test("member can log in to H5 and reach the game dashboard", async ({ page }) => {
    const baseUrl = requiredEnv("H5_BASE_URL");
    const account = requiredEnv("H5_MEMBER_ACCOUNT");
    const password = requiredEnv("H5_MEMBER_PASSWORD");
    const loggedInText = optionalEnv("H5_LOGGED_IN_TEXT");

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    const accountInput = firstVisible(page, [
      { testId: "h5-login-account" },
      { label: /account|phone|mobile|username|会员|账号|手机号/i },
      { placeholder: /account|phone|mobile|username|会员|账号|手机号/i }
    ]);
    await expect(accountInput).toBeVisible();
    await accountInput.fill(account);

    const passwordInput = firstVisible(page, [
      { testId: "h5-login-password" },
      { label: /password|密码/i },
      { placeholder: /password|密码/i }
    ]);
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill(password);

    const loginButton = firstVisible(page, [
      { testId: "h5-login-submit" },
      { role: "button", name: /log in|login|sign in|登录|登入/i }
    ]);
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    await expect(page).toHaveURL(/dashboard\/game|\/game/i);

    const loggedInSurface = loggedInText
      ? page.getByText(loggedInText, { exact: false })
      : firstVisible(page, [
          { testId: "h5-game-dashboard" },
          { testId: "h5-wallet-entry" },
          { testId: "h5-member-center" },
          { role: "link", name: /wallet|balance|member|profile|钱包|余额|会员|我的/i },
          { role: "button", name: /wallet|balance|member|profile|钱包|余额|会员|我的/i }
        ]);

    await expect(loggedInSurface).toBeVisible();
  });
});
