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
  max_players?: number;
  is_private?: boolean;
  host: {
    id: string;
    username: string;
    email: string;
  };
}

export interface ICreateSessionRequest {
  name: string;
}

export interface ISessionChunk {
  chunk_id: string;
  x: number;
  y: number;
  objects: Record<string, unknown>;
}
