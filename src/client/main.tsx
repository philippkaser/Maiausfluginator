import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";
import { RouterProvider } from "./lib/router.tsx";
import { SessionProvider, ToastProvider } from "./lib/store.tsx";
import { ThemeProvider } from "./lib/theme.tsx";

const container = document.getElementById("root");
if (!container) throw new Error("#root fehlt");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <SessionProvider>
          <RouterProvider>
            <App />
          </RouterProvider>
        </SessionProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
