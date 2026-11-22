import { DifficultyPreset } from "../config";

export interface ISessionPlayer {
  player_id: string;
  name: string;
  lives: number;
  kills: number;
  money: number;
  is_alive: boolean;
  is_connected: boolean;
  position: {
    x: number;
    y: number;
    rotation: number;
  };
}

export interface ISession {
  id: string;
  name: string;
  startedAt: string;
  endedAt?: string;
  score: number;
  kills: number;
  money: number;
  world_map: Record<string, ISessionChunk>;
  players: Record<string, ISessionPlayer>;
  // Players connected right now (servers before it existed: count is_connected)
  player_count?: number;
  max_players?: number;
  is_private?: boolean;
  host: {
    id: string;
    username: string;
    email: string;
  };
  difficulty: IDifficulty;
}

// Percentages are relative to Hard (100 = Hard). See config.DIFFICULTY_FIELDS.
export interface IDifficultySettings {
  soldiers_pct: number;
  lieutenants_pct: number;
  snipers_pct: number;
  towers_pct: number;
  money_pct: number;
  drop_chance_pct: number;
  wall_chest_pct: number;
  enemy_fire_rate_pct: number;
  player_lives: number;
}

// A session's resolved difficulty as the server stores it.
export interface IDifficulty extends IDifficultySettings {
  preset: DifficultyPreset;
  score_multiplier: number;
}

// A named preset needs no values; "custom" must send all of them.
export interface IDifficultyRequest extends Partial<IDifficultySettings> {
  preset: DifficultyPreset;
}

export interface ICreateSessionRequest {
  name: string;
  difficulty: IDifficultyRequest;
}

export interface ISessionChunk {
  chunk_id: string;
  x: number;
  y: number;
  objects: Record<string, unknown>;
}
