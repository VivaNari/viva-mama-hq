import { Link } from 'react-router-dom';
import { firstSlug } from '../content';

export default function NotFound() {
  return (
    <article className="prose">
      <h1>Page not found</h1>
      <p>
        That page doesn&rsquo;t exist in this guide. It may have been renamed, or the link
        that brought you here may be stale.
      </p>
      <p>
        <Link to={`/${firstSlug}`}>Back to the introduction →</Link>
      </p>
    </article>
  );
}
