---
author: ai-generated
reviewer: reviewer
status: published
last_reviewed: 2026-05-10
review_date: 2026-05-10
review_comment: 
review_history: [{"date":"2026-05-10","reviewer":"reviewer","action":"published","comment":""}]
---
# 运维指南

## 构建与部署

```bash
# 生产构建
npm run build

# 启动生产服务器
npm run start
```

## 维护模式

通过中间件读取全局配置实现一键维护状态切换。维护模式下所有非白名单请求被拦截并重定向至维护说明页面，实现零代码修改的热切换。

## 环境管理

- 所有部署环境通过独立的环境变量文件隔离管理。
- 核心机密信息由宿主机环境变量注入，严禁随代码提交。
- 详见 [环境配置](./getting-started-environment.md)