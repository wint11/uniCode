/**
 * uniCode 文档工具集 — 统一入口
 *
 * 用法:
 *   npx tsx docs/tools/tool.ts                      默认：全面检查 + 更新 changelog + 发布
 *   npx tsx docs/tools/tool.ts --check              仅检查（合规性 + 代码关联，只读不写）
 *   npx tsx docs/tools/tool.ts --scan               仅扫描文档合规性
 *   npx tsx docs/tools/tool.ts --refs               仅检查代码-文档关联变更
 *   npx tsx docs/tools/tool.ts --publish            仅发布（从数据库生成 production/ 快照）
 *   npx tsx docs/tools/tool.ts --changelog          仅更新变更日志
 *   npx tsx docs/tools/tool.ts --seed               重置并重新生成种子数据（不含 --reset）
 *   npx tsx docs/tools/tool.ts --seed --reset       完全重置（清空数据库 + 重置运行时数据）
 *   npx tsx docs/tools/tool.ts --migrate            文件系统文档迁移入数据库
 *
 * 默认行为（无参数）依次执行:
 *   1. 扫描文档合规性（缺失字段、无效状态、过期、死链、Foot Matter）
 *   2. 检查代码-文档关联变更（对比哈希快照，列出需更新的文档）
 *   3. 从 git log 更新 changelog
 *   4. 从数据库生成 production/ 只读快照
 */

import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scanDocs } from './scan-docs';
import { checkCodeRefs } from './check-code-refs';
import { publishDocs } from './publish-docs';
import { runSeed } from './seed';
import { insertDoc } from '../lib/db/docs';
import type { ReviewRecord } from '../lib/types';

const ROOT = process.cwd();

/** 从 git log 生成变更日志 */
function generateChangelog(): string {
  let commits: { date: string; hash: string; message: string }[] = [];

  try {
    const output = execSync('git log --format="%H|%ai|%s" -50', {
      cwd: ROOT,
      encoding: 'utf-8',
    }).trim();

    commits = output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, dateStr, ...msgParts] = line.split('|');
        return {
          hash: hash.slice(0, 7),
          date: dateStr.split(' ')[0],
          message: msgParts.join('|').trim(),
        };
      });
  } catch {
    // 非 git 仓库时返回空
  }

  const lines = ['# 变更日志'];

  if (commits.length === 0) {
    lines.push('', '暂无提交记录。');
  } else {
    const groups = new Map<string, typeof commits>();
    for (const c of commits) {
      const list = groups.get(c.date) || [];
      list.push(c);
      groups.set(c.date, list);
    }
    for (const [date, entries] of groups) {
      lines.push('', `## ${date}`);
      for (const e of entries) {
        lines.push(`- ${e.message} (\`${e.hash}\`)`);
      }
    }
  }

  lines.push('', '---', '', '> 本文档由 `npm run tool` 自动生成，内容来源于 `git log`。');
  return lines.join('\n');
}

/** 变更日志直接入库发布，跳过审核流程 */
async function updateChangelog(): Promise<void> {
  const content = generateChangelog();
  const today = new Date().toISOString().split('T')[0];
  const record: ReviewRecord = { date: today, reviewer: 'system', action: 'published', comment: '从 git log 自动生成' };

  insertDoc({
    slug: 'project-management/changelog',
    title: '变更日志',
    content,
    author: 'ai-generated',
    reviewer: 'system',
    status: 'published',
    last_reviewed: today,
    review_date: today,
    review_comment: '',
    review_history: [record],
    target_path: '',
  });

  console.log('变更日志已直接入库发布（跳过审核）。');
}

/** 运行数据库迁移 */
async function runMigrate(): Promise<void> {
  const { execSync } = await import('node:child_process');
  execSync('npx tsx docs/tools/migrate-to-db.ts', { cwd: ROOT, stdio: 'inherit' });
}

async function main() {
  const args = process.argv.slice(2);

  // 子命令分发
  if (args.includes('--seed')) {
    await runSeed(args);
    return;
  }
  if (args.includes('--migrate')) {
    await runMigrate();
    return;
  }

  // 单步操作
  const scanOnly = args.includes('--scan') && !args.includes('--check');
  const refsOnly = args.includes('--refs') && !args.includes('--check');
  const publishOnly = args.includes('--publish');
  const changelogOnly = args.includes('--changelog');
  const checkOnly = args.includes('--check');

  if (scanOnly) {
    const result = await scanDocs();
    if (result.issues.length > 0) process.exit(1);
    return;
  }

  if (refsOnly) {
    const result = await checkCodeRefs({ update: args.includes('--update'), init: args.includes('--init') });
    if (result.hasChanges) process.exit(1);
    return;
  }

  if (publishOnly) {
    const count = await publishDocs();
    console.log(`已发布 ${count} 篇文档到 production/`);
    return;
  }

  if (changelogOnly) {
    await updateChangelog();
    return;
  }

  // --check: 只读检查（不更新快照、不发布）
  if (checkOnly) {
    console.log('═══ 1/2 文档合规性扫描 ═══\n');
    const scanResult = await scanDocs();

    console.log('\n═══ 2/2 代码-文档关联检查 ═══\n');
    const refsResult = await checkCodeRefs({ update: false });

    console.log('\n── 检查摘要 ──');
    console.log(`  文档合规: ${scanResult.ok}/${scanResult.total}  (问题: ${scanResult.issues.length})`);
    console.log(`  代码关联: ${refsResult.docCount} 篇文档覆盖 ${refsResult.codeFileCount} 个文件`);
    if (refsResult.hasChanges) {
      console.log(`  待更新文档: ${refsResult.affectedDocs.length} 篇`);
    }

    if (scanResult.issues.length > 0 || refsResult.hasChanges) process.exit(1);
    return;
  }

  // 默认：完整流程
  const failed: string[] = [];

  console.log('═══ 1/4 文档合规性扫描 ═══\n');
  const scanResult = await scanDocs();
  if (scanResult.issues.length > 0) {
    failed.push(`文档合规性: ${scanResult.issues.length} 个问题`);
  }

  console.log('\n═══ 2/4 代码-文档关联检查 ═══\n');
  const refsResult = await checkCodeRefs({ update: true });
  // 代码变更仅做信息提示，不算失败（快照已更新）

  console.log('\n═══ 3/4 变更日志更新 ═══\n');
  try {
    await updateChangelog();
  } catch (err) {
    failed.push(`变更日志: ${(err as Error).message}`);
  }

  console.log('\n═══ 4/4 发布文档快照 ═══\n');
  try {
    const count = await publishDocs();
    console.log(`已发布 ${count} 篇文档到 production/`);
  } catch (err) {
    failed.push(`发布: ${(err as Error).message}`);
  }

  console.log('\n── 执行摘要 ──');
  console.log(`  文档: ${scanResult.ok}/${scanResult.total} 合规`);
  console.log(`  代码: ${refsResult.docCount} 篇文档覆盖 ${refsResult.codeFileCount} 个文件`);
  if (refsResult.hasChanges) console.log(`  变更: ${refsResult.changedFiles.length} 个文件变更，${refsResult.affectedDocs.length} 篇文档可能需更新`);

  if (failed.length > 0) {
    console.log(`\n  未通过: ${failed.join('; ')}`);
    process.exit(1);
  }

  console.log('\n全部完成。');
}

main().catch((err) => {
  console.error('工具执行失败:', err);
  process.exit(1);
});
