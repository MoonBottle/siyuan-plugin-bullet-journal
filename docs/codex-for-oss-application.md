# OpenAI Codex for Open Source 申请填写指南

> 申请地址：https://openai.com/form/codex-for-oss/
> 项目仓库：https://github.com/MoonBottle/siyuan-plugin-bullet-journal

---

## 表单字段与建议填写内容

### 1. First Name / 姓氏

填写你的姓氏（中文拼音），例如：`Zhang`

### 2. Last Name / 名字

填写你的名字（中文拼音），例如：`San`

### 3. Email Address / 电子邮箱

**必须填写与你的 ChatGPT 账户关联的邮箱地址。**

### 4. GitHub Profile / GitHub 用户名

填写你的 GitHub 用户名，确保个人资料可见性设置为**公开**。

例如：`MoonBottle`

### 5. GitHub Repository URL / GitHub 代码仓库 URL

```
https://github.com/MoonBottle/siyuan-plugin-bullet-journal
```

确保仓库可见性为**公开**。

### 6. Role / 角色

选择：**Primary maintainer（主要维护者）**

> 理由：你是该项目的唯一/主要维护者，负责所有核心开发、PR 审查、Issue 分类和版本发布。选择 Primary maintainer 更有说服力。

### 7. Qualifications / 为什么这个代码仓库符合要求？（最多 500 字符）

这是最关键的字段，需要展示项目的**使用量、采用度或生态重要性**。建议英文填写：

```
Task Assistant is the leading task management plugin for SiYuan Note (22K+ GitHub stars). It provides Calendar, Gantt, Todo, Pomodoro, and AI Chat views — transforming notes into actionable tasks via non-invasive markers. 573+ commits, 40 releases in 3 months. Published on SiYuan Marketplace with active users. Built with Vue 3 + TypeScript + Pinia. Includes a standalone MCP server for AI integration. AGPL-3.0 licensed. Fills a critical gap in the SiYuan ecosystem where no comparable task management solution exists.
```

> **填写策略：**
> - 开头点明与 SiYuan（22K+ stars 大项目）的关系，借势提升项目分量
> - 列出具体数据：573+ commits、40 releases、3 个月内的活跃度
> - 强调功能丰富度（Calendar、Gantt、Todo、Pomodoro、AI Chat）
> - 提及 MCP server，展示 AI 集成能力（与 Codex 生态契合）
> - 强调生态位：SiYuan 生态中无可替代的任务管理方案
> - 提及开源许可证 AGPL-3.0

### 8. Interest / 我感兴趣的是（多选）

**建议全选：**

- [x] **Codex Security** — 用于代码安全扫描，检测漏洞
- [x] **Project's API credits** — 用于编码、维护自动化、发布工作流

> 全选表明你对 Codex 的全部能力都有需求，展示出更深入的参与意愿。

### 9. Justification / 你将如何针对自己的项目使用 API 额度？（最多 500 字符）

需要具体说明 API 额度的使用场景，展示与维护者工作流的紧密结合：

```
1) Automated PR review: Use Codex to review community PRs for code quality, type safety, and adherence to project conventions (AGENTS.md rules, ESLint config). 2) Issue triage & reproduction: Codex analyzes bug reports, reproduces issues in sandbox, and proposes fixes. 3) Feature implementation: Generate boilerplate for new views/features (e.g., recurring tasks, mobile adaptations) while I focus on architecture decisions. 4) Test generation: Expand vitest coverage for the parser module (core.ts, lineParser.ts). 5) Security scanning: Use Codex Security to audit the MCP server and API integration layer for vulnerabilities.
```

> **填写策略：**
> - 列出 5 个具体场景，覆盖 Codex 的核心能力
> - PR review 和 Issue triage 是 OpenAI 最看重的维护者痛点
> - 提及项目特有的模块名（parser、core.ts、lineParser.ts）增加可信度
> - Security scanning 与 Codex Security 选项呼应
> - 强调"我专注架构决策，Codex 处理重复性工作"的协作模式

### 10. What is your org ID? / 你的组织 ID 是什么？（可选）

如果项目属于某个 GitHub Organization，填写 Org ID。如果是个人项目，可以留空或填写你的 GitHub 用户名。

建议：留空或填写 `MoonBottle`

### 11. Product Usage / 产品使用情况（可选，最多 500 字符）

展示你已经在使用 OpenAI 产品，增加获批概率：

```
I actively use ChatGPT Plus for daily development: code review, debugging complex TypeScript/Vue issues, generating test cases, and writing documentation. I've integrated OpenAI-compatible APIs into the plugin's AI Chat feature (src/services/aiService.ts) and built a ReAct Agent (src/agents/) for intelligent task querying. The MCP server (src/mcp/) uses @modelcontextprotocol/sdk. Codex would directly enhance my existing AI-assisted workflow.
```

> **填写策略：**
> - 证明你已是 OpenAI 生态的活跃用户
> - 提及项目已集成了 OpenAI 兼容 API（AI Chat 功能）
> - 提及 ReAct Agent 和 MCP server，展示技术深度
> - 最后一句点明 Codex 是现有工作流的自然延伸

### 12. Is there anything else you would like us to know? / 还有其他需要说明的事项吗？（可选，最多 500 字符）

补充项目的独特价值和维护者承诺：

```
As the sole maintainer, I handle all PR reviews, issue triage, releases, and feature development. The project has maintained weekly releases since Feb 2026. SiYuan's plugin ecosystem relies on community contributors like me to extend its capabilities. Codex access would significantly amplify my capacity to maintain quality while accelerating feature delivery for thousands of SiYuan users who depend on this plugin for daily task management.
```

> **填写策略：**
> - 强调 sole maintainer 身份，说明资源最紧缺、最需要帮助
> - 周更频率展示持续投入
> - "thousands of SiYuan users" 强调用户规模
> - 将 Codex 定位为"放大器"而非"替代品"

---

## 申请通过的关键策略总结

1. **借势生态**：SiYuan 有 22K+ stars，你的插件是其生态的关键组成部分，这是最大的加分项
2. **数据说话**：573 commits、40 releases、3 个月 — 展示极高的维护活跃度
3. **Sole maintainer**：单人维护大型项目是最符合 Codex for OSS 帮助目标的场景
4. **AI 契合度**：项目已集成 AI 功能（AI Chat、ReAct Agent、MCP Server），与 Codex 天然契合
5. **具体场景**：每个字段都给出具体的使用场景，而非泛泛而谈
6. **英文填写**：虽然表单支持中文，但英文填写更专业，审核人员阅读更顺畅
7. **全选 Interest**：展示对 Codex 全部能力的兴趣和需求

---

## 注意事项

- 确保 GitHub 个人资料设为**公开**
- 确保仓库设为**公开**
- 邮箱必须与 ChatGPT 账户关联
- 申请提交后通常数天到数周内收到回复
- 没有硬性的 star 数或下载量门槛，重点是展示项目的重要性和维护需求
- 即使项目规模不大，只要在生态中有独特价值，OpenAI 也鼓励申请
