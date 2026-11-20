import { ILeaderboardEntry } from "../types/leaderboard";
import { HttpClient } from "./HttpClient";

export class LeaderboardManager {
  private static instance: LeaderboardManager;
  private leaderboardData: ILeaderboardEntry[] = [];

  private constructor() {}

  public static getInstance(): LeaderboardManager {
    if (!LeaderboardManager.instance) {
      LeaderboardManager.instance = new LeaderboardManager();
    }
    return LeaderboardManager.instance;
  }

  public async getLeaderboard(): Promise<ILeaderboardEntry[]> {
    const entries = await HttpClient.get<ILeaderboardEntry[]>(
      "/leaderboard/global",
    );
    this.leaderboardData = entries;
    return entries;
  }

  public getCurrentLeaderboard(): ILeaderboardEntry[] {
    return this.leaderboardData;
  }

  public async refreshLeaderboard(): Promise<ILeaderboardEntry[]> {
    return this.getLeaderboard();
  }
}
