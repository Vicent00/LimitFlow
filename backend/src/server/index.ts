import express from 'express';
import { createContext } from './context';
import { appRouter } from './router';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

const app = express();

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); 