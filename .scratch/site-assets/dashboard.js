const statusLabels = {
  passed: "通过",
  "has-bug": "有缺陷",
  "waiting-regression": "待回归",
  blocked: "阻塞",
  testing: "测试中",
};

let dashboardData = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusClass(status) {
  if (status === "passed") return "passed";
  if (status === "has-bug") return "bug";
  if (status === "waiting-regression" || status === "blocked") return "blocked";
  return "testing";
}

function issueStatusClass(status) {
  if (status === "regression-passed" || status === "accepted-non-bug" || status === "not-reproduced") {
    return "passed";
  }
  if (status === "active" || status === "reopened") return "bug";
  if (status === "waiting-regression" || status === "needs-evidence") return "blocked";
  return "testing";
}

function renderStats(requirements, packages) {
  const total = requirements.length;
  const passed = requirements.filter(item => item.status === "passed").length;
  const hasBug = requirements.filter(item => item.status === "has-bug").length;
  const waitingRegression = requirements.filter(item => item.status === "waiting-regression").length;
  const issues = dashboardData?.issues ?? [];
  const activeIssues = issues.filter(item => item.status === "active" || item.status === "reopened").length;
  const closedIssues = issues.filter(item => item.status !== "active" && item.status !== "reopened").length;
  const stats = [
    [total, "需求总数"],
    [passed, "已通过"],
    [issues.length, "历史问题记录"],
    [activeIssues || hasBug, "当前有效 Bug"],
    [waitingRegression, "待回归"],
    [closedIssues, "已关闭/接受/误报"],
  ];

  document.getElementById("stats").innerHTML = stats
    .map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`)
    .join("");
}

function renderIssues(items) {
  document.getElementById("issueRows").innerHTML = items.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.id)}</strong></td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.severity)}</td>
      <td><span class="tag ${issueStatusClass(item.status)}">${escapeHtml(item.statusText)}</span></td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${escapeHtml(item.summary)}</td>
      <td>
        <div class="actions">
          ${(item.links ?? []).map(link => `<a class="btn" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join("")}
        </div>
      </td>
    </tr>
  `).join("");
}

function renderModules(requirements) {
  const select = document.getElementById("moduleFilter");
  const currentValue = select.value;
  select.innerHTML = '<option value="all">全部模块</option>';

  [...new Set(requirements.map(item => item.module))].forEach(module => {
    const option = document.createElement("option");
    option.value = module;
    option.textContent = module;
    select.appendChild(option);
  });

  if ([...select.options].some(option => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function renderRows() {
  const requirements = dashboardData.requirements;
  const search = document.getElementById("search").value.trim().toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const module = document.getElementById("moduleFilter").value;
  const rows = requirements.filter(item => {
    const haystack = [
      item.title,
      item.module,
      item.statusText,
      item.issues,
      item.verification,
      item.summary,
      item.tags.join(" "),
    ].join(" ").toLowerCase();

    return (status === "all" || item.status === status) &&
      (module === "all" || item.module === module) &&
      (!search || haystack.includes(search));
  });

  document.getElementById("requirementRows").innerHTML = rows.map(item => `
    <tr>
      <td>${escapeHtml(item.date)}</td>
      <td>
        <strong>${escapeHtml(item.title)}</strong>
        <div class="muted">${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join(" ")}</div>
      </td>
      <td>${escapeHtml(item.module)}</td>
      <td><span class="tag ${statusClass(item.status)}">${escapeHtml(item.statusText || statusLabels[item.status] || item.status)}</span></td>
      <td>${escapeHtml(item.issues)}</td>
      <td>${escapeHtml(item.verification)}</td>
      <td>${escapeHtml(item.summary)}</td>
      <td>
        <div class="actions">
          ${item.links.map(link => `<a class="btn ${link.download ? "download" : ""}" href="${escapeHtml(link.href)}" ${link.download ? "download" : ""}>${escapeHtml(link.label)}</a>`).join("")}
        </div>
      </td>
    </tr>
  `).join("");
}

function renderAttention(items) {
  document.getElementById("attentionRows").innerHTML = items.map(item => `
    <tr>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.content)}</td>
      <td><a href="${escapeHtml(item.href)}">查看</a></td>
    </tr>
  `).join("");
}

function renderPackages(items) {
  document.getElementById("packageRows").innerHTML = items.map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.purpose)}</td>
      <td><a class="btn download" href="${escapeHtml(item.href)}" download>下载</a></td>
    </tr>
  `).join("");
}

function renderMulticaWorkflow(workflow) {
  if (!workflow) return;

  document.getElementById("multicaTitle").textContent = workflow.title;
  document.getElementById("multicaSummary").textContent = workflow.summary;
  document.getElementById("multicaRunbook").href = workflow.runbookHref;
  document.getElementById("multicaWorkflowRows").innerHTML = (workflow.stages ?? []).map((stage, index) => `
    <tr>
      <td>
        <span class="step-number">${index + 1}</span>
        <strong>${escapeHtml(stage.name)}</strong>
      </td>
      <td>${escapeHtml(stage.owner)}</td>
      <td>${escapeHtml(stage.output)}</td>
      <td>${escapeHtml(stage.gate)}</td>
    </tr>
  `).join("");
}

function renderRules(items) {
  document.getElementById("ruleRows").innerHTML = items.map(item => `
    <tr>
      <th>${escapeHtml(item.name)}</th>
      <td>${escapeHtml(item.description)}</td>
    </tr>
  `).join("");
}

function bindFilters() {
  document.getElementById("search").addEventListener("input", renderRows);
  document.getElementById("statusFilter").addEventListener("change", renderRows);
  document.getElementById("moduleFilter").addEventListener("change", renderRows);
}

function renderDashboard(data) {
  dashboardData = data;
  document.getElementById("pageTitle").textContent = data.meta.title;
  document.getElementById("pageSubtitle").textContent = `${data.meta.subtitle} 最后更新：${data.meta.lastUpdated}。`;
  renderStats(data.requirements, data.packages);
  renderModules(data.requirements);
  renderRows();
  renderIssues(data.issues ?? []);
  renderMulticaWorkflow(data.multicaWorkflow);
  renderAttention(data.attention);
  renderPackages(data.packages);
  renderRules(data.rules);
  bindFilters();
}

async function loadDashboard() {
  try {
    const response = await fetch("data/qa-dashboard.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`读取 data/qa-dashboard.json 失败：${response.status}`);
    }
    renderDashboard(await response.json());
  } catch (error) {
    document.getElementById("loadError").hidden = false;
    document.getElementById("loadError").textContent = `${error.message}。请通过本地服务打开 Dashboard，例如 http://127.0.0.1:8768/qa-dashboard-current.html。`;
  }
}

loadDashboard();
