import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { initSockets } from "./sockets";
import { startOverdueTaskJob } from "./jobs/overdueTasks.job";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import clientRoutes from "./routes/client.routes";
import projectRoutes from "./routes/project.routes";
import taskRoutes from "./routes/task.routes";
import notificationRoutes from "./routes/notification.routes";
import dashboardRoutes from "./routes/dashboard.routes";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowed =
        origin === env.clientOrigin ||
        origin.endsWith(".vercel.app");

      callback(allowed ? null : new Error("Not allowed by CORS"), allowed);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(errorHandler);

const httpServer = createServer(app);
initSockets(httpServer);
startOverdueTaskJob();

httpServer.listen(env.port, () => {
  console.log(`API + sockets listening on port ${env.port}`);
});
