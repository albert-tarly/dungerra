import * as config from "../config";
import { IDifficulty, IDifficultySettings } from "../types/session";

// Mirrors config.ComputeScoreMultiplier on the server, which is authoritative:
// this only previews the multiplier while a custom difficulty is being set up.
export function computeScoreMultiplier(settings: IDifficultySettings): number {
  const enemies =
    (config.SCORE_WEIGHT_SOLDIERS * settings.soldiers_pct +
      config.SCORE_WEIGHT_LIEUTENANTS * settings.lieutenants_pct +
      config.SCORE_WEIGHT_SNIPERS * settings.snipers_pct +
      config.SCORE_WEIGHT_TOWERS * settings.towers_pct) /
    100;
  const fireRate = settings.enemy_fire_rate_pct / 100;
  const lives =
    settings.player_lives > 0
      ? config.SCORE_NEUTRAL_PLAYER_LIVES / settings.player_lives
      : 1;
  const rounded =
    Math.round(
      Math.sqrt(enemies * fireRate * lives) * config.SCORE_MULTIPLIER_STEPS,
    ) / config.SCORE_MULTIPLIER_STEPS;
  return Math.max(
    config.SCORE_MULTIPLIER_MIN,
    Math.min(config.SCORE_MULTIPLIER_MAX, rounded),
  );
}

export function formatScoreMultiplier(multiplier: number): string {
  // Number() drops trailing zeros: 1 → "×1", 0.9 → "×0.9", 0.45 → "×0.45".
  return `×${Number(multiplier.toFixed(2))}`;
}

// Short label for a session's difficulty, e.g. "Easy" or "Custom ×0.9".
export function formatDifficulty(difficulty: IDifficulty): string {
  const label = config.DIFFICULTY_LABELS[difficulty.preset];
  return difficulty.preset === config.DIFFICULTY_PRESETS.CUSTOM
    ? `${label} ${formatScoreMultiplier(difficulty.score_multiplier)}`
    : label;
}
