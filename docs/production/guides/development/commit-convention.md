---
author: ai-generated
reviewer: reviewer
status: published
last_reviewed: 2026-05-10
review_date: 2026-05-10
review_comment: 
review_history: [{"date":"2026-05-10","reviewer":"reviewer","action":"published","comment":""}]
---
# Git 提交规范

## 提交信息格式

```
<type>(<scope>): <subject>

<body>
```

### Type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试 |
| `chore` | 构建/工具变更 |
| `ci` | CI 配置变更 |

### 示例

```
feat(auth): 添加动态会话刷新机制

perf(api): 消除用户信息查询的请求瀑布
```

## 分支命名

- 功能分支: `feat/<功能简述>`
- 修复分支: `fix/<问题简述>`
- 发布分支: `release/<版本号>`

## 规则

- 提交信息使用中文。
- 严禁提交包含机密信息的文件（`.env.local`、证书、密钥）。