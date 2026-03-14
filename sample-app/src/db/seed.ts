import { getDb } from './connection';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

const db = getDb();

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed users
const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)');
insertUser.run('admin', 'admin@example.com', 'admin123', 'admin');
insertUser.run('alice', 'alice@example.com', 'password123', 'user');
insertUser.run('bob', 'bob@example.com', 'password456', 'user');

// Seed orders
const insertOrder = db.prepare('INSERT OR IGNORE INTO orders (user_id, product, quantity, total) VALUES (?, ?, ?, ?)');
insertOrder.run(2, 'Widget A', 3, 29.97);
insertOrder.run(2, 'Widget B', 1, 15.99);
insertOrder.run(3, 'Widget C', 2, 49.98);

// Seed comments
const insertComment = db.prepare('INSERT OR IGNORE INTO comments (user_id, content) VALUES (?, ?)');
insertComment.run(2, 'Great product!');
insertComment.run(3, 'Fast shipping.');

// Generate test JWT token
const testToken = jwt.sign(
  { userId: 2, username: 'alice', role: 'user' },
  JWT_SECRET,
  { expiresIn: '24h' }
);

fs.writeFileSync(
  path.join(__dirname, '../../test-token.txt'),
  testToken
);

console.log('Database seeded successfully');
console.log(`Test token written to test-token.txt`);
