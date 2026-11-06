import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { startAppearance } from './appearance/useAppearance'
import { App } from './App'
import { installVaultRuntime } from './vault-api/runtime'
// global.css first: it declares the lowest cascade layer, which app.css's layers must follow.
import './styles/global.css'
import '@fontsource/geist-mono/latin-400.css'
import '@fontsource/geist-mono/latin-500.css'
import './styles/app.css'

startAppearance()
installVaultRuntime()

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
