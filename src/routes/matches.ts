import { Request, Response, Router } from "express";
import {
  createMatchSchema,
  listMatchQuerySchema,
} from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { desc } from "drizzle-orm";

export const matchRouter = Router();

const MAX_LIMIT = 100;
matchRouter.get("/", async (req: Request, res: Response) => {
  const parsed = listMatchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid query.",
      details: JSON.stringify(parsed.error),
    });
  }
  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);
  try {
    const data = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);
    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to list matches",
    });
  }
});

matchRouter.post("/", async (req: Request, res: Response) => {
  const parsed = createMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload.",
      details: JSON.stringify(parsed.error),
    });
  }

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
        homeScore: parsed.data.homeScore ?? 0,
        awayScore: parsed.data.awayScore ?? 0,
      })
      .returning();
    return res.status(201).json({ data: event });
  } catch (error) {
    res.status(500).json({
      error: "Failed to create match.",
      details: JSON.stringify(error),
    });
  }
});
