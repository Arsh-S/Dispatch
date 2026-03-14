import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';
import { authMiddleware } from '../middleware/auth';

export const usersRouter = Router();

// VULNERABILITY: IDOR — no ownership check, returns any user's data
usersRouter.get('/users/:id', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const userId = req.params.id;

  // VULNERABLE: No check that requesting user owns this profile
  const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});
