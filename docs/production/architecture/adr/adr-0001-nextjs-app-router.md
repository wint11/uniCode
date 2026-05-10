---
author: ai-generated
reviewer: reviewer
status: published
last_reviewed: 2026-05-10
review_date: 2026-05-10
review_comment: 
review_history: [{"date":"2026-05-10","reviewer":"reviewer","action":"published","comment":""}]
---
# ADR-0001: 采用 Next.js App Router 作为核心框架

## 状态

已采纳

## 背景

项目需要在同一个仓库中支持网页端、移动端和桌面端。需要选择一个能够同时提供前端渲染和内部服务端逻辑的框架。

## 决策

采用 Next.js 16 App Router 作为核心框架。理由：

1. App Router 提供 React Server Components（RSC），天然支持服务端数据获取与流式渲染
2. Server Actions 使前后端通信获得端到端类型安全
3. Route Handlers 可作为标准 REST 接口对外暴露
4. 单仓库即可覆盖 Web + 内部服务端的全栈需求

## 备选方案

- **Next.js Pages Router**: API 路由更传统，但缺乏 RSC 的流式渲染能力和 Server Actions 的强类型支持
- **Astro + Express**: 前后端分离增加通信成本和类型同步维护负担
- **Nuxt 3**: 生态偏 Vue，与团队 React 技术栈不匹配

## 影响

### 正面
- 单一部署单元（Web + API），降低运维复杂度
- RSC 减少客户端 JavaScript 体积
- Server Actions 消除传统 REST 样板代码

### 负面
- 需学习 Server Components 的"客户端/服务端"心智模型
- 部分第三方 React 库可能不兼容 RSC