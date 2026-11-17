import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { reloadForNewDeployment } from '@/app/chunk-reload'
import './index.css'

// Vite fires this when preloading a chunk's dependencies fails — after a new
// deployment the old files are gone, so reload once to pick up the new build.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewDeployment()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
