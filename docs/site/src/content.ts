// Content model.
//
// Every page on this site is a Markdown file in ../content. Adding a page means
// dropping a .md file in that directory — no code change, no route registration.
// Vite inlines the files at build time via import.meta.glob, so the built site is
// fully static with no runtime fetches.
//
// Ordering and titles come from a small frontmatter block at the top of each file:
//
//   ---
//   title: Install dependencies
//   section: Getting started
//   description: One-line summary used for the page subtitle.
//   ---
//
// We parse that by hand rather than pulling in gray-matter, which depends on
// Node's Buffer and needs a polyfill to run in the browser.

export interface DocPage {
  /** URL slug, derived from the filename with its numeric sort prefix stripped. */
  slug: string;
  title: string;
  /** Sidebar group heading. Groups render in first-seen (i.e. filename) order. */
  section: string;
  description?: string;
  /** Markdown body with the frontmatter block removed. */
  body: string;
  /** Numeric prefix from the filename, used only for sorting. */
  order: number;
  /** Source filename, e.g. `04-install.md` — used by the "edit this page" link. */
  file: string;
}

interface Frontmatter {
  title?: string;
  section?: string;
  description?: string;
}

/**
 * Parse a leading `---` fenced block into key/value pairs.
 *
 * Deliberately minimal: flat `key: value` lines only. Values may be wrapped in
 * matching quotes. Anything more (nesting, lists, multiline) is out of scope —
 * if a page ever needs it, reach for a real YAML parser instead of growing this.
 */
function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };

  const data: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;

    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();

    // Strip one layer of matching quotes, so `title: "Foo: bar"` keeps its colon.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }

    if (key === 'title' || key === 'section' || key === 'description') {
      data[key] = value;
    }
  }

  return { data, body: raw.slice(match[0].length) };
}

/** `01-introduction.md` -> { order: 1, slug: 'introduction' } */
function parseFilename(path: string): { order: number; slug: string } {
  const file = path.split('/').pop() ?? path;
  const name = file.replace(/\.md$/, '');
  const withPrefix = /^(\d+)[-_](.+)$/.exec(name);

  if (withPrefix) {
    return { order: Number(withPrefix[1]), slug: withPrefix[2] };
  }
  // Unprefixed files still work; they just sort last, alphabetically.
  return { order: Number.MAX_SAFE_INTEGER, slug: name };
}

const modules = import.meta.glob('../content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const pages: DocPage[] = Object.entries(modules)
  .map(([path, raw]) => {
    const { order, slug } = parseFilename(path);
    const { data, body } = parseFrontmatter(raw);
    const file = path.split('/').pop() ?? path;

    return {
      slug,
      // Fall back to a humanised slug so a page missing frontmatter still shows
      // something sensible in the sidebar rather than an empty entry.
      title: data.title ?? slug.replace(/-/g, ' '),
      section: data.section ?? 'Documentation',
      description: data.description,
      body,
      order,
      file,
    };
  })
  .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));

export interface DocSection {
  name: string;
  pages: DocPage[];
}

/** Pages grouped for the sidebar, preserving the order established above. */
export const sections: DocSection[] = pages.reduce<DocSection[]>((acc, page) => {
  const existing = acc.find((s) => s.name === page.section);
  if (existing) existing.pages.push(page);
  else acc.push({ name: page.section, pages: [page] });
  return acc;
}, []);

export const findPage = (slug: string): DocPage | undefined =>
  pages.find((p) => p.slug === slug);

/** Previous/next in flat reading order, for the footer pager. */
export function neighbours(slug: string): { prev?: DocPage; next?: DocPage } {
  const i = pages.findIndex((p) => p.slug === slug);
  if (i === -1) return {};
  return { prev: pages[i - 1], next: pages[i + 1] };
}

export const firstSlug = pages[0]?.slug ?? '';
