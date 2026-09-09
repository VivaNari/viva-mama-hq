import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import MarkdownPage from './components/MarkdownPage';
import NotFound from './components/NotFound';
import { firstSlug } from './content';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={firstSlug} replace />} />
        <Route path=":slug" element={<MarkdownPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
