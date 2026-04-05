export type IMatch = {
  id: number;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date | null;
  endTime: Date | null;
  status: string;
  homeScore: number;
  awayScore: number;
  createdAt: Date;
};
export interface ICommentary {
  id: number;
  matchId: number;
  minute?: number | null;
  sequence?: number | null;
  period?: string | null;
  eventType?: string | null;
  actor?: string | null;
  team?: string | null;
  message: string;
  metaData?: unknown;
  tags?: string[] | null;
  createdAt: Date;
}
export {};
declare global {
  namespace Express {
    interface Locals {
      broadcastMatchCreated: (match: IMatch) => void;
      broadcastCommentary: (matchId: number, comment: ICommentary) => void;
    }
  }
}
