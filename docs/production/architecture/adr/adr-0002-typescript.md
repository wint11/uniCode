---
author: ai-generated
reviewer: reviewer
status: published
last_reviewed: 2026-05-10
review_date: 2026-05-10
review_comment: 
review_history: [{"date":"2026-05-10","reviewer":"reviewer","action":"published","comment":""}]
---
# ADR-0002: 使用 TypeScript 作为主语言

## 状态

已采纳

## 背景

需要为全栈项目选择统一的编程语言。

## 决策

使用 TypeScript 作为全栈主语言。理由：

1. 编译器级别的类型检查在编译时捕获大量错误
2. 与 Next.js 深度集成，无需额外配置
3. 数据库类型可通过 ORM（Prisma/Drizzle）自动生成，与代码端到端类型安全

## 备选方案

- **纯 JavaScript**: 缺乏类型安全，不利于大规模团队协作
- **Python FastAPI + React**: 前后端语言不统一，类型无法共享

## 影响

- 需要团队掌握 TypeScript 基础
- 某些第三方库缺少类型定义时需额外编写 `.d.ts`