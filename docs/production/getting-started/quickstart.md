---
author: ai-generated
reviewer: admin
status: published
last_reviewed: 2026-05-11
review_date: 2026-05-11
review_comment: 
review_history: [{"date":"2026-05-11","reviewer":"admin","action":"published","comment":""}]
---
# 快速开始

## 前置条件

- Node.js >= 20
- npm >= 10

## 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
# 访问 http://localhost:4728

# 生产构建
npm run build

# 启动生产服务器
npm run start
```

## 项目结构

```
uniCode
├── CLAUDE.md              # AI Agent 调度入口
├── AGENTS.md              # Next.js Agent 规则
├── docs/                  # 项目知识库
│   ├── drafts/            # AI 草稿区
│   ├── production/        # 发布快照（只读）
│   ├── tools/             # 辅助脚本
│   └── lib/               # 业务逻辑
└── src/                   # Next.js App Router
    ├── app/               # 页面路由
    └── proxy.ts           # JWT 认证中间件
```

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动开发服务器 (port 4728) |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run seed -- --reset` | 重置文档系统 |
| `npm run scan-docs` | 扫描文档合规性 |
| `npm run check-code-refs` | 检测代码-文档关联变更 |

## 下一步

- 阅读 [开发规范](./guides-development-development-standards.md)（必读）
- 阅读 [编码规范](./guides-development-code-style.md)
- 阅读 [安全策略](./guides-development-security.md)
---
code_refs:
  - package.json
  - next.config.ts

doc_refs:
  - guides/development/development-standards
  - guides/development/code-style
  - guides/development/security
---
