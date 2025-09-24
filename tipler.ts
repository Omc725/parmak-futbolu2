export interface Team {
  name: string;
  abbr: string;
  color1: string;
  color2: string;
}

export type Difficulty = 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard';

export interface Player {
  x: number;
  y: number;
  radius: number;
  width: number;
  speed?: number;
  aiReact?: number;
  hitAnimation: number;
  prevX: number;
  velocityX: number;
}

export interface Ball {
  x: number;
  y: number;
  radius: number;
  speed: number;
  vx: number;
  vy: number;
  spin: number;
  rotation: number;
}

export interface MatchResult {
  team1Score: number;
  team2Score: number;
  team1Penalties?: number;
  team2Penalties?: number;
}

export interface Fixture {
  round: number;
  team1: Team;
  team2: Team;
  result?: MatchResult;
}

export interface LeagueTableRow {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface League {
  fixtures: Fixture[];
  table: LeagueTableRow[];
  currentWeek: number;
}

export interface TournamentNode {
    team1?: Team;
    team2?: Team;
    matchId: number;
    result?: MatchResult;
    winner?: Team;
}

export interface Tournament {
    playerTeam: Team;
    rounds: TournamentNode[][];
    currentRound: number;
    winner?: Team;
}