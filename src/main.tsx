import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "leaflet/dist/leaflet.css";
import "./styles.css";
import "./styles-responsive-task3.css";
import "./styles-responsive-task5.css";
import App from "./App";
import { installAndroidChrome } from "./lib/ui/androidChrome";

installAndroidChrome();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Falta el elemento #root en index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
