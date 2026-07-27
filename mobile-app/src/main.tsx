import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { SettingsProvider } from "./context/SettingsContext";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </HashRouter>
  </StrictMode>,
);

// Keep the branded startup view above the WebView until React has painted its
// first real frame. This bridges the gap between iOS LaunchScreen and the app.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.getElementById("boot-splash")?.remove();
  });
});
