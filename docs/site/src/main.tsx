import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
// highlight.js ships themes as plain CSS. We import one and override the handful
// of token colours in styles.css so code blocks track the site's light/dark
// palette instead of staying locked to the theme's own background.
import 'highlight.js/styles/github-dark.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found in index.html');

createRoot(root).render(
  <StrictMode>
    {/* BASE_URL is '/' in dev and '/<repo>/' for GitHub Pages, so the router
        and Vite always agree on the path prefix. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
