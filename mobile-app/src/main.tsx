import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { SettingsProvider } from "./context/SettingsContext";
import "./ui.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { setupStatusBarThemeSync } from "./native/status-bar";
import { setupTheme } from "./theme";

// Apply the saved reading theme before React paints so every route keeps the
// same palette and dark mode does not flash back to white during navigation.
setupTheme();
setupStatusBarThemeSync();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <HashRouter>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </HashRouter>
    </AppErrorBoundary>
  </StrictMode>,
);

// Keep the branded startup view above the WebView until React has painted its
// first real frame. This bridges the gap between iOS LaunchScreen and the app.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.getElementById("boot-splash")?.remove();
  });
});
