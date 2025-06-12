import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../assets/index.css'  // Fix the import path
import App from '../App'      // Fix the import path

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
