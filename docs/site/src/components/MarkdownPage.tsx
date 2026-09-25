import ReactMarkdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import NotFound from './NotFound';
import TableOfContents from './TableOfContents';
import { editUrl } from '../config';
import { findPage, neighbours } from '../content';

export default function MarkdownPage() {
  const { slug = '' } = useParams();
  const page = findPage(slug);

  if (!page) return <NotFound />;

  const { prev, next } = neighbours(slug);

  return (
    <div className="page">
      <article className="prose">
        <header className="page-header">
          <p className="eyebrow">{page.section}</p>
          <h1>{page.title}</h1>
          {page.description && <p className="lede">{page.description}</p>}
        </header>

        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug, rehypeHighlight]}
          components={{
            // Route fenced blocks through CodeBlock so each gets a copy button.
            // react-markdown hands us the inner <code> element as children; it
            // has already been tokenised by rehype-highlight.
            pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,

            a: ({ href, children }) => {
              const url = href ?? '';
              const isExternal = /^https?:\/\//.test(url);
              // In-page anchors and external links pass through untouched;
              // anything else is an internal doc route and goes via the router
              // so it doesn't trigger a full page reload.
              if (isExternal) {
                return (
                  <a href={url} target="_blank" rel="noreferrer noopener">
                    {children}
                  </a>
                );
              }
              if (url.startsWith('#')) return <a href={url}>{children}</a>;
              return <Link to={url}>{children}</Link>;
            },

            // Wide tables must scroll inside their own container rather than
            // forcing the whole page to scroll sideways on narrow screens.
            table: ({ children }) => (
              <div className="table-wrap">
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {page.body}
        </ReactMarkdown>

        <footer className="page-footer">
          <a
            className="edit-link"
            href={editUrl(page.file)}
            target="_blank"
            rel="noreferrer noopener"
          >
            Edit this page on GitHub ↗
          </a>

          <nav className="pager" aria-label="Pagination">
            {prev ? (
              <Link className="pager-link" to={`/${prev.slug}`}>
                <span className="pager-dir">← Previous</span>
                <span className="pager-title">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link className="pager-link pager-next" to={`/${next.slug}`}>
                <span className="pager-dir">Next →</span>
                <span className="pager-title">{next.title}</span>
              </Link>
            )}
          </nav>
        </footer>
      </article>

      <TableOfContents slug={slug} />
    </div>
  );
}
