// rfid-attendance-system/apps/frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import App from './App.jsx'; // Your main App component
import './index.css'; // Global styles
import { Toaster } from 'react-hot-toast'; // For notifications

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" reverseOrder={false} /> {/* For toasts/notifications */}
    </BrowserRouter>
  </React.StrictMode>,
);