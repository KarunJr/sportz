import { Request, Response, Router } from "express";
import {
  listMatchQuerySchema,
  matchIdParamSchema,
} from "../validation/matches.js";
import { createCommentarySchema } from "../validation/commentary.js";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { desc, eq } from "drizzle-orm";

export const commentaryRouter = Router({ mergeParams: true });
const MAX_LIMIT = 100;
commentaryRouter.get("/", async (req: Request, res: Response) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({
      error: "Invalid match ID",
      details: paramsResult.error.issues,
    });
  }
  const queryResult = listMatchQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return res.status(400).json({
      error: "Invalid query.",
      details: queryResult.error.issues,
    });
  }
  try {
    const { id: matchId } = paramsResult.data;
    const { limit = 10 } = queryResult.data;
    const safeLimit = Math.min(limit, MAX_LIMIT);

    const results = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(safeLimit);

    res.status(200).json({ data: results });
  } catch (error) {
    console.error("Failed to create commentary", error);
    res.status(500).json({ error: "Failed to fetch commentary" });
  }
});

commentaryRouter.post("/", async (req: Request, res: Response) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({
      error: "Invalid match ID",
      details: paramsResult.error.issues,
    });
  }
  const bodyResult = createCommentarySchema.safeParse(req.body);

  if (!bodyResult.success) {
    return res.status(400).json({
      error: "Invalid commentary payload",
      details: bodyResult.error.issues,
    });
  }

  try {
    const { minute, ...rest } = bodyResult.data;
    const [result] = await db
      .insert(commentary)
      .values({
        matchId: paramsResult.data.id,
        minute,
        ...rest,
      })
      .returning();
      if(res.app.locals.broadcastCommentary){
        res.app.locals.broadcastCommentary(result.matchId, result)
      }
    res.status(201).json({ data: result });
  } catch (error) {
    console.error("Failed to create commentary", error);
    res.status(500).json({ error: "Failed to create commentary" });
  }
});
