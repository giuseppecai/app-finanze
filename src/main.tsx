import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root mancante in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
