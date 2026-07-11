import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

const base = path.join(workspaceRoot, ".scratch", "multica-runs");
const shots = {
  listFull: path.join(base, "vip-member-count-regression-20260709", "evidence", "regression-01-list-before-click-full.png"),
  zeroBefore: path.join(base, "vip-member-count-regression-20260709", "evidence", "regression-02-vip10-zero-visible-before-click.png"),
  zeroAfter: path.join(base, "vip-member-count-regression-20260709", "evidence", "regression-03-vip10-zero-after-click.png"),
  modalVip1: path.join(base, "vip-member-count-squad-check", "evidence", "execution-02-vip-list.png"),
  modalVip0: path.join(base, "vip-member-count-squad-check", "evidence", "execution-03b-click-vip1-458-modal.png")
};

async function toBase64(filePath) {
  const buf = await readFile(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

const [listFull, zeroBefore, zeroAfter, modalVip1, modalVip0] = await Promise.all([
  toBase64(shots.listFull),
  toBase64(shots.zeroBefore),
  toBase64(shots.zeroAfter),
  toBase64(shots.modalVip1),
  toBase64(shots.modalVip0)
]);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>VIP管理需求测试截图（真实UAT）</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      background: #1a1a2e;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      min-width: 1800px;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .header h1 {
      margin: 0 0 8px;
      font-size: 30px;
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
      padding: 24px;
      margin-bottom: 28px;
      border: 1px solid #2a2a4a;
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #ffd700;
    }
    .section-desc {
      font-size: 14px;
      color: #bbb;
      margin-bottom: 20px;
    }
    .compare-row {
      display: flex;
      gap: 28px;
      justify-content: center;
      align-items: flex-start;
    }
    .shot-wrapper {
      position: relative;
      display: inline-block;
      border-radius: 8px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6);
      line-height: 0;
    }
    .shot-wrapper img {
      display: block;
      height: auto;
    }
    .shot-label {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255, 77, 79, 0.92);
      color: #fff;
      padding: 5px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 700;
      z-index: 10;
      line-height: 1.2;
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
      font-size: 20px;
      font-weight: 800;
      text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 5px #000;
    }
    .annotation-text-bg {
      fill: rgba(0,0,0,0.6);
      rx: 5;
      ry: 5;
    }
    .annotation-box {
      fill: none;
      stroke: #ff4d4f;
      stroke-width: 3;
      stroke-dasharray: 8 4;
    }
    .annotation-arrow {
      fill: none;
      stroke: #ff4d4f;
      stroke-width: 3;
      marker-end: url(#arrowhead);
    }
    .annotation-line {
      fill: none;
      stroke: #ff4d4f;
      stroke-width: 3;
    }
    .single-shot {
      display: flex;
      justify-content: center;
    }
  </style>
</head>
<body>
  <svg width="0" height="0" style="position:absolute;">
    <defs>
      <marker id="arrowhead" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto">
        <polygon points="0 0, 12 4, 0 8" fill="#ff4d4f" />
      </marker>
    </defs>
  </svg>

  <div class="header">
    <h1>VIP管理需求测试截图</h1>
    <p>巴西站 UAT http://site.bx-tytest.xyz | 福利中心 / VIP管理 / 查看会员 | 账号 t0lle01 | 2026-07-08</p>
  </div>

  <!-- 需求一：新增查看会员tab -->
  <div class="section">
    <div class="section-title">需求一：VIP管理新增「查看会员」标签页</div>
    <div class="section-desc">在 VIP管理页面新增第三个标签页「查看会员」，点击后展示各 VIP 等级的成员数量。</div>
    <div class="single-shot">
      <div class="shot-wrapper">
        <img src="${listFull}" alt="新增查看会员标签页" style="width:1100px;">
        <svg class="svg-overlay" viewBox="0 0 2560 1235" preserveAspectRatio="xMidYMid meet">
          <rect x="330" y="90" width="130" height="42" class="annotation-box" rx="4" />
          <rect x="490" y="55" width="180" height="32" class="annotation-text-bg" />
          <text x="500" y="78" class="annotation-text">新增「查看会员」Tab</text>
          <line x1="480" y1="82" x2="420" y2="105" class="annotation-arrow" />
        </svg>
      </div>
    </div>
  </div>

  <!-- 需求二：成员数量>0 可点击 -->
  <div class="section">
    <div class="section-title">需求二：成员数量 &gt; 0 时蓝色可点击，点击后弹出「成员明细」弹窗</div>
    <div class="section-desc">VIP等级 1 的成员数量为 464，数字显示为蓝色链接；点击后弹出成员明细弹窗，弹窗内 VIP等级 自动带入 VIP1。</div>
    <div class="compare-row">
      <div class="shot-wrapper">
        <span class="shot-label">点击前：列表</span>
        <img src="${listFull}" alt="VIP1列表" style="width:950px;">
        <svg class="svg-overlay" viewBox="0 0 2560 1235" preserveAspectRatio="xMidYMid meet">
          <rect x="560" y="300" width="110" height="38" class="annotation-box" rx="4" />
          <rect x="700" y="270" width="150" height="32" class="annotation-text-bg" />
          <text x="710" y="293" class="annotation-text">数量 464，蓝色</text>
          <line x1="700" y1="300" x2="640" y2="318" class="annotation-arrow" />
        </svg>
      </div>
      <div class="shot-wrapper">
        <span class="shot-label">点击后：弹窗</span>
        <img src="${modalVip1}" alt="VIP1弹窗" style="width:750px;">
        <svg class="svg-overlay" viewBox="0 0 1170 584" preserveAspectRatio="xMidYMid meet">
          <rect x="560" y="130" width="100" height="40" class="annotation-box" rx="4" />
          <rect x="680" y="100" width="150" height="32" class="annotation-text-bg" />
          <text x="690" y="123" class="annotation-text">弹窗带入 VIP1</text>
          <line x1="680" y1="130" x2="630" y2="148" class="annotation-arrow" />
          <rect x="120" y="250" width="920" height="180" class="annotation-box" rx="4" />
          <rect x="130" y="215" width="170" height="32" class="annotation-text-bg" />
          <text x="140" y="238" class="annotation-text">展示会员明细</text>
        </svg>
      </div>
    </div>
  </div>

  <!-- 需求二：成员数量=0 不可点击 -->
  <div class="section">
    <div class="section-title">需求二：成员数量 = 0 时不应可点击，点击后不应弹窗</div>
    <div class="section-desc">VIP等级 10 的成员数量为 0，数字不是蓝色链接；点击后页面保持原样，没有成员明细弹窗出现。</div>
    <div class="compare-row">
      <div class="shot-wrapper">
        <span class="shot-label">点击前</span>
        <img src="${zeroBefore}" alt="VIP10点击前" style="width:950px;">
        <svg class="svg-overlay" viewBox="0 0 2560 1235" preserveAspectRatio="xMidYMid meet">
          <rect x="585" y="650" width="55" height="32" class="annotation-box" rx="4" />
          <rect x="660" y="620" width="140" height="32" class="annotation-text-bg" />
          <text x="670" y="643" class="annotation-text">数量 0，灰色</text>
          <line x1="660" y1="650" x2="620" y2="665" class="annotation-arrow" />
        </svg>
      </div>
      <div class="shot-wrapper">
        <span class="shot-label">点击后</span>
        <img src="${zeroAfter}" alt="VIP10点击后" style="width:950px;">
        <svg class="svg-overlay" viewBox="0 0 2560 1235" preserveAspectRatio="xMidYMid meet">
          <rect x="585" y="650" width="55" height="32" class="annotation-box" rx="4" />
          <rect x="660" y="620" width="190" height="32" class="annotation-text-bg" />
          <text x="670" y="643" class="annotation-text">无弹窗，页面未变</text>
          <line x1="660" y1="650" x2="620" y2="665" class="annotation-arrow" />
        </svg>
      </div>
    </div>
  </div>

  <!-- 验证点：弹窗等级与列表一致 -->
  <div class="section">
    <div class="section-title">验证点：弹窗内 VIP 等级与列表选择一致</div>
    <div class="section-desc">列表点击 VIP等级 0 后，成员明细弹窗的 VIP等级 下拉框自动显示 VIP0，与列表选择保持一致。</div>
    <div class="single-shot">
      <div class="shot-wrapper">
        <img src="${modalVip0}" alt="VIP0弹窗" style="width:900px;">
        <svg class="svg-overlay" viewBox="0 0 1170 584" preserveAspectRatio="xMidYMid meet">
          <rect x="560" y="130" width="100" height="40" class="annotation-box" rx="4" />
          <rect x="680" y="100" width="160" height="32" class="annotation-text-bg" />
          <text x="690" y="123" class="annotation-text">弹窗带入 VIP0</text>
          <line x1="680" y1="130" x2="630" y2="148" class="annotation-arrow" />
        </svg>
      </div>
    </div>
  </div>
</body>
</html>`;

const outHtml = path.join(__dirname, "vip-annotated-screenshots-real.html");
const outPng = path.join(__dirname, "vip-annotated-screenshots-real.png");

await writeFile(outHtml, html, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });
await page.goto(`file:///${outHtml.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });

const bodyBox = await page.evaluate(() => {
  const body = document.body;
  return { width: body.scrollWidth, height: body.scrollHeight };
});

await page.setViewportSize({ width: bodyBox.width, height: bodyBox.height });
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();

console.log(`HTML: ${outHtml}`);
console.log(`PNG:  ${outPng}`);
