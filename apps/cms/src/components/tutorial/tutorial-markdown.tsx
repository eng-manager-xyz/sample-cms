import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import { createLowlight } from 'lowlight';
import type { ReactNode } from 'react';
import { isValidElement } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { MathJaxEquation } from '@/components/tutorial/mathjax-equation';
import { cn } from '@/lib/cn';

interface MarkdownAstNode {
  type: string;
  value?: string;
  children?: MarkdownAstNode[];
  data?: {
    hName?: string;
  };
}

const highlightPattern = /==([^=\n]+)==/g;
const literalNodeTypes = new Set(['code', 'inlineCode', 'html']);
const syntaxHighlighter = createLowlight({ bash, css, javascript, json, sql, typescript });
syntaxHighlighter.registerAlias({
  bash: ['sh', 'shell', 'zsh'],
  javascript: ['js', 'jsx'],
  typescript: ['ts', 'tsx'],
});

const SQL_KEYWORDS = new Set([
  'ALTER',
  'AND',
  'CREATE',
  'DELETE',
  'DROP',
  'EXISTS',
  'EXPLAIN',
  'FROM',
  'IN',
  'INSERT',
  'JOIN',
  'OR',
  'PRAGMA',
  'SELECT',
  'UPDATE',
  'WHERE',
]);

interface SyntaxNode {
  type: 'element' | 'text';
  value?: string;
  properties?: {
    className?: string[];
  };
  children?: SyntaxNode[];
}

function languageFromClassName(className?: string): string | undefined {
  return className?.match(/(?:^|\s)language-([\w-]+)/)?.[1]?.toLowerCase();
}

function renderSyntaxNodes(nodes: SyntaxNode[], parentKey = 'syntax'): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${parentKey}-${index}`;
    if (node.type === 'text') return node.value;
    return (
      <span key={key} className={node.properties?.className?.join(' ')}>
        {renderSyntaxNodes(node.children ?? [], key)}
      </span>
    );
  });
}

function highlightedCode(language: string | undefined, source: string): ReactNode {
  if (!language || !syntaxHighlighter.registered(language)) return source;
  const tree = syntaxHighlighter.highlight(language, source);
  return renderSyntaxNodes(tree.children as SyntaxNode[]);
}

type InlineCodeKind =
  | 'callable'
  | 'config'
  | 'identifier'
  | 'keyword'
  | 'literal'
  | 'math'
  | 'path'
  | 'plain'
  | 'type';

function classifyInlineCode(source: string): InlineCodeKind {
  if (
    /^(?:https?:\/\/|\/|\.\/|\.\.\/)/.test(source) ||
    /(?:^|\/)[\w@.$-]+\.(?:css|json|md|sql|ts|tsx)$/.test(source)
  ) {
    return 'path';
  }
  if (/^[A-Z][A-Z0-9_]+(?:=[^\s]+)?$/.test(source)) return 'config';
  if (SQL_KEYWORDS.has(source.toUpperCase())) return 'keyword';
  if (/^(?:true|false|null|undefined|\d+(?:\.\d+)?%?)$/.test(source)) return 'literal';
  if (/^['"].*['"]$/.test(source)) return 'literal';
  if (/[πμΠ∈≠∩∪→↦]/u.test(source) || /^[CDIKLMOPRSThvkp]_[A-Za-z](?:\([^)]*\))?$/.test(source)) {
    return 'math';
  }
  if (/^[A-Z][A-Za-z0-9]*(?:Schema|Service|Document|Result|Error)$/.test(source)) return 'type';
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\([^)]*\)$/.test(source)) return 'callable';
  if (/^[A-Za-z_$][\w$]*\([^)]*\)$/.test(source)) return 'callable';
  if (/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/.test(source)) return 'identifier';
  return 'plain';
}

function splitHighlightText(node: MarkdownAstNode): MarkdownAstNode[] {
  const value = node.value ?? '';
  const matches = [...value.matchAll(highlightPattern)];
  if (matches.length === 0) return [node];

  const nodes: MarkdownAstNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    const start = match.index;
    const highlighted = match[1];
    if (start === undefined || highlighted === undefined) continue;

    if (start > cursor) nodes.push({ type: 'text', value: value.slice(cursor, start) });
    nodes.push({ type: 'text', value: highlighted, data: { hName: 'mark' } });
    cursor = start + match[0].length;
  }

  if (cursor < value.length) nodes.push({ type: 'text', value: value.slice(cursor) });
  return nodes;
}

function transformHighlights(node: MarkdownAstNode): void {
  if (!node.children || literalNodeTypes.has(node.type)) return;

  const children: MarkdownAstNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      children.push(...splitHighlightText(child));
      continue;
    }
    transformHighlights(child);
    children.push(child);
  }
  node.children = children;
}

/** Adds the familiar `==highlight==` extension without enabling raw HTML. */
function remarkHighlight() {
  return (tree: MarkdownAstNode) => transformHighlights(tree);
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-12 font-display text-3xl font-bold leading-tight tracking-[-0.035em] text-ink">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-11 font-display text-2xl font-bold leading-tight tracking-[-0.03em] text-ink">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-10 font-display text-xl font-bold leading-snug tracking-[-0.025em] text-ink">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-9 font-display text-lg font-bold leading-snug tracking-[-0.02em] text-ink">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-8 font-display text-base font-bold leading-snug text-ink">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-8 font-display text-sm font-bold uppercase tracking-[0.08em] text-ink">
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="mt-5 text-[15px] font-[430] leading-7 text-ink-muted sm:text-base sm:leading-8">
      {children}
    </p>
  ),
  strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic text-ink">{children}</em>,
  del: ({ children }) => (
    <del className="text-ink-faint decoration-danger/55 decoration-2">{children}</del>
  ),
  mark: ({ children }) => (
    <mark className="rounded-sm bg-warning-soft px-1 py-0.5 text-ink box-decoration-clone">
      {children}
    </mark>
  ),
  a: ({ children, href, title }) => {
    const external = href?.startsWith('http://') || href?.startsWith('https://');
    return (
      <a
        href={href}
        title={title}
        className="font-semibold text-accent-strong underline decoration-accent/35 decoration-1 underline-offset-4 transition-colors hover:decoration-accent focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        rel={external ? 'noreferrer' : undefined}
        target={external ? '_blank' : undefined}
      >
        {children}
      </a>
    );
  },
  ul: ({ children }) => (
    <ul className="mt-5 list-disc space-y-2.5 pl-6 text-[15px] font-[430] leading-7 text-ink-muted marker:text-accent sm:text-base [&_p]:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol
      start={start}
      className="mt-5 list-decimal space-y-2.5 pl-6 text-[15px] font-[430] leading-7 text-ink-muted marker:font-bold marker:text-accent-strong sm:text-base [&_p]:mt-0"
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-6 rounded-r-xl border-l-[3px] border-accent bg-accent-soft/45 px-5 py-4 font-serif text-[15px] leading-7 text-ink [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-10 border-0 border-t border-line" />,
  pre: ({ children }) => {
    if (
      isValidElement<{ className?: string }>(children) &&
      children.props.className?.includes('math-display')
    ) {
      return children;
    }
    const language = isValidElement<{ className?: string }>(children)
      ? languageFromClassName(children.props.className)
      : undefined;
    return (
      <pre
        className="tutorial-code-block mt-6 max-w-full overflow-x-auto rounded-xl border border-line bg-ink px-4 py-4 font-mono text-[12px] leading-6 text-canvas shadow-sm [tab-size:2] [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit"
        data-language={language && language !== 'text' ? language.toUpperCase() : undefined}
      >
        {children}
      </pre>
    );
  },
  code: ({ children, className }) => {
    const tex = String(children).trim();
    if (className?.includes('math-display')) {
      return <MathJaxEquation display tex={tex} />;
    }
    if (className?.includes('math-inline')) {
      return <MathJaxEquation display={false} tex={tex} />;
    }
    const language = languageFromClassName(className);
    const block = language !== undefined;
    const inlineKind = block ? undefined : classifyInlineCode(tex);
    return (
      <code
        className={
          block
            ? cn('hljs', className)
            : 'tutorial-inline-code rounded border px-1.5 py-0.5 font-mono text-[0.86em] font-medium'
        }
        data-code-kind={inlineKind}
      >
        {block ? highlightedCode(language, tex) : children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="mt-6 overflow-x-auto rounded-xl border border-line shadow-sm">
      <table className="w-full min-w-[600px] border-collapse text-left text-[13px] leading-5">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-muted text-ink">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-line bg-canvas">{children}</tbody>,
  tr: ({ children }) => <tr className="align-top even:bg-surface-subtle/45">{children}</tr>,
  th: ({ children }) => (
    <th
      scope="col"
      className="border-r border-line px-3 py-3 font-display font-bold last:border-r-0"
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-r border-line px-3 py-3 text-ink-muted last:border-r-0">{children}</td>
  ),
  figure: ({ children }) => (
    <figure className="mt-7 overflow-hidden rounded-xl border border-line bg-surface-subtle">
      {children}
    </figure>
  ),
  figcaption: ({ children }) => (
    <figcaption className="border-t border-line px-4 py-3 font-serif text-[13px] italic leading-6 text-ink-muted">
      {children}
    </figcaption>
  ),
  caption: ({ children }) => (
    <caption className="caption-top border-b border-line bg-surface-subtle px-3 py-3 text-left font-serif text-[13px] italic leading-6 text-ink-muted">
      {children}
    </caption>
  ),
};

export function TutorialMarkdown({
  markdown,
  className,
}: Readonly<{ markdown: string; className?: string }>) {
  return (
    <div className={cn('tutorial-prose min-w-0 font-sans', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkHighlight]}
        components={markdownComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
