"use client";

import { Children, Fragment, isValidElement, cloneElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { HandlePill } from "./handle-pill";

/* ── @handle detection ──────────────────────────────────── */

// Matches "@handle" where handle is 2–30 alphanum / underscore / dot.
// Preceded by start-of-string or non-word (so "email@x" won't match).
const HANDLE_RE = /(^|[^\w@])@([A-Za-z0-9_][A-Za-z0-9_.]{1,29})\b/g;

/** Split a raw string into alternating text spans and <HandlePill>. */
function splitHandlesInString(text: string, keyBase: string): ReactNode[] {
  if (!text.includes("@")) return [text];
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  HANDLE_RE.lastIndex = 0;
  while ((m = HANDLE_RE.exec(text)) !== null) {
    const fullStart = m.index + m[1].length; // skip the preceding separator
    if (fullStart > last) out.push(text.slice(last, fullStart));
    out.push(
      <HandlePill key={`${keyBase}-hp-${i++}`} handle={m[2]} />
    );
    last = fullStart + 1 + m[2].length; // "@handle"
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Recursively walk children, replacing @handle matches in string nodes. */
function enhanceChildren(children: ReactNode, keyBase = "t"): ReactNode {
  const mapped = Children.map(children, (child, idx) => {
    if (typeof child === "string") {
      const parts = splitHandlesInString(child, `${keyBase}-${idx}`);
      if (parts.length === 1 && parts[0] === child) return child;
      return <Fragment key={`${keyBase}-${idx}`}>{parts}</Fragment>;
    }
    if (isValidElement(child)) {
      // Skip elements where handle detection shouldn't apply (code blocks, links).
      const tag = typeof child.type === "string" ? child.type : "";
      if (tag === "code" || tag === "pre" || tag === "a") return child;
      const props = child.props as { children?: ReactNode };
      if (props.children == null) return child;
      return cloneElement(
        child,
        {},
        enhanceChildren(props.children, `${keyBase}-${idx}`)
      );
    }
    return child;
  });
  return mapped;
}

/* ── react-markdown component overrides ─────────────────── */

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold mt-3 mb-1.5">{enhanceChildren(children, "h1")}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold mt-3 mb-1">{enhanceChildren(children, "h2")}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1">{enhanceChildren(children, "h3")}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{enhanceChildren(children, "p")}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{enhanceChildren(children, "li")}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{enhanceChildren(children, "s")}</strong>
  ),
  em: ({ children }) => <em className="italic">{enhanceChildren(children, "e")}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="my-2 overflow-x-auto rounded-md bg-black/5 dark:bg-white/5 p-3 text-[11px]">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5 text-[11px] font-mono">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-md border">
      <table className="w-full text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50 border-b">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1.5 border-t whitespace-nowrap">{enhanceChildren(children, "td")}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/30 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
};

export function AgentMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
