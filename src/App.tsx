import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { I18nProvider } from './i18n';
import BoardPage from './pages/BoardPage';
import GmPage from './pages/GmPage';
import HomePage from './pages/HomePage';
import { JoinPage, PlayerPage } from './pages/PlayerPage';

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gm/:boardId" element={<GmPage />} />
          <Route path="/board/:boardId" element={<BoardPage />} />
          <Route path="/player/:boardId" element={<PlayerPage />} />
          <Route path="/hub/:boardId" element={<PlayerPage hub />} />
          <Route path="/dalibnieks" element={<JoinPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </I18nProvider>
  );
}

