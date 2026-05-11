---
author: ai-generated
reviewer: admin
status: published
last_reviewed: 2026-05-11
review_date: 2026-05-11
review_comment: 
review_history: [{"date":"2026-05-11","reviewer":"admin","action":"published","comment":""}]
---
# 编码规范

## 命名约定

- **所有自定义目录与文件**: 严格使用 kebab-case（小写字母 + 连字符）。杜绝跨 OS 大小写敏感错误。
- **Next.js 保留文件名**: 仅使用框架标准保留字 — `page.tsx`、`layout.tsx`、`loading.tsx`、`error.tsx`、`route.ts`。
- **组件文件后缀**: `*.view.tsx`（展示组件）、`*.layout.tsx`（布局组件）、`*.error.tsx`（错误边界组件）。
- **服务端文件**: `*.action.ts`（Server Action）、`*.model.ts`（数据模型）、`*.service.ts`（服务）。
- **变量命名**: 布尔值以状态动词开头（`isLoading`、`hasPermission`、`canEdit`）。事件处理函数以 `handle` 前缀开头（`handleClick`、`handleSubmit`）。

## 目录组织

- **核心业务代码统一收敛于 `src/`**: 实现业务逻辑与配置文件的物理隔离。
- **路由目录 = 业务领域边界**: 每个路由文件夹视为独立业务模块，严禁不同模块间底层强耦合。
- **全局单例服务** 存放于 `src/lib/`（数据库连接、鉴权、审计日志等）。
- **静态资源** 归拢于 `public/`，通过绝对路径引用。

## TypeScript

- 所有代码必须使用 TypeScript。
- 严禁 `any` 类型，除非有明确注释说明原因。
- 数据库类型从核心模型文件自动推断，严禁手动维护重复的类型定义。

## 注释

- 注释使用简体中文。
- 注释内容与当前代码保持绝对一致，严禁过时、错误或误导性注释。
- 代码修改后必须检查相关注释是否需要更新。

## 零警告原则

在任何环节（代码执行、终端输出、编译、打包、命令运行）均不允许出现任何错误或警告。一旦出现，必须定位根源并修正。严禁采用关闭日志、降低警告等级、绕过检查等掩盖问题的方式处理。
---
code_refs:
  - tsconfig.json
  - docs/lib/types.ts

doc_refs:
  - guides/development/development-standards
---
