import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';
import { authMiddleware } from '../middleware/auth';

export const commentsRouter = Router();

// VULNERABILITY: XSS — reflected input in response body without sanitization
commentsRouter.post('/comments', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { content } = req.body;
  const userId = (req as any).user.userId;

  db.prepare('INSERT INTO comments (user_id, content) VALUES (?, ?)').run(userId, content);

  // VULNERABLE: Reflects user input directly in HTML response
  res.send(`<div class="comment"><p>Comment posted: ${content}</p><p>By user ${userId}</p></div>`);
});

commentsRouter.get('/comments', (req: Request, res: Response) => {
  const db = getDb();
  const comments = db.prepare('SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC').all();
  res.json(comments);
});
