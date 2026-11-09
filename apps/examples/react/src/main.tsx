import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@argus-table/themes/default.css';
import './style.css';
import { App } from './App';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
