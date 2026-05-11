# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

uniCode 是一个基于 Next.js 16 App Router 的企业级文档管理系统，实现 Doc-as-Code 工作流：AI 编写文档草稿 → 人工审核 → 发布到 SQLite 数据库 → 生成只读快照。

## 架构概览

```
src/                              ← Next.js App Router 外壳（薄层）
├── app/                           ← 页面路由，仅 re-export 自 docs/app/
├── proxy.ts                       ← JWT 认证中间件

docs/                              ← 核心代码（通过 @docs 别名引用）
├── app/                           ← 实际的页面组件和服务端 actions
│   ├── [...slug]/                 ← 文档详情页（合并 drafts + production）
│   ├── drafts/                    ← 草稿管理页
│   └── api/auth/                  ← 登录认证 API（JWT via jose）
├── lib/                           ← 业务逻辑层
│   ├── index.ts                   ← getAllDocs / getDoc（文件系统 + DB 合并查询）
│   ├── actions.ts                 ← 服务端 actions：审核/驳回/发布/晋升/重新提交
│   ├── types.ts                   ← DocStatus, DocEntry, ReviewRecord 等类型
│   └── db/
│       ├── schema.ts              ← better-sqlite3 实例化，建表 + WAL 模式
│       └── docs.ts                ← DB 读写封装
├── tools/                         ← CLI 脚本（npx tsx 运行，非 Web 层）
│   ├── publish-docs.ts            ← 从 DB 导出 production/ 快照
│   ├── scan-docs.ts               ← 扫描 .md 合规性、链接完整性、过期标记
│   ├── check-code-refs.ts         ← 代码变更 → 反查文档 → 输出待更新清单
│   ├── migrate-to-db.ts           ← 文件系统文档 → 数据库迁移
│   └── seed.ts                    ← 数据库种子数据
├── drafts/                        ← AI 唯一可写的草稿目录
├── production/                    ← 只读快照（npm run publish-docs 生成）
├── data/                          ← SQLite DB、_rejected.json、_redirects.json
└── _templates/                    ← 文档模板
```

关键设计点：
- **`src/` 是薄壳**：所有页面组件、API 路由、业务逻辑都在 `docs/app/` 和 `docs/lib/` 下，`src/` 仅做 re-export。路径别名 `@docs` → `./docs/*`
- **双存储**：正式文档存 SQLite（`docs/data/docs.db`），草稿存文件系统（`docs/drafts/`）。`getAllDocs()` 合并两者，文件系统优先
- **better-sqlite3 是原生模块**，在 `next.config.ts` 中配置 `serverExternalPackages: ['better-sqlite3']`，不可被 Turbopack 打包
- **认证**：JWT（jose 库）存储在 `session` cookie，中间件 `src/proxy.ts` 拦截 `/docs` 路由

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动开发服务器 (port 4728) |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run tool` | **统一工具入口**：扫描合规 + 检查关联 + 更新 changelog + 发布 |
| `npm run tool:check` | 只读检查（合规性 + 代码关联），不写任何文件 |
| `npm run tool:scan` | 仅扫描文档合规性 |
| `npm run tool:refs` | 仅检查代码-文档关联变更 |
| `npm run tool:publish` | 仅发布 production 快照 |
| `npm run tool:changelog` | 仅更新变更日志 |
| `npm run seed -- --reset` | 完全重置文档系统（清空 DB + 重新生成种子数据 + 初始化哈希快照） |
| `npm run migrate-db` | 文件系统文档迁移入 SQLite |

## 文档审核状态机

```
draft ──→ reviewed ──→ published
  │          │
  └──→ rejected ←── (从 reviewed 也可驳回)
                └──→ draft (作者修改后重新提交)
```

`approveDoc` 含自动晋升逻辑：如果 draft 文档设置了 `target_path`，通过审核时自动写入数据库，删除原文件，并扫描项目中所有 `.md/.ts/.tsx/.json/.css` 文件更新引用路径。

## Doc-as-Code 约束（最高优先级）

- **AI 只能写入 `docs/drafts/`**。正式文档存储在 SQLite 中，AI 无法直接修改
- **`docs/production/` 是只读快照**，绝对禁止修改
- AI 不得调用 `approveDoc`、`rejectDoc`、`publishDoc`、`unpublishDoc`、`promoteDoc`、`resubmitDoc`——这些仅由人类通过前端 `/docs` 界面操作
- AI 生成的文档必须在 Front Matter 中设置：`author: ai-generated`、`status: draft`、`target_path` 为目标位置
- 文档通过末尾的 **Foot Matter**（`---` 分隔的 YAML 块）声明关联信息：`code_refs` 列出覆盖的代码文件，`doc_refs` 列出关联文档。代码变更后运行 `npm run tool:refs` 反查需要更新的文档
- 变更日志（`project-management/changelog`）由脚本从 `git log` 自动生成，直接入库发布，无需人工审核

## 其他行为约束

- 禁止修改 `.claude/`、`.trae/`、`.qoder/` 等工具内部文件，除非用户明确指令
- 注释使用简体中文
- 严禁硬编码任何路径、URL、环境信息或配置值
- 任何环节不允许出现警告或错误，一旦出现必须定位根源并修正，不得绕过或掩盖

## 技术栈注意事项

- **Next.js 16.2**：此版本有大量 breaking changes，编写 App Router 代码前参考 `node_modules/next/dist/docs/`（见 `AGENTS.md`）
- **Tailwind CSS v4**：使用 `@tailwindcss/postcss` 插件，CSS 配置文件在 `src/app/globals.css`
- TypeScript strict 模式，路径别名 `@/*` → `src/*`，`@docs/*` → `docs/*`
