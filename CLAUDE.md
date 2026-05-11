# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Next.js 16 App Router 项目，附带一个 Doc-as-Code 文档管理模块（`docs/` 目录），用于 AI 编写文档草稿 → 人工审核 → 发布到 SQLite 数据库。

## 开始任何工作前

**先读规则**：本项目的开发规范在 `docs/production/guides/development/development-standards.md`。注释用简体中文，严禁硬编码，零警告原则。
其它项目相关**正式**文件均位于 `docs/production` 目录下，请按需参考。

## 文档模板

格式模板见 `docs/production/_templates/doc-template.md`

- **Front Matter**（文件顶部 `---` 块）：元信息，`author: ai-generated`、`status: draft`、`target_path` 必填
- **Foot Matter**（文件末尾 `---` 块）：`code_refs` 列出文档覆盖的代码文件，`doc_refs` 列出关联文档 slug。代码变更后 `npm run tool` 会通过哈希对比反查哪些文档需要更新
- AI 生成的内容放在 `docs/drafts/`，文件名用平级的 kebab-case（如 `guides-development-code-style.md`）

## AI 约束

- **文档只能写入 `docs/drafts`**，通过人类审查之后，发布到 `docs/production`，不可直接写入 `docs/production`。
- `docs/production` 只读，禁止修改
- 不得调用文档审批系统API例如： `approveDoc`、`rejectDoc`、`publishDoc`、`unpublishDoc`、`promoteDoc`、`resubmitDoc`，这些由人类通过前端 `/docs` 界面操作
- 禁止修改 `.claude/`、`.trae/`、`.qoder/` 等工具内部文件

## 代码写完后检查

```bash
npm run tool         # 完整流程：合规扫描 + 关联检查 + 更新 changelog + 发布 production 快照
npm run lint         # ESLint 检查
```

## 开发命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发服务器 (port 4728) |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint |
| `npm run tool` | 扫描 + 关联检查 + changelog + 发布 |
| `npm run seed -- --reset` | 重置文档系统 |
