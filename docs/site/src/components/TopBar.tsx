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
        <span className="brand-mark" aria-hidden="true">
          VM
        </span>
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
