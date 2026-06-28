import './monaco-setup'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ApiProvider, DESKTOP_CAPABILITIES } from './api'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ApiProvider api={window.api} caps={DESKTOP_CAPABILITIES}>
      <App />
    </ApiProvider>
  </React.StrictMode>
)
