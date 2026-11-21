import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
// Bundled rather than loaded from Google Fonts: the desktop app plays offline
import "./assets/fonts/fonts.css";
import "./styles.css";
import { Game } from "./utils/Game";

// Preload game resources
Game.loadResources().catch(console.error);

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
