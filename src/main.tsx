import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Anti-Inspect Script
if (window) {
  // บล็อก Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const isControlShift = e.ctrlKey && e.shiftKey;
    
    if (
      e.key === 'F12' ||
      (isControlShift && (key === 'i' || key === 'j' || key === 'c')) ||
      (e.ctrlKey && (key === 'u' || key === 'r' || key === 's' || key === 'p')) || // ป้องกัน View Source, Refresh, Save, Print
      (e.ctrlKey && e.shiftKey && key === 'r')
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  // ป้องกันการคลิกขวา (Frontend Level)
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // ตรวจจับ DevTools เปิดด้วยขนาดจอ (Optional - แต่ช่วยได้)
  let devtoolsOpen = false;
  const threshold = 160;
  setInterval(() => {
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    if (widthDiff || heightDiff) {
      if (!devtoolsOpen) {
        // ถ้าเจอว่าเปิด ให้ล้างหน้าจอหรือทำอะไรบางอย่าง
        document.body.innerHTML = '<div style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h1>Security Violation: DevTools Detected</h1></div>';
        window.location.reload();
      }
      devtoolsOpen = true;
    } else {
      devtoolsOpen = false;
    }
  }, 1000);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
