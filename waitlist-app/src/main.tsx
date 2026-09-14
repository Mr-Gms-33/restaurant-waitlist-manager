import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { getWaitlistService, WaitlistServiceProvider } from './services';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WaitlistServiceProvider service={getWaitlistService()}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WaitlistServiceProvider>
  </StrictMode>,
);
