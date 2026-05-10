---
author: ai-generated
reviewer: reviewer
status: published
last_reviewed: 2026-05-10
review_date: 2026-05-10
review_comment: 
review_history: [{"date":"2026-05-10","reviewer":"reviewer","action":"published","comment":""}]
---
# 测试指南

## 测试策略

- **单元测试**: 工具函数、纯逻辑
- **集成测试**: 数据库操作、API 端点
- **E2E 测试**: 关键用户流程

## 运行测试

```bash
# 运行全部测试
npm test

# 运行单个测试文件
npm test -- <文件路径>

# 生成覆盖率报告
npm test -- --coverage
```

## 测试规范

- 新功能必须包含对应的测试用例。
- 集成测试必须触及真实数据库，不使用模拟层（防止模拟/生产差异掩盖问题）。