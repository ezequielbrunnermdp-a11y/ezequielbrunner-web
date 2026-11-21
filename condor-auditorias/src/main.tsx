import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SessionProvider } from './lib/session';
import './index.css';

// En el plan gratuito, Netlify muestra un distintivo fijo abajo a la derecha que no puede ocultarse:
// se deja espacio para que no tape el menú inferior en celulares.
if (document.querySelector('script[data-nf-variant="public"]')) document.documentElement.classList.add('nf-badge');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
