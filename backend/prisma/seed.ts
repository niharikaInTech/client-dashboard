import { PrismaClient, Priority, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@velozity.dev" },
    update: {},
    create: { name: "Asha Admin", email: "admin@velozity.dev", passwordHash, role: "ADMIN" },
  });

  const pmRavi = await prisma.user.upsert({
    where: { email: "ravi.pm@velozity.dev" },
    update: {},
    create: { name: "Ravi Shah", email: "ravi.pm@velozity.dev", passwordHash, role: "PM" },
  });

  const pmMeera = await prisma.user.upsert({
    where: { email: "meera.pm@velozity.dev" },
    update: {},
    create: { name: "Meera Nair", email: "meera.pm@velozity.dev", passwordHash, role: "PM" },
  });

  const devNames = [
    ["Karan Verma", "karan.dev@velozity.dev"],
    ["Priya Singh", "priya.dev@velozity.dev"],
    ["Arjun Rao", "arjun.dev@velozity.dev"],
    ["Sana Khan", "sana.dev@velozity.dev"],
  ] as const;

  const developers = [];
  for (const [name, email] of devNames) {
    developers.push(
      await prisma.user.upsert({
        where: { email },
        update: {},
        create: { name, email, passwordHash, role: "DEVELOPER" },
      })
    );
  }
  const [karan, priya, arjun, sana] = developers;

  const clientA = await prisma.client.upsert({
    where: { id: "seed-client-atlas" },
    update: {},
    create: { id: "seed-client-atlas", name: "Atlas Retail Co.", contactEmail: "ops@atlasretail.com" },
  });
  const clientB = await prisma.client.upsert({
    where: { id: "seed-client-northwind" },
    update: {},
    create: { id: "seed-client-northwind", name: "Northwind Traders", contactEmail: "pm@northwind.com" },
  });
  const clientC = await prisma.client.upsert({
    where: { id: "seed-client-lumen" },
    update: {},
    create: { id: "seed-client-lumen", name: "Lumen Health", contactEmail: "it@lumenhealth.io" },
  });

  // Wipe task/project data so the seed is repeatable in dev without
  // duplicate rows piling up on every run.
  await prisma.notification.deleteMany({});
  await prisma.activityLog.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});

  const projectAtlas = await prisma.project.create({
    data: {
      name: "Atlas Storefront Revamp",
      description: "Redesign of the customer-facing storefront and checkout flow.",
      clientId: clientA.id,
      managerId: pmRavi.id,
    },
  });

  const projectNorthwind = await prisma.project.create({
    data: {
      name: "Northwind Inventory Sync",
      description: "Real-time inventory sync between warehouses and the storefront.",
      clientId: clientB.id,
      managerId: pmRavi.id,
    },
  });

  const projectLumen = await prisma.project.create({
    data: {
      name: "Lumen Patient Portal",
      description: "Self-service patient portal with appointment scheduling.",
      clientId: clientC.id,
      managerId: pmMeera.id,
    },
  });

  const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  type TaskSeed = {
    title: string;
    description: string;
    assigneeId: string;
    status: TaskStatus;
    priority: Priority;
    dueDate: Date | null;
    overdue?: boolean;
  };

  async function createProjectTasks(projectId: string, tasks: TaskSeed[]) {
    const created = [];
    for (const t of tasks) {
      created.push(
        await prisma.task.create({
          data: {
            projectId,
            title: t.title,
            description: t.description,
            assigneeId: t.assigneeId,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            isOverdue: Boolean(t.overdue),
          },
        })
      );
    }
    return created;
  }

  const atlasTasks = await createProjectTasks(projectAtlas.id, [
    {
      title: "Build product listing grid",
      description: "Responsive grid with lazy-loaded images.",
      assigneeId: karan.id,
      status: "DONE",
      priority: "MEDIUM",
      dueDate: daysFromNow(-10),
    },
    {
      title: "Checkout payment integration",
      description: "Wire up the new payment gateway SDK.",
      assigneeId: karan.id,
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      dueDate: daysFromNow(3),
    },
    {
      title: "Cart abandonment emails",
      description: "Trigger email 1 hour after cart is abandoned.",
      assigneeId: priya.id,
      status: "TODO",
      priority: "LOW",
      dueDate: daysFromNow(9),
    },
    {
      title: "Fix mobile nav overlay bug",
      description: "Overlay stays open after route change on iOS Safari.",
      assigneeId: priya.id,
      status: "IN_REVIEW",
      priority: "HIGH",
      dueDate: daysFromNow(1),
    },
    {
      title: "Migrate legacy discount codes",
      description: "Backfill discount codes from the old promotions table.",
      assigneeId: karan.id,
      status: "TODO",
      priority: "MEDIUM",
      dueDate: daysFromNow(-2),
      overdue: true,
    },
  ]);

  const northwindTasks = await createProjectTasks(projectNorthwind.id, [
    {
      title: "Warehouse webhook listener",
      description: "Consume stock-level webhooks from the WMS.",
      assigneeId: arjun.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: daysFromNow(4),
    },
    {
      title: "Reconciliation report job",
      description: "Nightly job comparing WMS stock vs. storefront stock.",
      assigneeId: arjun.id,
      status: "TODO",
      priority: "MEDIUM",
      dueDate: daysFromNow(6),
    },
    {
      title: "Low-stock alert thresholds",
      description: "Configurable per-SKU low-stock thresholds.",
      assigneeId: sana.id,
      status: "DONE",
      priority: "LOW",
      dueDate: daysFromNow(-5),
    },
    {
      title: "Multi-warehouse routing logic",
      description: "Route orders to the nearest warehouse with stock.",
      assigneeId: sana.id,
      status: "IN_REVIEW",
      priority: "CRITICAL",
      dueDate: daysFromNow(2),
    },
    {
      title: "Vendor CSV import fix",
      description: "Import fails silently on malformed CSV rows.",
      assigneeId: arjun.id,
      status: "TODO",
      priority: "HIGH",
      dueDate: daysFromNow(-1),
      overdue: true,
    },
  ]);

  const lumenTasks = await createProjectTasks(projectLumen.id, [
    {
      title: "Appointment booking calendar",
      description: "Drag-to-book calendar with provider availability.",
      assigneeId: priya.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: daysFromNow(5),
    },
    {
      title: "HIPAA audit log for record access",
      description: "Log every read of a patient record with actor + timestamp.",
      assigneeId: sana.id,
      status: "TODO",
      priority: "CRITICAL",
      dueDate: daysFromNow(7),
    },
    {
      title: "Patient intake form builder",
      description: "Configurable intake form fields per clinic.",
      assigneeId: karan.id,
      status: "IN_REVIEW",
      priority: "MEDIUM",
      dueDate: daysFromNow(2),
    },
    {
      title: "SMS appointment reminders",
      description: "Send SMS 24h before an appointment.",
      assigneeId: arjun.id,
      status: "DONE",
      priority: "LOW",
      dueDate: daysFromNow(-8),
    },
    {
      title: "Provider schedule import",
      description: "Bulk-import provider schedules from CSV.",
      assigneeId: priya.id,
      status: "TODO",
      priority: "MEDIUM",
      dueDate: daysFromNow(10),
    },
  ]);

  // Pre-existing activity so the feed isn't empty on first load, and a
  // matching notification for anything that ended up assigned or in review.
  const seedActivity = [
    { task: atlasTasks[0], user: karan, from: "IN_PROGRESS" as const, to: "DONE" as const, when: -9 },
    { task: atlasTasks[1], user: karan, from: "TODO" as const, to: "IN_PROGRESS" as const, when: -2 },
    { task: atlasTasks[3], user: priya, from: "IN_PROGRESS" as const, to: "IN_REVIEW" as const, when: -1 },
    { task: northwindTasks[2], user: sana, from: "IN_REVIEW" as const, to: "DONE" as const, when: -4 },
    { task: northwindTasks[3], user: sana, from: "IN_PROGRESS" as const, to: "IN_REVIEW" as const, when: -0.5 },
    { task: lumenTasks[2], user: karan, from: "IN_PROGRESS" as const, to: "IN_REVIEW" as const, when: -0.2 },
    { task: lumenTasks[3], user: arjun, from: "IN_REVIEW" as const, to: "DONE" as const, when: -7 },
  ];

  for (const entry of seedActivity) {
    await prisma.activityLog.create({
      data: {
        taskId: entry.task.id,
        projectId: entry.task.projectId,
        userId: entry.user.id,
        fromStatus: entry.from,
        toStatus: entry.to,
        createdAt: daysFromNow(entry.when),
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: karan.id,
        type: "TASK_ASSIGNED",
        message: `You were assigned to "${atlasTasks[1].title}"`,
        relatedTaskId: atlasTasks[1].id,
        createdAt: daysFromNow(-3),
      },
      {
        userId: pmRavi.id,
        type: "TASK_IN_REVIEW",
        message: `"${atlasTasks[3].title}" was moved to In Review`,
        relatedTaskId: atlasTasks[3].id,
        createdAt: daysFromNow(-1),
      },
      {
        userId: pmRavi.id,
        type: "TASK_IN_REVIEW",
        message: `"${northwindTasks[3].title}" was moved to In Review`,
        relatedTaskId: northwindTasks[3].id,
        createdAt: daysFromNow(-0.5),
      },
      {
        userId: pmMeera.id,
        type: "TASK_IN_REVIEW",
        message: `"${lumenTasks[2].title}" was moved to In Review`,
        relatedTaskId: lumenTasks[2].id,
        createdAt: daysFromNow(-0.2),
      },
      {
        userId: sana.id,
        type: "TASK_ASSIGNED",
        message: `You were assigned to "${lumenTasks[1].title}"`,
        relatedTaskId: lumenTasks[1].id,
        createdAt: daysFromNow(-6),
      },
    ],
  });

  console.log("Seed complete.");
  console.log(`Admin      admin@velozity.dev / ${PASSWORD}`);
  console.log(`PM         ravi.pm@velozity.dev / ${PASSWORD}`);
  console.log(`PM         meera.pm@velozity.dev / ${PASSWORD}`);
  console.log(`Developer  karan.dev@velozity.dev / ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
