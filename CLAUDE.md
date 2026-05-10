# 项目上下文索引

你是本项目的 AI 助手。在执行任何任务前，请先充分理解项目全貌。

## 文档目录结构

```
docs/
├── _templates/          ← 文档写作模板（human + AI 共用）
├── data/                ← 运行时数据
│   ├── docs.db          ← SQLite 数据库（正式文档存储）
│   ├── _rejected.json   ← 驳回追踪
│   ├── _redirects.json  ← 晋升重定向表
│   └── code-hashes.json ← 代码-文档哈希关联（自动生成）
├── drafts/              ← AI 草稿区（AI 唯一可写的文档目录）
│   ├── index.md
│   ├── getting-started/
│   ├── guides/
│   ├── architecture/
│   └── ...
└── production/          ← 只读快照（npm run publish-docs 生成）
    ├── index.md
    └── ...
```

## 必读文档

- **开发规范总纲**: `docs/production/guides/development/development-standards.md`
- **编码规范**: `docs/production/guides/development/code-style.md`
- **安全策略**: `docs/production/guides/development/security.md`
- **API 文档**: `docs/production/apis/index.md`
- **架构决策记录**: `docs/drafts/architecture/adr/`
- **Next.js 版本提示**: `AGENTS.md`

## 行为约束

### Doc-as-Code（最高优先级）

- **正式文档存储在 SQLite 数据库（`docs/data/docs.db`）中，AI 无法直接修改。**
- AI 只能写入 `docs/drafts/` 草稿区。文档通过人工审核后，经由 `promoteDoc` 存入数据库。
- **`docs/production/` 是数据库的只读快照**，由 `npm run publish-docs` 自动生成。AI 绝对禁止修改此目录。
- 对正式文档的审核操作（通过/驳回/发布/退回/晋升）只能由人类通过前端 `/docs` 界面完成。
- AI 不得调用 `approveDoc`、`rejectDoc`、`publishDoc`、`unpublishDoc`、`promoteDoc`、`resubmitDoc`。
- 每个 AI 生成的文档必须在 Front Matter 中设置 `author: ai-generated`、`status: draft`、`target_path` 为目标位置。

### 代码-文档关联

每个文档可以在 Front Matter 中声明 `code_refs` 字段，列出其覆盖的代码文件：

```yaml
code_refs:
  - src/lib/docs/actions.ts
  - tools/scan-docs.ts
```

代码变更后运行 `npm run check-code-refs` 会：
1. 计算所有关联代码文件的 SHA-256 哈希
2. 与上次快照对比，找出变更文件
3. 反查文档，列出需要更新的文档清单

### 其他约束

- 禁止修改 `.claude/`、`.trae/`、`.qoder/` 等工具内部文件，除非用户明确指令。
- 注释必须使用简体中文。
- 严禁硬编码任何路径、URL、环境信息或配置值。
- 任何环节不允许出现警告或错误，一旦出现必须定位根源并修正，不得绕过或掩盖。

## 文档审核状态机

```
draft ──→ reviewed ──→ published
  │          │
  └──→ rejected ←── (从 reviewed 也可驳回)
                └──→ draft (作者修改后重新提交)
```

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动开发服务器 (port 4728) |
| `npm run build` | 生产构建 |
| `npm run scan-docs -- --refs` | 扫描文档合规性与引用完整性 |
| `npm run publish-docs` | 从数据库生成 production/ 快照 |
| `npm run migrate-db` | 将正式文档从文件系统迁移入数据库 |
| `npm run check-code-refs` | 检测代码变更，反查需更新的文档 |
