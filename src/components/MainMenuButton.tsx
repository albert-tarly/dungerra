import React from "react";
import { useLocation } from "react-router-dom";
import { goToLauncher, LAUNCHER_URL } from "../utils/launcher";

// Screens outside a game; in a game the game menu offers the same action
const MENU_SCREENS = new Set(["/", "/sessions", "/leaderboard", "/legend"]);

// Desktop app only: returns to the launcher (Solo / Host / Join)
export const MainMenuButton: React.FC = () => {
  const { pathname } = useLocation();
  if (!LAUNCHER_URL || !MENU_SCREENS.has(pathname)) {
    return null;
  }
  return (
    <button type="button" className="main-menu-button" onClick={goToLauncher}>
      ← Main Menu
    </button>
  );
};
