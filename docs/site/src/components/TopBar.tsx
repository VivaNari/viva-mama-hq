import { Link } from 'react-router-dom';
import { REPO_URL } from '../config';

interface Props {
  navOpen: boolean;
  onToggleNav: () => void;
}

export default function TopBar({ navOpen, onToggleNav }: Props) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="nav-toggle"
        aria-label="Toggle navigation"
        aria-expanded={navOpen}
        aria-controls="sidebar"
        onClick={onToggleNav}
      >
        <span aria-hidden="true">{navOpen ? '✕' : '☰'}</span>
      </button>

      <Link to="/" className="brand">
        {/* Served from public/, so BASE_URL keeps the path correct whether the
            site is hosted at a domain root or under a subpath. Decorative: the
            adjacent text already names the project. */}
        <img
          className="brand-mark"
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt=""
          width={30}
          height={30}
        />
        <span className="brand-text">
          VivaMama<span className="brand-sub">Contributor Docs</span>
        </span>
      </Link>

      <div className="topbar-spacer" />

      <a className="topbar-link" href={REPO_URL} target="_blank" rel="noreferrer noopener">
        GitHub ↗
      </a>
    </header>
  );
}
