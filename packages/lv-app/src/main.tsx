import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from 'src/App';
import 'src/index.css';

// The La Vivenzia interface. A real application with real routes — the six
// doors are URLs, the back button works, and a screen can be linked to.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
