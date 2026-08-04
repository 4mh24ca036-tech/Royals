import express, {type Router} from 'express';

export function createTestApp(mountPath: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  return app;
}
