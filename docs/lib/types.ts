export type DocStatus = 'draft' | 'reviewed' | 'published' | 'rejected';

export interface ReviewRecord {
  date: string;
  reviewer: string;
  action: 'approved' | 'rejected' | 'published' | 'unpublished';
  comment: string;
}

export interface DocFrontMatter {
  author: string;
  reviewer: string;
  status: DocStatus;
  last_reviewed: string;
  review_date: string;
  review_comment: string;
  review_history: ReviewRecord[];
  /** 审核通过后移入的目标路径（相对于 docs/）*/
  target_path: string;
}

export interface DocEntry {
  slug: string;
  relativePath: string;
  frontmatter: DocFrontMatter;
  title: string;
  isStale: boolean;
}

export interface DocDetail extends DocEntry {
  content: string;
}
