---
author: ai-generated
reviewer: reviewer
status: published
last_reviewed: 2026-05-10
review_date: 2026-05-10
review_comment: 
review_history: [{"date":"2026-05-10","reviewer":"reviewer","action":"published","comment":""}]
---
# API 文档

## 双轨制接口设计

| 轨道 | 目标消费者 | 协议 | 类型安全 |
|------|-----------|------|----------|
| **Server Actions** | 网页内部组件 | `"use server"` 函数直接调用 | 端到端类型推断 |
| **REST API** | 移动端、桌面端、第三方 | HTTP 标准方法 + 状态码 | Zod Schema 校验 |

## Server Actions

- 使用 `"use server"` 指令声明。
- 前端调用时直接从引入函数推断入参和返回值类型。
- 代码即接口文档，无需额外的 API 说明层。

## REST API

### 方法语义

| 方法 | 用途 |
|------|------|
| `GET` | 获取数据 |
| `POST` | 创建数据 |
| `PUT` | 全量更新 |
| `PATCH` | 局部更新 |
| `DELETE` | 删除数据 |

### 安全要求

- 动态处理 CORS 头，必要时注入基准路径。
- 所有接口实施权限校验作为第一道防线。

### 文档规范

新接口使用 `docs/_templates/api-doc-template.md` 模板编写文档。