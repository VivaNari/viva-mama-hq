import { useEffect, useState } from 'react';

export interface Heading {
  id: string;
  text: string;
  level: number;
}

/**
 * On-page contents, built from the h2/h3 elements rehype-slug has already
 * given stable ids. Re-derived per page via the `slug` dependency.
 */
export default function TableOfContents({ slug }: { slug: string }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLHeadingElement>('.prose h2, .prose h3'),
    );
    setHeadings(
      nodes
        .filter((n) => n.id)
        .map((n) => ({
          id: n.id,
          text: n.textContent ?? '',
          level: Number(n.tagName.slice(1)),
        })),
    );
  }, [slug]);

  // Highlight whichever heading is nearest the top of the viewport.
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Top-weighted margin: a heading counts as "current" once it reaches the
      // upper third, which matches where the eye actually is while reading.
      { rootMargin: '-80px 0px -66% 0px', threshold: 0 },
    );

    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <aside className="toc" aria-label="On this page">
      <p className="toc-title">On this page</p>
      <ul>
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? 'toc-sub' : undefined}>
            <a href={`#${h.id}`} className={active === h.id ? 'toc-active' : undefined}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
