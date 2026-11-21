import prisma from "../db/prisma.js";
import * as emailModule from "../utils/email.js";

const transporter = emailModule.default || emailModule.transporter;

// ======================================================
// ORDER SCHEDULER CONFIGURATION
// ======================================================

const POLL_INTERVAL_MS = 60 * 1000;
const REMINDER_AFTER_MS = 30 * 60 * 1000;
const AUTO_CANCEL_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_EMAIL_ATTEMPTS = 8;
const EMAIL_RETRY_BASE_MS = 60 * 1000;
const STALE_PROCESSING_AFTER_MS = 5 * 60 * 1000;

let schedulerInterval = null;
let schedulerRunning = false;

const getOrderLink = (orderId) => {
  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "");
  return frontendUrl ? `${frontendUrl}/orders/${orderId}` : null;
};

const getOrderRecipients = (order) => {
  const recipients = [
    {
      userId: order.user.id,
      email: order.user.email,
      name: order.user.name || "ShopEase Customer",
      role: "customer",
    },
    {
      userId: order.shop.owner.id,
      email: order.shop.owner.email,
      name: order.shop.owner.name || "Shop Owner",
      role: "shop owner",
    },
  ];

  // Avoid duplicate notification/email jobs if the same account owns the shop.

  return recipients.filter(
    (recipient, index, all) =>
      all.findIndex((item) => item.userId === recipient.userId) === index
  );
};

const createOrderNotificationsAndEmailJobs = async ({
  tx,
  order,
  notificationType,
  notificationTitle,
  notificationMessage,
  emailJobType,
}) => {
  const recipients = getOrderRecipients(order);
  const orderLink = getOrderLink(order.id);

  await tx.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.userId,
      orderId: order.id,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      link: orderLink,
      isRead: false,
    })),
    skipDuplicates: true,
  });

  const emailJobs = recipients
    .filter((recipient) => recipient.email)
    .map((recipient) => ({
      orderId: order.id,
      recipientUserId: recipient.userId,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      type: emailJobType,
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: new Date(),
    }));

  if (emailJobs.length) {
    await tx.orderEmailJob.createMany({
      data: emailJobs,
      skipDuplicates: true,
    });
  }
};

// ======================================================
// 30-MINUTE PENDING ORDER REMINDERS
// ======================================================

const processPendingReminders = async () => {
  const reminderCutoff = new Date(Date.now() - REMINDER_AFTER_MS);

  const orders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentStatus: "PENDING",
      createdAt: { lte: reminderCutoff },
      notifications: {
        none: { type: "ORDER_PENDING_REMINDER" },
      },
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  for (const candidate of orders) {
    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: candidate.id },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            shop: {
              include: {
                owner: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        });

        if (
          !order ||
          order.status !== "PENDING" ||
          order.paymentStatus !== "PENDING" ||
          order.createdAt > reminderCutoff
        ) {
          return;
        }

        await createOrderNotificationsAndEmailJobs({
          tx,
          order,
          notificationType: "ORDER_PENDING_REMINDER",
          notificationTitle: "Pending order reminder",
          notificationMessage: `Order #${order.id} is still pending. Please complete the required payment or contact the shop owner.`,
          emailJobType: "PENDING_REMINDER",
        });
      });
    } catch (error) {
      console.error(
        `[ORDER SCHEDULER] Reminder processing failed for order #${candidate.id}:`,
        error
      );
    }
  }
};

// ======================================================
// 24-HOUR AUTOMATIC CANCELLATION
// Only unpaid PENDING orders are eligible.
// Stock is restored in the same transaction as cancellation.
// ======================================================

const processExpiredOrders = async () => {
  const cancellationCutoff = new Date(Date.now() - AUTO_CANCEL_AFTER_MS);

  const orders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentStatus: { in: ["PENDING", "FAILED"] },
      createdAt: { lte: cancellationCutoff },
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  for (const candidate of orders) {
    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: candidate.id },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            shop: {
              include: {
                owner: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
            items: true,
          },
        });

        if (
          !order ||
          order.status !== "PENDING" ||
          !["PENDING", "FAILED"].includes(order.paymentStatus) ||
          order.createdAt > cancellationCutoff
        ) {
          return;
        }

        // Compare-and-set: only one worker can cancel and restore stock.

        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING",
            paymentStatus: order.paymentStatus,
            createdAt: { lte: cancellationCutoff },
          },
          data: { status: "CANCELLED" },
        });

        if (updated.count !== 1) return;

        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        await createOrderNotificationsAndEmailJobs({
          tx,
          order,
          notificationType: "ORDER_AUTO_CANCELLED",
          notificationTitle: "Order automatically cancelled",
          notificationMessage: `Order #${order.id} was automatically cancelled because it remained unpaid for 24 hours. Product stock has been restored.`,
          emailJobType: "AUTO_CANCELLATION",
        });
      });
    } catch (error) {
      console.error(
        `[ORDER SCHEDULER] Auto-cancellation failed for order #${candidate.id}:`,
        error
      );
    }
  }
};

// ======================================================
// EMAIL CONTENT
// ======================================================

const buildEmail = ({ job, order }) => {
  const orderLink = getOrderLink(order.id);
  const linkHtml = orderLink
    ? `<p><a href="${orderLink}">View order details</a></p>`
    : "";

  let subject;
  let heading;
  let message;

  if (job.type === "AUTO_CANCELLATION") {
    subject = `ShopEase order #${order.id} automatically cancelled`;
    heading = "Your order was automatically cancelled";
    message = `Order #${order.id} remained unpaid for 24 hours and was automatically cancelled. The reserved product stock has been restored.`;
  } else if (job.type === "CUSTOMER_CANCELLATION") {
    subject = `ShopEase order #${order.id} cancelled by customer`;
    heading = "Order cancelled by customer";
    message = `Order #${order.id} was cancelled by the customer. The reserved product stock has been restored.`;
  } else {
    subject = `Reminder: ShopEase order #${order.id} is pending`;
    heading = "Your order is still pending";
    message = `Order #${order.id} is still pending. Please review the order and complete the required payment or contact the shop owner.`;
  }

  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2>${heading}</h2>
        <p>Hello ${job.recipientName || "ShopEase User"},</p>
        <p>${message}</p>
        <p><strong>Order number:</strong> #${order.id}</p>
        <p><strong>Shop:</strong> ${order.shop?.name || "ShopEase Shop"}</p>
        ${linkHtml}
        <p>Thank you for using ShopEase.</p>
      </div>
    `,
    text: `${heading}\n\nHello ${job.recipientName || "ShopEase User"},\n\n${message}\n\nOrder number: #${order.id}\nShop: ${order.shop?.name || "ShopEase Shop"}${orderLink ? `\nView order: ${orderLink}` : ""}\n\nThank you for using ShopEase.`,
  };
};

// ======================================================
// EMAIL QUEUE
// Includes retry, stale-job recovery, and duplicate safety.
// ======================================================

const reclaimStaleEmailJobs = async () => {
  const staleCutoff = new Date(Date.now() - STALE_PROCESSING_AFTER_MS);

  await prisma.orderEmailJob.updateMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lte: staleCutoff },
    },
    data: {
      status: "PENDING",
      nextAttemptAt: new Date(),
      lastError: "Recovered stale email job after interrupted processing.",
    },
  });
};

const claimNextEmailJob = async () => {
  const now = new Date();

  const candidate = await prisma.orderEmailJob.findFirst({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
    },
    orderBy: [
      { nextAttemptAt: "asc" },
      { createdAt: "asc" },
    ],
  });

  if (!candidate) return null;

  const claimed = await prisma.orderEmailJob.updateMany({
    where: {
      id: candidate.id,
      status: "PENDING",
      nextAttemptAt: { lte: now },
    },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
    },
  });

  if (claimed.count !== 1) return null;

  return prisma.orderEmailJob.findUnique({
    where: { id: candidate.id },
  });
};

const processPendingEmailQueue = async () => {
  await reclaimStaleEmailJobs();

  // Limit work per scheduler cycle to avoid keeping the process busy forever.

  for (let index = 0; index < 25; index++) {
    const job = await claimNextEmailJob();
    if (!job) break;

    try {
      const order = await prisma.order.findUnique({
        where: { id: job.orderId },
        include: {
          shop: { select: { id: true, name: true } },
        },
      });

      if (!order) {
        await prisma.orderEmailJob.updateMany({
          where: { id: job.id, status: "PROCESSING" },
          data: {
            status: "FAILED",
            lastError: "Order no longer exists; email job cannot be processed.",
          },
        });
        continue;
      }

      // A queued reminder must not be sent after the order is confirmed,
      // cancelled, paid, or otherwise no longer pending and unpaid.

      if (
        job.type === "PENDING_REMINDER" &&
        (order.status !== "PENDING" || order.paymentStatus !== "PENDING")
      ) {
        await prisma.orderEmailJob.updateMany({
          where: { id: job.id, status: "PROCESSING" },
          data: {
            status: "SENT",
            sentAt: new Date(),
            lastError: "Reminder skipped because the order is no longer pending and unpaid.",
          },
        });
        continue;
      }

      const email = buildEmail({ job, order });

      if (!transporter || typeof transporter.sendMail !== "function") {
        throw new Error(
          "Email transporter is not configured. Check the export in src/utils/email.js."
        );
      }

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: job.recipientEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });

      await prisma.orderEmailJob.updateMany({
        where: { id: job.id, status: "PROCESSING" },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const errorMessage = error?.message || "Unknown email delivery error.";
      const shouldRetry = job.attempts < MAX_EMAIL_ATTEMPTS;
      const retryDelay = EMAIL_RETRY_BASE_MS * 2 ** Math.max(0, job.attempts - 1);

      await prisma.orderEmailJob.updateMany({
        where: { id: job.id, status: "PROCESSING" },
        data: {
          status: shouldRetry ? "PENDING" : "FAILED",
          nextAttemptAt: shouldRetry
            ? new Date(Date.now() + retryDelay)
            : job.nextAttemptAt,
          lastError: errorMessage.slice(0, 2000),
        },
      });

      console.error(
        `[ORDER SCHEDULER] Email job ${job.id} failed (attempt ${job.attempts}/${MAX_EMAIL_ATTEMPTS}):`,
        error
      );
    }
  }
};

// ======================================================
// SCHEDULER RUNNER
// ======================================================

export const runOrderScheduler = async () => {
  if (schedulerRunning) return;

  schedulerRunning = true;

  try {
    await processExpiredOrders();
    await processPendingReminders();
    await processPendingEmailQueue();
  } catch (error) {
    console.error("[ORDER SCHEDULER] Unexpected scheduler error:", error);
  } finally {
    schedulerRunning = false;
  }
};

export const startOrderScheduler = () => {
  if (schedulerInterval) {
    console.log("[ORDER SCHEDULER] Already running.");
    return;
  }

  console.log("[ORDER SCHEDULER] Started.");

  // Run once immediately, then poll every minute.

  runOrderScheduler();

  schedulerInterval = setInterval(() => {
    runOrderScheduler();
  }, POLL_INTERVAL_MS);
};

export const stopOrderScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }

  console.log("[ORDER SCHEDULER] Stopped.");
};