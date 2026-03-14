import express from 'express';
import cors from 'cors';
import { ordersRouter } from './routes/orders';
import { adminRouter } from './routes/admin';
import { commentsRouter } from './routes/comments';
import { usersRouter } from './routes/users';
import { authRouter } from './routes/auth';
import { getDb } from './db/connection';

const app = express();
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api', ordersRouter);
app.use('/api', adminRouter);
app.use('/api', commentsRouter);
app.use('/api', usersRouter);
app.use('/api', authRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sample app running on port ${PORT}`);
});

export default app;
