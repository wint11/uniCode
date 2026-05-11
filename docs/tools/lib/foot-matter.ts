/**
 * Foot Matter 解析工具
 *
 * Foot Matter 是 Markdown 文件末尾的 YAML 块（由 --- 分隔），
 * 专门存放 code_refs（关联代码文件）和 doc_refs（关联文档）。
 *
 * 格式：
 *   ---
 *   code_refs:
 *     - src/lib/foo.ts
 *     - tools/bar.ts
 *   doc_refs:
 *     - guides/dev/code-style
 *     - architecture/adr/adr-0001
 *   ---
 */

export interface FootMatter {
  code_refs: string[];
  doc_refs: string[];
}

/** 从正文中移除 Front Matter（第一个 --- 块），返回正文部分 */
function stripFrontMatter(content: string): string {
  if (content.startsWith('---\n')) {
    const end = content.indexOf('\n---\n', 4);
    if (end !== -1) return content.slice(end + 5);
  }
  return content;
}

/** 收集正文中所有 \n---\n 的位置（已去除 Front Matter） */
function findSeparatorPositions(body: string): number[] {
  const positions: number[] = [];
  const re = /\n---\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    positions.push(m.index);
  }
  return positions;
}

/**
 * 从 Markdown 正文中解析 Foot Matter。
 * 返回 null 表示文件中不包含 Foot Matter。
 */
export function parseFootMatter(content: string): FootMatter | null {
  const body = stripFrontMatter(content);
  const positions = findSeparatorPositions(body);

  // 从最后一个 --- 块往前找，第一个能被解析为 YAML 的即为 Foot Matter
  for (let i = positions.length - 1; i >= 0; i--) {
    const start = positions[i] + 5; // 跳过 \n---\n
    const rest = body.slice(start);
    const closingIdx = rest.lastIndexOf('\n---');

    if (closingIdx === -1) continue;

    const yamlStr = rest.slice(0, closingIdx).trim();
    if (!/^\w+:/m.test(yamlStr)) continue;

    const result = parseYamlArrays(yamlStr);
    if (result) return result;
  }

  return null;
}

/** 简易 YAML 数组解析器 — 仅支持 code_refs / doc_refs 两个顶层键 */
function parseYamlArrays(yaml: string): FootMatter | null {
  const result: FootMatter = { code_refs: [], doc_refs: [] };
  let currentKey: string | null = null;

  for (const line of yaml.split('\n')) {
    const keyMatch = line.match(/^(\w+):\s*$/);
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);

    if (keyMatch) {
      currentKey = keyMatch[1];
    } else if (arrayMatch && currentKey) {
      const val = arrayMatch[1].trim();
      if (currentKey === 'code_refs') result.code_refs.push(val);
      else if (currentKey === 'doc_refs') result.doc_refs.push(val);
    }
  }

  return result;
}

/**
 * 生成 Foot Matter 字符串（末尾加一个空行，方便拼接）
 */
export function buildFootMatter(data: FootMatter): string {
  if (data.code_refs.length === 0 && data.doc_refs.length === 0) return '';

  const lines: string[] = ['', '---'];

  if (data.code_refs.length > 0) {
    lines.push('code_refs:');
    for (const ref of data.code_refs) {
      lines.push(`  - ${ref}`);
    }
  }

  if (data.doc_refs.length > 0) {
    if (data.code_refs.length > 0) lines.push('');
    lines.push('doc_refs:');
    for (const ref of data.doc_refs) {
      lines.push(`  - ${ref}`);
    }
  }

  lines.push('---');
  lines.push('');
  return lines.join('\n');
}
