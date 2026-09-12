import cron from "node-cron";
import { prisma } from "../lib/prisma";

// Runs independently of any page load, per the spec. node-cron is enough
// here because this is a single lightweight in-process sweep with no need
// for retries, distributed workers, or a job dashboard - reaching for
// Bull/BullMQ would mean standing up Redis just to run one query a minute.
export function startOverdueTaskJob() {
  const task = cron.schedule("*/5 * * * *", async () => {
    const result = await prisma.task.updateMany({
      where: {
        isOverdue: false,
        status: { not: "DONE" },
        dueDate: { lt: new Date() },
      },
      data: { isOverdue: true },
    });

    if (result.count > 0) {
      console.log(`[overdue-job] flagged ${result.count} task(s) as overdue`);
    }
  });

  task.start();
  return task;
}
