import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "@fontsource/source-sans-pro";
import "@fontsource/roboto";

// Import Tailwind styles
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(<App />);
