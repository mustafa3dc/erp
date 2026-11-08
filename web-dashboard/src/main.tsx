import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/common/ErrorBoundary'
import { initializeGlobalNumeralConverter } from './utils/arabicNumeralConverter'
import { initializeGlobalAutofillSuppressor } from './utils/disableAutofill'

// Initialize application-wide numeral conversion (Arabic/Persian -> Western 0-9)
try {
  initializeGlobalNumeralConverter();
} catch (e) {
  console.error('Failed to initialize numeral converter:', e);
}

// Initialize application-wide autofill and suggestion suppression (Safari/Chrome/Edge)
try {
  initializeGlobalAutofillSuppressor();
} catch (e) {
  console.error('Failed to initialize autofill suppressor:', e);
}

// Intercept Cmd+Shift+R / Ctrl+Shift+R to prevent Safari from entering Reader Mode ("نمط القارئ")
// and instead execute a standard page reload.
window.addEventListener(
  'keydown',
  (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) {
      e.preventDefault();
      e.stopPropagation();
      window.location.reload();
    }
  },
  true
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
