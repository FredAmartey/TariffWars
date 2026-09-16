import "./index.css";
import { createRoot } from "react-dom/client";
import App from "./App";

// React 18 warned on every page load that the legacy `render` root was
// unsupported, and React 19 removes it. `createRoot` also turns on automatic
// batching for updates raised outside React events (timers, promises).
const container = document.getElementById("root");
if (!container) {
  throw new Error("TariffWars needs a #root element to mount into.");
}
createRoot(container).render(<App />);
