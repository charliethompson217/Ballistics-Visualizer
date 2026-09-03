import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import initBallistics from 'ballistics-engine'
import './index.css'
import App from './App.tsx'

await initBallistics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
