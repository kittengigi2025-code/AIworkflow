import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

const evidenceDir = path.join(
  workspaceRoot,
  "test-results",
  "qa-workstation-vip-workflo-73ce8-m-raw-job-to-terminal-state-mobile-chrome",
  "jobs",
  "REQ-20260711-vip-workflow",
  "evidence"
);

const shots = {
  vip1: "EV-001.png",
  vip2: "EV-003.png",
  vip3: "EV-004.png",
  search: "EV-005.png"
};

async function toBase64(filePath) {
  const buf = await readFile(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

const [vip1, vip2, vip3, search] = await Promise.all([
  toBase64(path.join(evidenceDir, shots.vip1)),
  toBase64(path.join(evidenceDir, shots.vip2)),
  toBase64(path.join(evidenceDir, shots.vip3)),
  toBase64(path.join(evidenceDir, shots.search))
]);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>VIP管理需求测试截图</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #1a1a2e;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      min-width: 1200px;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .header h1 {
      margin: 0 0 8px;
      font-size: 28px;
      color: #ff4d4f;
    }
    .header p {
      margin: 0;
      color: #aaa;
      font-size: 14px;
    }
    .section {
      background: #16213e;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      border: 1px solid #2a2a4a;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #ffd700;
    }
    .section-desc {
      font-size: 13px;
      color: #bbb;
      margin-bottom: 16px;
    }
    .compare-row {
      display: flex;
      gap: 24px;
      justify-content: center;
      align-items: flex-start;
    }
    .shot-wrapper {
      position: relative;
      display: inline-block;
      border-radius: 8px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .shot-wrapper img {
      display: block;
      width: 390px;
      height: auto;
    }
    .shot-label {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(255, 77, 79, 0.9);
      color: #fff;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      z-index: 10;
    }
    .svg-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 5;
    }
    .annotation-text {
      fill: #ff4d4f;
      font-size: 15px;
      font-weight: 700;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 4px #000;
    }
    .annotation-text-bg {
      fill: rgba(0,0,0,0.55);
      rx: 4;
    }
    .annotation-box {
      fill: none;
      stroke: #ff4d4f;
      stroke-width: 2;
      stroke-dasharray: 6 3;
    }
    .annotation-arrow {
      fill: none;
      stroke: #ff4d4f;
      stroke-width: 2;
      marker-end: url(#arrowhead);
    }
    .annotation-line {
      fill: none;
      stroke: #ff4d4f;
      stroke-width: 2;
    }
    .single-shot {
      display: flex;
      justify-content: center;
    }
    .single-shot .shot-wrapper img {
      width: 430px;
    }
  </style>
</head>
<body>
  <svg width="0" height="0" style="position:absolute;">
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#ff4d4f" />
      </marker>
    </defs>
  </svg>

  <div class="header">
    <h1>VIP管理需求测试截图</h1>
    <p>巴西站 UAT | 福利中心 / VIP管理 / 查看会员 | 2026-07-11</p>
  </div>

  <!-- 需求一：新增 tab -->
  <div class="section">
    <div class="section-title">需求一：VIP管理新增「查看会员」Tab</div>
    <div class="section-desc">在 VIP管理页面新增「查看会员」标签页，点击后展示各 VIP 等级的成员数量与明细。</div>
    <div class="single-shot">
      <div class="shot-wrapper">
        <img src="${vip1}" alt="新增查看会员tab">
        <svg class="svg-overlay" viewBox="0 0 390 844">
          <rect x="120" y="58" width="160" height="32" class="annotation-box" rx="4" />
          <rect x="250" y="28" width="128" height="22" class="annotation-text-bg" />
          <text x="255" y="45" class="annotation-text">新增「查看会员」Tab</text>
          <line x1="250" y1="50" x2="210" y2="68" class="annotation-arrow" />
        </svg>
      </div>
    </div>
  </div>

  <!-- 需求二：成员数量 > 0 vs = 0 -->
  <div class="section">
    <div class="section-title">需求二：成员数量的展示与点击行为</div>
    <div class="section-desc">成员数量 > 0 时显示为蓝色且可点击，点击后弹出会员明细；成员数量 = 0 时不可点击，展示空状态。</div>
    <div class="compare-row">
      <div class="shot-wrapper">
        <span class="shot-label">数量 > 0</span>
        <img src="${vip1}" alt="VIP1 有成员">
        <svg class="svg-overlay" viewBox="0 0 390 844">
          <rect x="185" y="108" width="55" height="30" class="annotation-box" rx="4" />
          <rect x="240" y="85" width="110" height="22" class="annotation-text-bg" />
          <text x="245" y="102" class="annotation-text">蓝色可点击</text>
          <line x1="245" y1="112" x2="220" y2="120" class="annotation-arrow" />
          <rect x="15" y="270" width="360" height="240" class="annotation-box" rx="4" />
          <rect x="20" y="248" width="150" height="22" class="annotation-text-bg" />
          <text x="25" y="265" class="annotation-text">点击后展示会员列表</text>
        </svg>
      </div>
      <div class="shot-wrapper">
        <span class="shot-label">数量 = 0</span>
        <img src="${vip3}" alt="VIP3 无成员">
        <svg class="svg-overlay" viewBox="0 0 390 844">
          <rect x="262" y="108" width="30" height="30" class="annotation-box" rx="4" />
          <rect x="50" y="85" width="130" height="22" class="annotation-text-bg" />
          <text x="55" y="102" class="annotation-text">灰色不可点击</text>
          <line x1="135" y1="108" x2="250" y2="120" class="annotation-arrow" />
          <rect x="20" y="250" width="350" height="90" class="annotation-box" rx="4" />
          <rect x="60" y="225" width="175" height="22" class="annotation-text-bg" />
          <text x="65" y="242" class="annotation-text">点击无弹框，展示空状态</text>
        </svg>
      </div>
    </div>
  </div>

  <!-- 状态不残留 -->
  <div class="section">
    <div class="section-title">验证点：切换 VIP 等级后状态不残留</div>
    <div class="section-desc">从 VIP1 切换到 VIP2，列表、分页、总计均按新等级刷新，不会保留上一个等级的筛选或数据。</div>
    <div class="compare-row">
      <div class="shot-wrapper">
        <span class="shot-label">VIP1</span>
        <img src="${vip1}" alt="VIP1">
        <svg class="svg-overlay" viewBox="0 0 390 844">
          <rect x="220" y="450" width="80" height="22" class="annotation-text-bg" />
          <text x="225" y="467" class="annotation-text">总计 12</text>
          <line x1="225" y1="455" x2="210" y2="455" class="annotation-arrow" />
          <rect x="220" y="500" width="90" height="22" class="annotation-text-bg" />
          <text x="225" y="517" class="annotation-text">分页 1/3</text>
          <line x1="225" y1="505" x2="175" y2="505" class="annotation-arrow" />
        </svg>
      </div>
      <div class="shot-wrapper">
        <span class="shot-label">VIP2</span>
        <img src="${vip2}" alt="VIP2">
        <svg class="svg-overlay" viewBox="0 0 390 844">
          <rect x="220" y="330" width="70" height="22" class="annotation-text-bg" />
          <text x="225" y="347" class="annotation-text">总计 3</text>
          <line x1="225" y1="335" x2="210" y2="335" class="annotation-arrow" />
          <rect x="20" y="360" width="150" height="22" class="annotation-text-bg" />
          <text x="25" y="377" class="annotation-text">无分页（数据少）</text>
        </svg>
      </div>
    </div>
  </div>

  <!-- 搜索保留上下文 -->
  <div class="section">
    <div class="section-title">验证点：搜索保留 VIP 等级上下文</div>
    <div class="section-desc">在 VIP1 内搜索用户名，筛选框仍显示 VIP1，总计随搜索结果更新，不会跳到其他等级。</div>
    <div class="single-shot">
      <div class="shot-wrapper">
        <img src="${search}" alt="搜索保留上下文">
        <svg class="svg-overlay" viewBox="0 0 390 844">
          <rect x="15" y="165" width="190" height="32" class="annotation-box" rx="4" />
          <rect x="220" y="140" width="140" height="22" class="annotation-text-bg" />
          <text x="225" y="157" class="annotation-text">搜索框输入 alice</text>
          <line x1="225" y1="168" x2="195" y2="175" class="annotation-arrow" />
          <rect x="220" y="205" width="130" height="22" class="annotation-text-bg" />
          <text x="225" y="222" class="annotation-text">Filter 仍为 VIP1</text>
          <line x1="225" y1="215" x2="315" y2="220" class="annotation-arrow" />
          <rect x="220" y="300" width="120" height="22" class="annotation-text-bg" />
          <text x="225" y="317" class="annotation-text">搜索结果 1 条</text>
          <line x1="225" y1="305" x2="210" y2="315" class="annotation-arrow" />
        </svg>
      </div>
    </div>
  </div>
</body>
</html>`;

const outHtml = path.join(__dirname, "vip-annotated-screenshots.html");
const outPng = path.join(__dirname, "vip-annotated-screenshots.png");

await writeFile(outHtml, html, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file:///${outHtml.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const body = document.body;
  body.style.margin = "0";
  body.style.padding = "24px";
});
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();

console.log(`HTML: ${outHtml}`);
console.log(`PNG:  ${outPng}`);
