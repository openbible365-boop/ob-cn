import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { SettingsProvider } from "./context/SettingsContext";
import "./index.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { setupStatusBarThemeSync } from "./native/status-bar";

setupStatusBarThemeSync();

// Apply the saved reading theme before React paints so every route keeps the
// same palette and dark mode does not flash back to white during navigation.
const savedDarkMode = localStorage.getItem("ob.bible.isDarkMode") === "true";
document.body.classList.toggle("dark", savedDarkMode);
document.querySelector('meta[name="theme-color"]')?.setAttribute(
  "content",
  savedDarkMode ? "#101116" : "#F6F7F8",
);

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
