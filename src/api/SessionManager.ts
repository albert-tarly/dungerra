import {
  ISession,
  ICreateSessionRequest,
  IDifficultyRequest,
} from "../types/session";
import { HttpClient } from "./HttpClient";
import { SocketService } from "./SocketService";
import {
  GameStateDeltaMessage,
  InputMessage,
  MessageType,
  PlayerLeaveMessage,
  PlayerJoinMessage,
  PlayerRespawnMessage,
} from "../types/socketEvents";

export class SessionManager {
  private static instance: SessionManager;
  private currentSession: ISession | null = null;
  private socketService: SocketService;

  private constructor() {
    this.socketService = SocketService.getInstance();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public async listSessions(): Promise<ISession[]> {
    return await HttpClient.get<ISession[]>("/sessions");
  }

  public async startSession(
    sessionName: string,
    difficulty: IDifficultyRequest,
  ): Promise<ISession> {
    const request: ICreateSessionRequest = { name: sessionName, difficulty };
    const session = await HttpClient.post<ISession>("/sessions", request);

    this.currentSession = session;
    this.socketService.connect(session.id);
    return session;
  }

  public async joinSession(sessionId: string): Promise<ISession> {
    const session = await HttpClient.post<ISession>(
      `/sessions/${sessionId}/join`,
    );
    this.currentSession = session;
    this.socketService.connect(session.id);
    return session;
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await HttpClient.delete(`/sessions/${sessionId}`);
    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
      this.socketService.disconnect();
    }
  }

  public endSession(): void {
    if (this.currentSession) {
      this.socketService.disconnect();
      this.currentSession = null;
    }
  }

  public getCurrentSession(): ISession | null {
    return this.currentSession;
  }

  public notifyRespawn(): void {
    if (!this.currentSession) {
      console.warn("Attempting to notify about respawn without active session");
      return;
    }

    this.socketService.emit({
      type: MessageType.PLAYER_RESPAWN,
      payload: {
        oneofKind: "playerRespawn",
        playerRespawn: PlayerRespawnMessage.create(),
      },
    });
  }

  notifyInput(message: InputMessage): void {
    this.socketService.emit({
      type: MessageType.INPUT,
      payload: {
        oneofKind: "input",
        input: message,
      },
    });
  }

  public onGameStateDelta(
    callback: (changeset: GameStateDeltaMessage) => void,
  ): void {
    this.socketService.onGameStateDelta(callback);
  }

  public onPlayerJoined(callback: (message: PlayerJoinMessage) => void): void {
    this.socketService.onPlayerJoined(callback);
  }

  public onPlayerLeft(callback: (message: PlayerLeaveMessage) => void): void {
    this.socketService.onPlayerLeft(callback);
  }
}
