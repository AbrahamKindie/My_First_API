
import prisma from "../db/prisma.js";
import transporter from "../utils/email.js";

// ==========================================
// EMAIL CONFIGURATION
// ==========================================

const frontendUrl = (
  process.env.FRONTEND_URL || "http://localhost:5173"
)
  .trim()
  .replace(/\/+$/, "");

const emailFrom = process.env.EMAIL_FROM
  ? process.env.EMAIL_FROM
  : process.env.EMAIL_USER
    ? `"ShopEase Support" <${process.env.EMAIL_USER}>`
    : undefined;

const MAX_EMAIL_ATTEMPTS = 5;
const EMAIL_BATCH_SIZE = 10;
const EMAIL_WORKER_INTERVAL = 15 * 1000;
const STALE_SENDING_MINUTES = 10;

// ==========================================
// HTML ESCAPING
// ==========================================

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// ==========================================
// EMAIL TEMPLATE
// ==========================================

const createSupportEmailTemplate = ({
  recipientName,
  heading,
  intro,
  ticketNumber,
  ticketSubject,
  status,
  message,
  messageLabel = "Message",
  actionUrl,
  actionLabel = "View Support Ticket",
}) => {
  const safeName = escapeHtml(recipientName || "Customer");
  const safeHeading = escapeHtml(heading);
  const safeIntro = escapeHtml(intro);
  const safeTicketNumber = escapeHtml(ticketNumber);
  const safeTicketSubject = escapeHtml(ticketSubject);
  const safeStatus = escapeHtml(status || "");
  const safeMessage = escapeHtml(message || "");
  const safeMessageLabel = escapeHtml(messageLabel);

  const statusSection = status
    ? `
      <p style="margin:8px 0;">
        <strong>Status:</strong> ${safeStatus}
      </p>
    `
    : "";

  const messageSection = message
    ? `
      <div style="
        background:#f8fafc;
        border:1px solid #e2e8f0;
        border-radius:8px;
        padding:16px;
        margin:20px 0;
        line-height:1.7;
        white-space:pre-wrap;
        overflow-wrap:break-word;
      ">
        <p style="margin:0 0 10px;font-weight:bold;">
          ${safeMessageLabel}
        </p>
        ${safeMessage}
      </div>
    `
    : "";

  const actionSection = actionUrl
    ? `
      <div style="margin:28px 0;text-align:center;">
        <a
          href="${escapeHtml(actionUrl)}"
          style="
            background:#2563eb;
            color:#ffffff;
            padding:13px 24px;
            text-decoration:none;
            border-radius:7px;
            display:inline-block;
            font-weight:bold;
          "
        >
          ${escapeHtml(actionLabel)}
        </a>
      </div>
    `
    : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>${safeHeading} | ShopEase Support</title>
      </head>

      <body style="
        font-family:Arial,Helvetica,sans-serif;
        color:#1e293b;
        background:#f1f5f9;
        padding:24px 12px;
        margin:0;
      ">
        <div style="
          max-width:600px;
          margin:0 auto;
          background:#ffffff;
          padding:32px;
          border-radius:12px;
        ">

          <h2 style="
            color:#2563eb;
            margin-top:0;
            margin-bottom:24px;
          ">
            ShopEase Support
          </h2>

          <p>Hello ${safeName},</p>

          <h3 style="color:#0f172a;">
            ${safeHeading}
          </h3>

          <p style="line-height:1.7;">
            ${safeIntro}
          </p>

          <div style="
            background:#f8fafc;
            border:1px solid #e2e8f0;
            border-radius:8px;
            padding:16px;
            margin:20px 0;
          ">
            <p style="margin:8px 0;">
              <strong>Ticket Number:</strong>
              ${safeTicketNumber}
            </p>

            <p style="margin:8px 0;">
              <strong>Subject:</strong>
              ${safeTicketSubject}
            </p>

            ${statusSection}
          </div>

          ${messageSection}

          ${actionSection}

          <p style="
            color:#64748b;
            font-size:13px;
            line-height:1.7;
            margin-top:28px;
          ">
            If you need further assistance, please visit your
            ShopEase support ticket to continue the conversation.
          </p>

          <p>
            Best regards,<br />
            <strong>ShopEase Support Team</strong>
          </p>

          <hr style="
            border:none;
            border-top:1px solid #e2e8f0;
            margin:24px 0;
          " />

          <p style="
            color:#94a3b8;
            font-size:12px;
            text-align:center;
          ">
            This is an automatic notification from ShopEase.
            Please do not reply directly to this email.
          </p>

        </div>
      </body>
    </html>
  `;
};

// ==========================================
// QUEUE SUPPORT EMAIL
// ==========================================

export const queueSupportEmail = async ({
  ticketId = null,
  recipientEmail,
  recipientName = null,
  subject,
  heading,
  intro,
  ticketNumber,
  ticketSubject,
  status = null,
  message = null,
  messageLabel = "Message",
  actionUrl = null,
  actionLabel = "View Support Ticket",
  dedupeKey,
}) => {
  if (
    typeof recipientEmail !== "string" ||
    !recipientEmail.trim()
  ) {
    throw new Error("A recipient email address is required.");
  }

  if (typeof subject !== "string" || !subject.trim()) {
    throw new Error("An email subject is required.");
  }

  if (typeof dedupeKey !== "string" || !dedupeKey.trim()) {
    throw new Error("A support email dedupeKey is required.");
  }

  const html = createSupportEmailTemplate({
    recipientName,
    heading,
    intro,
    ticketNumber,
    ticketSubject,
    status,
    message,
    messageLabel,
    actionUrl,
    actionLabel,
  });

  const text = [
    `Hello ${recipientName || "Customer"},`,
    "",
    heading,
    intro,
    "",
    `Ticket Number: ${ticketNumber}`,
    `Subject: ${ticketSubject}`,
    status ? `Status: ${status}` : "",
    message ? `\n${messageLabel}:\n${message}` : "",
    actionUrl ? `\nView Support Ticket: ${actionUrl}` : "",
    "",
    "Best regards,",
    "ShopEase Support Team",
    "",
    "This is an automatic notification from ShopEase.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    return await prisma.supportEmailJob.create({
      data: {
        ticketId,
        recipientEmail: recipientEmail.trim(),
        recipientName,
        subject: subject.trim(),
        html,
        text,
        dedupeKey,
        maxAttempts: MAX_EMAIL_ATTEMPTS,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return null;
    }

    throw error;
  }
};

// ==========================================
// GET TICKET EMAIL RECIPIENT
// ==========================================

export const getSupportTicketRecipient = (ticket) => {
  if (ticket.requester) {
    return {
      name: ticket.requester.name,
      email: ticket.requester.email,
    };
  }

  return {
    name: ticket.guestName,
    email: ticket.guestEmail,
  };
};

// ==========================================
// GET SUPPORT TICKET URL
// ==========================================

export const getSupportTicketUrl = (
  ticket,
  guestAccessToken = null
) => {
  if (guestAccessToken) {
    const token = encodeURIComponent(guestAccessToken);

    return `${frontendUrl}/support/ticket/${ticket.id}?token=${token}`;
  }

  return `${frontendUrl}/my-account/support/${ticket.id}`;
};

// ==========================================
// 1. TICKET RECEIVED EMAIL
// CUSTOMER / GUEST ONLY
// ==========================================

export const queueSupportTicketCreatedEmail = async (
  ticket,
  guestAccessToken = null
) => {
  const recipient = getSupportTicketRecipient(ticket);

  if (!recipient.email) {
    throw new Error("Support ticket has no recipient email.");
  }

  return queueSupportEmail({
    ticketId: ticket.id,
    recipientEmail: recipient.email,
    recipientName: recipient.name,

    subject:
      `ShopEase Support – We Received Your Request (${ticket.ticketNumber})`,

    heading: "We've received your support request!",

    intro:
      "Thank you for contacting ShopEase. Your support request has been successfully received. Our support team will review your request and get back to you as soon as possible.",

    ticketNumber: ticket.ticketNumber,
    ticketSubject: ticket.subject,
    status: ticket.status,

    actionUrl: getSupportTicketUrl(ticket, guestAccessToken),

    dedupeKey: `support-ticket-created-${ticket.id}`,
  });
};

// ==========================================
// 2. NEW SUPPORT REPLY EMAIL
// ==========================================

export const queueSupportReplyEmail = async ({
  ticket,
  message,
  recipient,
  messageId,
  guestAccessToken = null,
}) => {
  if (!recipient?.email) {
    throw new Error("Reply email recipient is missing.");
  }

  if (!messageId) {
    throw new Error("Reply message ID is required.");
  }

  return queueSupportEmail({
    ticketId: ticket.id,
    recipientEmail: recipient.email,
    recipientName: recipient.name,

    subject:
      `ShopEase Support – New Reply to ${ticket.ticketNumber}`,

    heading: "You have a new support reply",

    intro:
      "Our ShopEase Support Team has replied to your support request. Please review the response below.",

    ticketNumber: ticket.ticketNumber,
    ticketSubject: ticket.subject,
    status: ticket.status,

    message,
    messageLabel: "Support Reply",

    actionUrl: getSupportTicketUrl(ticket, guestAccessToken),

    dedupeKey: `support-ticket-reply-${messageId}`,
  });
};

// ==========================================
// 3. TICKET RESOLVED EMAIL
// ==========================================

export const queueSupportTicketResolvedEmail = async ({
  ticket,
  recipient,
  resolutionSummary = null,
  guestAccessToken = null,
}) => {
  if (!recipient?.email) {
    throw new Error("Resolution email recipient is missing.");
  }

  return queueSupportEmail({
    ticketId: ticket.id,
    recipientEmail: recipient.email,
    recipientName: recipient.name,

    subject:
      `ShopEase Support – Your Ticket Has Been Resolved (${ticket.ticketNumber})`,

    heading: "Your support ticket has been resolved",

    intro:
      "Good news! Our support team has resolved your support request. Please review the resolution details below. If you still need assistance, you can visit your support ticket.",

    ticketNumber: ticket.ticketNumber,
    ticketSubject: ticket.subject,
    status: ticket.status || "RESOLVED",

    message: resolutionSummary,
    messageLabel: "Resolution Summary",

    actionUrl: getSupportTicketUrl(ticket, guestAccessToken),

    actionLabel: "View Resolved Ticket",

    dedupeKey: `support-ticket-resolved-${ticket.id}`,
  });
};

// ==========================================
// 4. TICKET REJECTED EMAIL
// ==========================================

export const queueSupportTicketRejectedEmail = async ({
  ticket,
  recipient,
  rejectionDescription,
  guestAccessToken = null,
}) => {
  if (!recipient?.email) {
    throw new Error("Rejection email recipient is missing.");
  }

  return queueSupportEmail({
    ticketId: ticket.id,
    recipientEmail: recipient.email,
    recipientName: recipient.name,

    subject:
      `ShopEase Support – Update on Your Request (${ticket.ticketNumber})`,

    heading: "Update on your support request",

    intro:
      "Our support team has reviewed your request. Unfortunately, we are unable to proceed with it. Please review the explanation below.",

    ticketNumber: ticket.ticketNumber,
    ticketSubject: ticket.subject,
    status: ticket.status || "REJECTED",

    message: rejectionDescription,
    messageLabel: "Explanation",

    actionUrl: getSupportTicketUrl(ticket, guestAccessToken),

    actionLabel: "View Support Ticket",

    dedupeKey: `support-ticket-rejected-${ticket.id}`,
  });
};

// ==========================================
// 5. TICKET STATUS UPDATED EMAIL
// ALSO SUPPORTS REOPENED / IN PROGRESS / CLOSED
// ==========================================

export const queueSupportStatusEmail = async ({
  ticket,
  recipient,
  previousStatus,
  guestAccessToken = null,
}) => {
  if (!recipient?.email) {
    throw new Error("Status update email recipient is missing.");
  }

  const statusMessages = {
    OPEN: {
      heading: "Your support ticket is now open",
      intro:
        "Your support request is now open and awaiting review by our support team.",
    },

    IN_PROGRESS: {
      heading: "Your support ticket is being handled",
      intro:
        "Our support team is currently working on your request. We will notify you when there is another update.",
    },

    WAITING_FOR_USER: {
      heading: "We need your response",
      intro:
        "Our support team is waiting for additional information from you. Please open your ticket and reply so we can continue assisting you.",
    },

    CLOSED: {
      heading: "Your support ticket has been closed",
      intro:
        "Your support ticket has been closed. If you still need assistance, please visit your support page or submit a new request.",
    },

    RESOLVED: {
      heading: "Your support ticket has been resolved",
      intro:
        "Our support team has marked your request as resolved. Please review your ticket for further details.",
    },

    REJECTED: {
      heading: "Update on your support request",
      intro:
        "Our support team has reviewed your request and updated its status. Please visit your ticket for more information.",
    },
  };

  const statusInfo = statusMessages[ticket.status] || {
    heading: "Your support ticket has been updated",
    intro:
      "The status of your support ticket has changed. Please visit your ticket to review the latest update.",
  };

  const updatedAt = ticket.updatedAt
    ? new Date(ticket.updatedAt).getTime()
    : Date.now();

  return queueSupportEmail({
    ticketId: ticket.id,
    recipientEmail: recipient.email,
    recipientName: recipient.name,

    subject:
      `ShopEase Support – ${ticket.ticketNumber} Status Updated`,

    heading: statusInfo.heading,

    intro:
      `${statusInfo.intro} Previous status: ${previousStatus}. New status: ${ticket.status}.`,

    ticketNumber: ticket.ticketNumber,
    ticketSubject: ticket.subject,
    status: ticket.status,

    actionUrl: getSupportTicketUrl(ticket, guestAccessToken),

    dedupeKey:
      `support-ticket-status-${ticket.id}-${updatedAt}`,
  });
};

// ==========================================
// SEND EMAIL JOB
// EXISTING SHOP EASE TRANSPORTER
// ==========================================

const sendEmailJob = async (job) => {
  await transporter.sendMail({
    ...(emailFrom ? { from: emailFrom } : {}),
    to: job.recipientEmail,
    subject: job.subject,
    html: job.html,
    text: job.text || undefined,
  });
};

// ==========================================
// PROCESS ONE EMAIL JOB
// ==========================================

const processEmailJob = async (job) => {
  const now = new Date();

  // Atomically claim the job to prevent
  // multiple workers from sending it together.
  const claimed = await prisma.supportEmailJob.updateMany({
    where: {
      id: job.id,

      status: {
        in: ["PENDING", "FAILED"],
      },

      nextAttemptAt: {
        lte: now,
      },

      attempts: {
        lt: job.maxAttempts,
      },
    },

    data: {
      status: "SENDING",

      attempts: {
        increment: 1,
      },
    },
  });

  if (claimed.count !== 1) {
    return;
  }

  const attemptNumber = Number(job.attempts || 0) + 1;

  try {
    await sendEmailJob(job);

    await prisma.supportEmailJob.update({
      where: {
        id: job.id,
      },

      data: {
        status: "SENT",
        sentAt: new Date(),
        lastError: null,
      },
    });

    console.log(
      `[SUPPORT EMAIL] Job ${job.id} sent to ${job.recipientEmail}`
    );
  } catch (error) {
    const finalAttempt = attemptNumber >= job.maxAttempts;

    // Retry delay: 2, 4, 8, 16, 32 minutes.
    const delayMinutes = Math.min(60, 2 ** attemptNumber);

    await prisma.supportEmailJob.update({
      where: {
        id: job.id,
      },

      data: {
        status: "FAILED",

        nextAttemptAt: new Date(
          Date.now() + delayMinutes * 60 * 1000
        ),

        lastError: String(
          error?.message || "Email delivery failed."
        ).slice(0, 2000),
      },
    });

    console.error(
      `[SUPPORT EMAIL] Job ${job.id} failed on attempt ${attemptNumber}/${job.maxAttempts}:`,
      error?.message || error
    );

    if (finalAttempt) {
      console.error(
        `[SUPPORT EMAIL] Job ${job.id} exhausted its retry attempts.`
      );
    }
  }
};

// ==========================================
// RECOVER STUCK EMAIL JOBS
// ==========================================

const recoverStuckEmailJobs = async () => {
  const staleTime = new Date(
    Date.now() - STALE_SENDING_MINUTES * 60 * 1000
  );

  await prisma.supportEmailJob.updateMany({
    where: {
      status: "SENDING",

      updatedAt: {
        lt: staleTime,
      },
    },

    data: {
      status: "FAILED",
      nextAttemptAt: new Date(),

      lastError:
        "Email worker stopped while processing this job. Retrying.",
    },
  });
};

// ==========================================
// PROCESS PENDING EMAILS
// ==========================================

export const processPendingSupportEmails = async () => {
  await recoverStuckEmailJobs();

  const jobs = await prisma.supportEmailJob.findMany({
    where: {
      status: {
        in: ["PENDING", "FAILED"],
      },

      nextAttemptAt: {
        lte: new Date(),
      },

      attempts: {
        lt: MAX_EMAIL_ATTEMPTS,
      },
    },

    orderBy: {
      createdAt: "asc",
    },

    take: EMAIL_BATCH_SIZE,
  });

  for (const job of jobs) {
    await processEmailJob(job);
  }
};

// ==========================================
// START SUPPORT EMAIL WORKER
// ==========================================

let emailWorkerStarted = false;
let emailWorkerRunning = false;

export const startSupportEmailWorker = () => {
  if (emailWorkerStarted) {
    return;
  }

  emailWorkerStarted = true;

  const runWorker = async () => {
    // Prevent overlapping runs in this process.
    if (emailWorkerRunning) {
      return;
    }

    emailWorkerRunning = true;

    try {
      await processPendingSupportEmails();
    } catch (error) {
      console.error(
        "[SUPPORT EMAIL WORKER ERROR]",
        error
      );
    } finally {
      emailWorkerRunning = false;
    }
  };

  // Process queued emails immediately.
  void runWorker();

  const worker = setInterval(
    runWorker,
    EMAIL_WORKER_INTERVAL
  );

  worker.unref?.();

  console.log("[SUPPORT EMAIL WORKER] Started");
};
