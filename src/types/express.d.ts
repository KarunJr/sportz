export type Match = {
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
export {};
declare global {
  namespace Express {
    interface Locals {
      broadcastMatchCreated: (match: Match) => void;
    }
  }
}
