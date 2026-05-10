---
author: ai-generated
reviewer: reviewer
status: published
last_reviewed: 2026-05-10
review_date: 2026-05-10
review_comment: 
review_history: [{"date":"2026-05-10","reviewer":"reviewer","action":"published","comment":""}]
---
# 环境配置

## 环境变量文件

通过 `.env` 文件管理各环境的配置：

| 文件 | 用途 |
|------|------|
| `.env` | 默认/本地开发 |
| `.env.local` | 本地覆盖（不提交） |
| `.env.development` | 开发环境 |
| `.env.production` | 生产环境 |

## 核心环境变量

```bash
# 数据库连接字符串
DATABASE_URL=

# 应用密钥
APP_SECRET=

# 第三方服务令牌
REDIS_URL=
```

## 安全准则

所有机密信息（密钥、盐值、第三方令牌）必须由宿主机的环境变量注入，严禁随代码提交至版本控制系统。