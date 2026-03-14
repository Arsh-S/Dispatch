import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection';
import { authMiddleware } from '../middleware/auth';

export const ordersRouter = Router();

// List orders for current user (safe - uses parameterized query)
ordersRouter.get('/orders', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const userId = (req as any).user.userId;
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ?').all(userId);
  res.json(orders);
});

// VULNERABILITY: SQL Injection via string concatenation (line ~25)
ordersRouter.post('/orders', authMiddleware, (req: Request, res: Response) => {
  const db = getDb();
  const { order_id, quantity } = req.body;

  try {
    // VULNERABLE: Raw SQL concatenation with user input
    const result = db.prepare(`SELECT * FROM orders WHERE id = '${order_id}'`).all();

    // Safe: quantity is parsed as integer
    const qty = parseInt(quantity, 10);

    res.json({ orders: result, quantity: qty });
  } catch (err: any) {
    // VULNERABILITY: Leaks database error details to client
    res.status(500).json({ error: err.message });
  }
});
