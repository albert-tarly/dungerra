import React from "react";
import { useLocation } from "react-router-dom";
import { goHome, HOME_URL } from "../utils/home";

// Screens outside a game; in a game the game menu offers the same action
const MENU_SCREENS = new Set(["/", "/sessions", "/leaderboard", "/legend"]);

// Desktop app, on a LAN host's game: back to the player's own games
export const MainMenuButton: React.FC = () => {
  const { pathname } = useLocation();
  if (!HOME_URL || !MENU_SCREENS.has(pathname)) {
    return null;
  }
  return (
    <button type="button" className="main-menu-button" onClick={goHome}>
      ← Main Menu
    </button>
  );
};
