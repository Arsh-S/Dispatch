import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

export const authRouter = Router();

// VULNERABILITY: Weak JWT secret, no algorithm enforcement
authRouter.post('/login', (req: Request, res: Response) => {
  const db = getDb();
  const { username, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as any;

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // VULNERABLE: Weak secret, stores password in plain text
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token });
});
