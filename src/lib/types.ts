export type RankingDirection = "lower" | "higher";

export type GameSlug =
  | "wordle"
  | "maptap"
  | "krillion"
  | "noillirk"
  | "huedle"
  | "flagle"
  | "catfishing"
  | "poople"
  | "wordishingrilliontapdle"
  | "metrodle"
  | "connections"
  | "strands"
  | "custom";

export interface GameConfig {
  slug: GameSlug;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  url: string;
  description: string;
  rankingDirection: RankingDirection;
  unit: string;
  minSubmissions: number;
  axisStart?: number;
}

export interface Player {
  id: string;
  slug: string;
  name: string;
  color: string;
  avatarInitials: string;
  joinedAt: string; // YYYY-MM-DD
}

export interface Submission {
  id: string;
  playerId: string;
  gameSlug: GameSlug;
  leagueDate: string; // YYYY-MM-DD in Europe/London
  puzzleId: string | null;
  rawText: string;
  primaryValue: number; // Main ranking metric
  secondaryValue: number | null; // Tie-breaker 1
  tertiaryValue: number | null; // Tie-breaker 2
  displayResult: string; // e.g. "2/6", "988", "57 moves", "10,857 pts"
  failed: boolean; // e.g. X/6 in Wordle/Flagle
  metadataJson: string; // JSON string of game-specific metadata
  submittedAt: string; // ISO timestamp
  isLate: boolean;
  isCorrected: boolean;
}

export type GameQualificationStatus = "Qualified" | "Pending" | "Excluded";

export interface RankedSubmission extends Submission {
  playerName: string;
  playerSlug: string;
  playerColor: string;
  placement: number; // 1-based competition rank (ties share rank)
  leaguePoints: number; // 0 if game not qualified
}

export interface DailyGameStanding {
  gameSlug: GameSlug;
  leagueDate: string;
  status: GameQualificationStatus;
  isFinalised: boolean;
  submissionCount: number;
  requiredCount: number;
  activePlayers: number; // players with at least one result that day
  totalPlayers: number;
  rankings: RankedSubmission[];
  missingPlayers: Player[];
}

export type PeriodPreset = "today" | "week" | "month" | "all" | "custom";

export interface DatePeriod {
  preset: PeriodPreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string; // e.g. "8–14 Nov"
  prevStartDate: string | null; // Equivalent prior period start
  prevEndDate: string | null; // Equivalent prior period end
  prevLabel: string | null; // e.g. "1–7 Nov"
}

export interface PlayerStandingRow {
  player: Player;
  rank: number;
  previousRank: number | null;
  positionChange: number | null; // positive = moved up (e.g. +1 from 3rd to 2nd)
  totalPoints: number;
  firstPlaces: number;
  gamesPlayed: number; // total submitted in period
  qualifiedGamesPlayed: number; // submitted in qualified games
  averagePlacement: number | null;
  winRate: number | null; // 0 to 1
  pointsPerQualifiedGame: number | null;
  participationRate: number; // 0 to 1
  placementCounts: {
    first: number;
    second: number;
    third: number;
    fourthPlus: number;
  };
  pointsByGame: Record<GameSlug, number>;
}

export interface LeagueInsight {
  id: string;
  type:
    | "biggest_climb"
    | "lead_change"
    | "closest_race"
    | "most_first_places"
    | "best_day"
    | "most_consistent"
    | "strongest_game"
    | "most_competitive_game"
    | "longest_streak"
    | "biggest_upset";
  leadValue: string; // Big Instrument Serif figure: "+3", "1", "2", "7", etc.
  leadColor: string; // Hex token
  text: string; // Direct factual copy
  detail?: string;
  involvedPlayerIds: string[];
}
