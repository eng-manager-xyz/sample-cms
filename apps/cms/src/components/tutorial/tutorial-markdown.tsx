import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="mt-10 text-2xl font-semibold tracking-[-0.03em] text-ink">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mt-9 text-xl font-semibold tracking-[-0.025em] text-ink">{children}</h3>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 text-lg font-semibold tracking-[-0.02em] text-ink">{children}</h3>
  ),
  h4: ({ children }) => <h4 className="mt-7 text-base font-semibold text-ink">{children}</h4>,
  p: ({ children }) => <p className="mt-4 text-[14px] leading-7 text-ink-muted">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="text-ink">{children}</em>,
  a: ({ children, href }) => {
    const external = href?.startsWith('http://') || href?.startsWith('https://');
    return (
      <a
        href={href}
        className="font-medium text-accent-strong underline decoration-accent/35 underline-offset-4 hover:decoration-accent focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        rel={external ? 'noreferrer' : undefined}
        target={external ? '_blank' : undefined}
      >
        {children}
      </a>
    );
  },
  ul: ({ children }) => (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-[14px] leading-6 text-ink-muted marker:text-accent">
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol
      start={start}
      className="mt-4 list-decimal space-y-2 pl-5 text-[14px] leading-6 text-ink-muted marker:font-semibold marker:text-accent-strong"
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-5 rounded-r-lg border-l-2 border-accent bg-accent-soft/45 px-4 py-3 [&>p:first-child]:mt-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-0 border-t border-line" />,
  pre: ({ children }) => (
    <pre className="mt-5 max-w-full overflow-x-auto rounded-xl border border-line bg-ink px-4 py-3 font-mono text-[12px] leading-6 text-canvas shadow-sm [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const block = className?.startsWith('language-');
    return (
      <code
        className={cn(
          block
            ? className
            : 'rounded border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-[0.88em] text-ink'
        )}
      >
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="mt-5 overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[600px] border-collapse text-left text-[12px] leading-5">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-muted text-ink">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-line bg-canvas">{children}</tbody>,
  tr: ({ children }) => <tr className="align-top">{children}</tr>,
  th: ({ children }) => (
    <th className="border-r border-line px-3 py-2.5 font-semibold last:border-r-0">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-r border-line px-3 py-2.5 text-ink-muted last:border-r-0">{children}</td>
  ),
};

export function TutorialMarkdown({
  markdown,
  className,
}: Readonly<{ markdown: string; className?: string }>) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
