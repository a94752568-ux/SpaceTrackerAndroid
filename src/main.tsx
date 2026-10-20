import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Falta el elemento #root en index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
