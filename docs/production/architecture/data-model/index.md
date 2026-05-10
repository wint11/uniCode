---
author: ai-generated
reviewer: reviewer
status: published
last_reviewed: 2026-05-10
review_date: 2026-05-10
review_comment: 
review_history: [{"date":"2026-05-10","reviewer":"reviewer","action":"published","comment":""}]
---
# 数据模型

## 唯一真实来源

数据库表结构、关联关系和索引定义拥有唯一的核心模型文件。所有服务端与客户端类型推断均从此文件自动生成，严禁手动维护重复的类型定义。

## 模型设计准则

- 广泛使用级联删除清理弱实体（评论、点赞、文件记录），杜绝孤儿数据。
- 高频查询字段、外键关联字段、排序和过滤字段必须建立索引。
- 数据库查询必须精确指定返回字段，严禁使用全字段查询。
- 数据库环境切换通过环境变量动态挂载连接字符串实现。

## 模型文件

模型定义文件存放于 `src/lib/models/`，由 Prisma / Drizzle 等 ORM 统一管理。