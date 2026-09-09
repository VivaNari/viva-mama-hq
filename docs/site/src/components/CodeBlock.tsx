import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wraps a highlighted <pre> with a copy button.
 *
 * The button reads text from the rendered DOM rather than from props: by the
 * time this renders, rehype-highlight has already split the source into token
 * spans, so the DOM is the only place the plain text still exists intact.
 */
export default function CodeBlock({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = useCallback(async () => {
    const text = ref.current?.innerText ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access fails on insecure origins and in some locked-down
      // browsers. Leave the button silent rather than throwing; the reader can
      // still select the text by hand.
    }
  }, []);

  return (
    <div className="codeblock">
      <button
        type="button"
        className="copy-btn"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy code'}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}
