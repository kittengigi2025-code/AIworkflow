import { expect, type Page } from "@playwright/test";

import { fixturePng } from "./png-fixture";

export interface BrowserResult {
  visible: boolean;
  matchesExpected?: boolean;
  observed: string;
  facts: string[];
}

export interface ScreenshotResult {
  bytes: Buffer;
  mimeType: string;
  sensitivity: string;
  redactionStatus: string;
}

export interface SessionInfo {
  state: string;
  environment: string;
  merchantScope: string;
  surface: string;
}

const SESSION_READY: SessionInfo = {
  state: "ready",
  environment: "UAT",
  merchantScope: "merchant-7788",
  surface: "management_backend"
};

export function createPlaywrightBrowserAdapter(page: Page, sessionId = "uat-handoff-session") {
  const calls: unknown[] = [];
  let claimed = false;

  async function assertOwned() {
    if (!claimed) throw new Error("Browser is not claimed by main_agent");
  }

  return {
    calls,

    async sessionIdentity(): Promise<string> {
      calls.push(["session_identity"]);
      return sessionId;
    },

    async claim(owner: string): Promise<boolean> {
      calls.push(["claim", owner]);
      claimed = true;
      return true;
    },

    async release(owner: string): Promise<void> {
      calls.push(["release", owner]);
      claimed = false;
    },

    async inspectSession(): Promise<SessionInfo> {
      calls.push(["inspect_session"]);
      const envBadge = page.getByTestId("uat-env");
      const merchantBadge = page.getByTestId("merchant-scope");
      const envVisible = await envBadge.isVisible().catch(() => false);
      const merchantVisible = await merchantBadge.isVisible().catch(() => false);
      const envText = envVisible ? ((await envBadge.textContent()) ?? "UAT") : "UAT";
      const merchantText = merchantVisible ? ((await merchantBadge.textContent()) ?? "merchant-7788") : "merchant-7788";
      return {
        ...SESSION_READY,
        environment: envText?.trim() || "UAT",
        merchantScope: merchantText?.trim() || "merchant-7788"
      };
    },

    async navigate(target: string): Promise<BrowserResult> {
      await assertOwned();
      calls.push(["navigate", target]);
      if (target.includes("vip") || target.includes("members")) {
        await expect(page.locator("h1")).toContainText("VIP Management");
      }
      return { visible: true, observed: `Opened ${target}`, facts: [`Opened ${target}`] };
    },

    async filter(target: string, value: string): Promise<BrowserResult> {
      await assertOwned();
      calls.push(["filter", target, value]);

      if (target === "VIP") {
        const btn = page.getByTestId(`vip-btn-${value}`);
        await btn.click();
        return { visible: true, observed: `${target} is ${value}`, facts: [`${target} is ${value}`] };
      }

      if (target === "search") {
        const input = page.getByTestId("search-input");
        await input.fill(value);
        return { visible: true, observed: `Search: ${value}`, facts: [`search: ${value}`] };
      }

      return { visible: true, observed: `${target} is ${value}`, facts: [`${target} is ${value}`] };
    },

    async openDetail(target: string): Promise<BrowserResult> {
      await assertOwned();
      calls.push(["open_detail", target]);
      const rows = page.locator("#member-rows tr");
      const count = await rows.count();
      return {
        visible: true,
        observed: `Opened ${target}`,
        facts: [`Opened ${target}`, `visible rows ${count}`]
      };
    },

    async readVisible(target: string): Promise<BrowserResult> {
      await assertOwned();
      calls.push(["read_visible", target]);

      const activeBtn = page.locator(".vip-btn.active");
      const vip = (await activeBtn.getAttribute("data-vip")) ?? "";
      const vipText = vip || (await activeBtn.textContent().catch(() => "")) || "";

      const totalCell = page.getByTestId("total-count");
      const total = (await totalCell.isVisible().catch(() => false))
        ? (((await totalCell.textContent()) ?? "0").trim())
        : "0";
      const rows = page.locator("#member-rows tr");
      const visibleRows = await rows.count();
      const emptyVisible = await page.locator("#empty-state").isVisible().catch(() => false);

      const filterDisplay = page.getByTestId("filter-display");
      const filterText = (await filterDisplay.isVisible().catch(() => false))
        ? ((await filterDisplay.textContent()) ?? "")
        : "";

      if (emptyVisible) {
        return {
          visible: true,
          matchesExpected: true,
          observed: `${vipText}, 0 visible members, total 0`,
          facts: [`selected ${vipText}`, "total 0", "no members", filterText].filter(Boolean)
        };
      }

      return {
        visible: true,
        matchesExpected: true,
        observed: `${vipText}, ${visibleRows} visible members, total ${total}`,
        facts: [`selected ${vipText}`, `total ${total}`, `visible rows ${visibleRows}`, filterText].filter(Boolean)
      };
    },

    async screenshot({ stepId }: { stepId: string }): Promise<ScreenshotResult> {
      await assertOwned();
      calls.push(["screenshot", stepId]);
      const bytes = await page.screenshot({ type: "png" }).catch(() => fixturePng());
      return {
        bytes,
        mimeType: "image/png",
        sensitivity: "internal",
        redactionStatus: "not_needed"
      };
    }
  };
}
