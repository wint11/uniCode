---
author: ai-generated
reviewer: reviewer
status: published
last_reviewed: 2026-05-10
review_date: 2026-05-10
review_comment: 
review_history: [{"date":"2026-05-10","reviewer":"reviewer","action":"published","comment":""}]
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

## 项目结构概览

```
uniCode
├── CLAUDE.md              # AI Agent 调度入口
├── AGENTS.md              # Next.js 官方 Agent 规则
├── docs/                  # 项目知识库（人类 + AI 共享）
│   ├── index.md           # 全局导航
│   ├── _templates/        # 文档模板
│   ├── architecture/      # 架构设计
│   ├── guides/            # 开发/测试/运维指南
│   └── ...
├── src/
│   └── app/               # Next.js App Router 页面
├── public/                # 静态资源
└── tools/                 # 辅助脚本工具
```

## 下一步

- 阅读 [编码规范](./guides-development-code-style.md)
- 阅读 [Git 提交规范](./guides-development-commit-convention.md)
- 阅读 [安全策略](./guides-development-security.md)