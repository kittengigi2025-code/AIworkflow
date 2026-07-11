# gaming-qa-ledger

Use this skill for gaming/betting H5 and admin QA work when the team has no formal test management system.

Default outputs must be HTML files, not Markdown.

Workflow:
0. Resource Manager verifies the resource card before testing: H5 URL, admin URL, requirement link, menu path, route, site, merchant, account identifier, report directory, evidence directory, and sensitive-operation boundaries.
1. Extract the requirement from screenshots, links, chat records, product notes, and existing QA context.
2. Stop before execution if the requirement has test-blocking ambiguity. Output concise product questions only.
3. After clarification, produce a compact test scope: requirement points, click path, test data, seams, risks, and minimum test loop.
4. Execute browser checks only for non-sensitive normal page content. Do not handle passwords, OTP, CAPTCHA, payment actions, withdrawals, destructive changes, or irreversible admin operations.
5. Record evidence with screenshots when a defect is found.
6. Produce a developer-facing bug ticket HTML with actual result, expected result, reproduction path, evidence, severity suggestion, and residual uncertainty.
7. Update the local QA ledger index so every tested requirement can be reviewed quickly later.

Gaming QA focus:
- H5 and admin mapping
- member, merchant, agent, game, wallet, recharge, withdrawal, promotion, reward, audit, level, channel, and report concepts
- activity list, activity configuration, H5 display, reward records, participation limits, audit rules
- VIP management and member count consistency

Known BX/7788 UAT resources:
- H5 frontend: https://99.bx-1234.xyz/#/dashboard/game
- Admin backend: http://site.bx-tytest.xyz
- Admin path for the current VIP member-count requirement: 福利中心 / VIP管理 / 查看会员
- Admin route observed for the VIP member-count requirement: #/member/level
- Known UAT site: 巴西站-测试
- Known merchant: 888
- Requirement document: https://z91jq0.axshare.com
- Local resource inventory: .scratch/test-resources.html
- Local QA index: .scratch/qa-index.html
- Do not store passwords, OTP, CAPTCHA answers, or other secrets in reports.

QA squad resource role:
- Agent name: QA资源管理员
- Squad role: 资源管理
- Owns .scratch/test-resources.html and resource-card completeness.
- Checks whether URLs, paths, requirement links, report folders, evidence folders, and environment notes are missing or stale before testing starts.
- Does not decide business pass/fail, does not write bugs, and does not perform browser execution.

Quality rules:
- Prefer clear product questions over guessing.
- Do not mark pass/fail when the rule is unclear.
- Separate confirmed bugs from residual risks.
- Keep reports useful to product, test, and development readers.
- Avoid low-value repeated visual checks unless they protect a real business rule.
