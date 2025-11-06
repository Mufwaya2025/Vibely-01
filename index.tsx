import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/css/tailwind.css'; // Import Tailwind CSS
import App from './App';
import { GoogleOAuthProvider } from '@react-oauth/google';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const AppTree = googleClientId ? (
  <GoogleOAuthProvider clientId={googleClientId}>
    <App />
  </GoogleOAuthProvider>
) : (
  <App />
);

if (!googleClientId) {
  console.warn('VITE_GOOGLE_CLIENT_ID is not set. Google authentication will be disabled.');
}

root.render(
  <React.StrictMode>
    {AppTree}
  </React.StrictMode>
);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("Service worker registered with scope:", registration.scope);
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
