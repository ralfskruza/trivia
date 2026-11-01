import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// StrictMode is intentionally omitted: double-mounting would create/destroy the
// PeerJS host twice and briefly lock the signaling ID.
createRoot(document.getElementById('root')!).render(<App />);

