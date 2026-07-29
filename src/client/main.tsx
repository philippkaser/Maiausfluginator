import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";
import { RouterProvider } from "./lib/router.tsx";
import { SessionProvider, ToastProvider } from "./lib/store.tsx";

const container = document.getElementById("root");
if (!container) throw new Error("#root fehlt");

createRoot(container).render(
  <StrictMode>
    <ToastProvider>
      <SessionProvider>
        <RouterProvider>
          <App />
        </RouterProvider>
      </SessionProvider>
    </ToastProvider>
  </StrictMode>,
);
