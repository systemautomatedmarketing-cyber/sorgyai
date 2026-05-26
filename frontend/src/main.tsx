import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(6, 19, 42, 0.95)',
            border: '1px solid rgba(0,212,255,0.25)',
            color: '#E8F4FD',
            backdropFilter: 'blur(12px)',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
