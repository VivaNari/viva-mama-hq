import { NavLink } from 'react-router-dom';
import { sections } from '../content';

interface Props {
  open: boolean;
}

export default function Sidebar({ open }: Props) {
  return (
    <nav
      id="sidebar"
      className={`sidebar${open ? ' sidebar-open' : ''}`}
      aria-label="Documentation"
    >
      <div className="sidebar-inner">
        {sections.map((section) => (
          <div className="nav-group" key={section.name}>
            <p className="nav-group-title">{section.name}</p>
            <ul className="nav-list">
              {section.pages.map((page) => (
                <li key={page.slug}>
                  <NavLink
                    to={`/${page.slug}`}
                    className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
                  >
                    {page.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
