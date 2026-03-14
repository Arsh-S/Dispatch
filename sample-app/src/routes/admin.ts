import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';

export const adminRouter = Router();

// VULNERABILITY: No auth middleware — anyone can access admin endpoint
adminRouter.get('/admin/users', (req: Request, res: Response) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, email, role FROM users').all();
  res.json(users);
});
