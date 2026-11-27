
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";

import prisma from "../db/prisma.js";

import {
  queueSupportTicketCreatedEmail,
  queueSupportReplyEmail,
  queueSupportStatusEmail,
  getSupportTicketRecipient,
} from "./supportEmailService.js";

// ==========================================
// CONFIGURATION
// ==========================================

const SUPPORT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "RESOLVED",
  "REJECTED",
  "CLOSED",
];

const SUPPORT_PRIORITIES = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

const SUPPORT_CATEGORIES = [
  "ACCOUNT",
  "ORDER",
  "PAYMENT",
  "PRODUCT",
  "SHOP",
  "SHIPPING",
  "RETURN_REFUND",
  "TECHNICAL",
  "OTHER",
];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const GUEST_TOKEN_EXPIRY_DAYS = 30;
const ADMIN_TICKET_PERMISSION =
  "VIEW_SHOP_CUSTOMER_TICKETS";
const ADMIN_REPLY_PERMISSION =
  "REPLY_SHOP_CUSTOMER_TICKETS";
const ADMIN_UPDATE_PERMISSION =
  "UPDATE_SHOP_CUSTOMER_TICKET_STATUS";

// ==========================================
// ERRORS
// ==========================================

class SupportServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "SupportServiceError";
    this.statusCode = statusCode;
  }
}

const throwError = (message, statusCode = 400) => {
  throw new SupportServiceError(message, statusCode);
};

// ==========================================
// GENERAL HELPERS
// ==========================================

const safelyQueueSupportEmail = async (
  queueFunction,
  data
) => {
  try {
    return await queueFunction(data);
  } catch (error) {
    console.error(
      "[SUPPORT EMAIL QUEUE ERROR]",
      error.message
    );

    return null;
  }
};

const isAdmin = (user) =>
  user?.role === "ADMIN" ||
  user?.role === "SUPER_ADMIN";

const isSuperAdmin = (user) =>
  user?.role === "SUPER_ADMIN" ||
  user?.isSuperAdmin === true;

const hasPermission = (user, permission) => {
  if (isSuperAdmin(user)) {
    return true;
  }

  return (
    Array.isArray(user?.adminPermissions) &&
    user.adminPermissions.includes(permission)
  );
};

const requireAuthenticatedUser = (user) => {
  if (!user?.userId) {
    throwError("Authentication is required.", 401);
  }
};

const requireAdminPermission = (user, permission) => {
  requireAuthenticatedUser(user);

  if (!isAdmin(user)) {
    throwError(
      "You are not authorized to perform this action.",
      403
    );
  }

  if (!hasPermission(user, permission)) {
    throwError(
      "You do not have permission to perform this action.",
      403
    );
  }
};

const normalizeId = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throwError("Invalid record ID.");
  }

  return id;
};

const normalizePage = (value) => {
  const number = Number(value);

  return Math.max(
    1,
    Number.isSafeInteger(number)
      ? number
      : DEFAULT_PAGE
  );
};

const normalizeLimit = (value) => {
  const number = Number(value);

  return Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Number.isSafeInteger(number)
        ? number
        : DEFAULT_LIMIT
    )
  );
};

const getTicketRecipient = (ticket) =>
  getSupportTicketRecipient(ticket);

const queueStatusEmail = async (
  ticket,
  previousStatus
) => {
  if (
    !ticket.requesterId &&
    !ticket.guestEmail
  ) {
    return;
  }

  await safelyQueueSupportEmail(
    queueSupportStatusEmail,
    {
      ticket,
      recipient: getTicketRecipient(ticket),
      previousStatus,
    }
  );
};

// ==========================================
// SUPPORT TICKET NUMBER
// ==========================================

const generateSupportTicketNumber = () => {
  const year = new Date().getFullYear();

  const uniqueId = randomUUID()
    .replaceAll("-", "")
    .toUpperCase();

  return `SUP-${year}-${uniqueId}`;
};

// ==========================================
// GUEST TOKEN HELPERS
// ==========================================

const generateGuestAccessToken = () =>
  randomBytes(32).toString("hex");

const hashGuestAccessToken = (token) =>
  createHash("sha256")
    .update(token)
    .digest("hex");

const getGuestTokenExpiry = () => {
  const expiry = new Date();

  expiry.setDate(
    expiry.getDate() + GUEST_TOKEN_EXPIRY_DAYS
  );

  return expiry;
};

const verifyGuestTicketAccess = async (
  ticket,
  guestAccessToken
) => {
  if (!ticket || ticket.requesterId !== null) {
    return false;
  }

  if (
    typeof guestAccessToken !== "string" ||
    !/^[a-f0-9]{64}$/i.test(guestAccessToken)
  ) {
    return false;
  }

  if (
    !ticket.guestAccessTokenHash ||
    !ticket.guestAccessTokenExpiresAt
  ) {
    return false;
  }

  if (
    ticket.guestAccessTokenExpiresAt <= new Date()
  ) {
    return false;
  }

  try {
    const suppliedHash = Buffer.from(
      hashGuestAccessToken(guestAccessToken),
      "hex"
    );

    const storedHash = Buffer.from(
      ticket.guestAccessTokenHash,
      "hex"
    );

    if (
      suppliedHash.length !== storedHash.length
    ) {
      return false;
    }

    return timingSafeEqual(
      suppliedHash,
      storedHash
    );
  } catch {
    return false;
  }
};

// ==========================================
// TICKET INCLUDES
// ==========================================

const getTicketIncludes = () => ({
  requester: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },

  assignedAdmin: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },

  messages: {
    orderBy: {
      createdAt: "asc",
    },

    include: {
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  },
});

// ==========================================
// ACCESS CONTROL
// ==========================================

const canAccessTicket = (ticket, user) => {
  if (!ticket || !user) {
    return false;
  }

  if (isAdmin(user)) {
    return hasPermission(
      user,
      ADMIN_TICKET_PERMISSION
    );
  }

  return (
    Boolean(user.userId) &&
    ticket.requesterId === user.userId
  );
};

const canReplyToTicket = (ticket, user) => {
  if (!ticket || !user) {
    return false;
  }

  if (isAdmin(user)) {
    return hasPermission(
      user,
      ADMIN_REPLY_PERMISSION
    );
  }

  return (
    Boolean(user.userId) &&
    ticket.requesterId === user.userId
  );
};

// ==========================================
// GET TICKET WITH ACCESS VERIFICATION
// ==========================================

const getTicketForUser = async (
  ticketId,
  user,
  { guestAccessToken } = {}
) => {
  const id = normalizeId(ticketId);

  if (!id) {
    throwError("Invalid support ticket ID.");
  }

  const ticket =
    await prisma.supportTicket.findUnique({
      where: { id },
      include: getTicketIncludes(),
    });

  if (!ticket) {
    throwError("Support ticket not found.", 404);
  }

  if (user?.userId) {
    if (!canAccessTicket(ticket, user)) {
      throwError(
        "You are not authorized to access this ticket.",
        403
      );
    }

    return ticket;
  }

  const guestHasAccess =
    await verifyGuestTicketAccess(
      ticket,
      guestAccessToken
    );

  if (!guestHasAccess) {
    throwError(
      "Invalid or expired guest ticket access token.",
      403
    );
  }

  return ticket;
};

// ==========================================
// ADMIN IN-APP NOTIFICATIONS
// ==========================================

const notifySupportAdmins = async (ticket) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          in: ["ADMIN", "SUPER_ADMIN"],
        },
      },

      select: {
        id: true,
        role: true,

        adminRole: {
          select: {
            isActive: true,

            permissions: {
              where: {
                permission: {
                  isActive: true,
                },
              },

              select: {
                permission: {
                  select: {
                    key: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const recipients = admins.filter((admin) => {
      if (admin.role === "SUPER_ADMIN") {
        return true;
      }

      if (
        admin.role !== "ADMIN" ||
        !admin.adminRole ||
        !admin.adminRole.isActive
      ) {
        return false;
      }

      return admin.adminRole.permissions.some(
        (item) =>
          item.permission?.key ===
            ADMIN_TICKET_PERMISSION &&
          item.permission?.isActive === true
      );
    });

    if (recipients.length === 0) {
      return;
    }

    await prisma.notification.createMany({
      data: recipients.map((admin) => ({
        userId: admin.id,
        type: "SUPPORT_TICKET_CREATED",
        title: "New support ticket",
        message: `A new support ticket ${ticket.ticketNumber} has been created.`,
        link: "/admin/support",
        supportTicketId: ticket.id,
      })),
    });
  } catch (error) {
    console.error(
      "[SUPPORT ADMIN NOTIFICATION ERROR]",
      error.message
    );
  }
};

const notifyAssignedAdmin = async (
  ticket,
  admin
) => {
  if (!admin) {
    return;
  }

  try {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: "SUPPORT_TICKET_ASSIGNED",
        title: "Support ticket assigned",
        message: `Support ticket ${ticket.ticketNumber} has been assigned to you.`,
        link: `/admin/support/${ticket.id}`,
        supportTicketId: ticket.id,
      },
    });
  } catch (error) {
    console.error(
      "[SUPPORT ASSIGNMENT NOTIFICATION ERROR]",
      error.message
    );
  }
};

// ==========================================
// CREATE SUPPORT TICKET
// ==========================================

export const createSupportTicket = async (
  user,
  data = {}
) => {
  const isGuest = !user?.userId;

  const {
    category,
    subject,
    description,
    priority = "NORMAL",
    productName,
    shopName,
    guestName,
    guestEmail,
  } = data;

  if (!isGuest && !user.isActive) {
    throwError("Your account is inactive.", 403);
  }

  if (!SUPPORT_CATEGORIES.includes(category)) {
    throwError("Invalid support ticket category.");
  }

  if (!SUPPORT_PRIORITIES.includes(priority)) {
    throwError("Invalid support ticket priority.");
  }

  if (
    typeof subject !== "string" ||
    subject.trim().length < 5
  ) {
    throwError(
      "Subject must be at least 5 characters."
    );
  }

  if (
    typeof description !== "string" ||
    description.trim().length < 10
  ) {
    throwError(
      "Description must be at least 10 characters."
    );
  }

  let normalizedGuestName = null;
  let normalizedGuestEmail = null;
  let guestAccessToken = null;

  if (isGuest) {
    if (
      typeof guestName !== "string" ||
      guestName.trim().length < 2
    ) {
      throwError(
        "Your name is required to create a guest support ticket."
      );
    }

    if (
      typeof guestEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        guestEmail.trim()
      )
    ) {
      throwError(
        "A valid email address is required to create a guest support ticket."
      );
    }

    normalizedGuestName = guestName.trim();

    normalizedGuestEmail = guestEmail
      .trim()
      .toLowerCase();

    guestAccessToken =
      generateGuestAccessToken();
  }

  const ticketNumber =
    generateSupportTicketNumber();

  const ticketCreateData = {
    ticketNumber,

    guestName: normalizedGuestName,
    guestEmail: normalizedGuestEmail,

    guestAccessTokenHash: guestAccessToken
      ? hashGuestAccessToken(guestAccessToken)
      : null,

    guestAccessTokenExpiresAt: guestAccessToken
      ? getGuestTokenExpiry()
      : null,

    category,
    subject: subject.trim(),
    description: description.trim(),

    status: "OPEN",
    priority,

    productName:
      typeof productName === "string"
        ? productName.trim() || null
        : null,

    shopName:
      typeof shopName === "string"
        ? shopName.trim() || null
        : null,
  };

  if (user?.userId) {
    ticketCreateData.requester = {
      connect: {
        id: user.userId,
      },
    };
  }

  const ticket =
    await prisma.supportTicket.create({
      data: ticketCreateData,
      include: getTicketIncludes(),
    });

  await notifySupportAdmins(ticket);

  await safelyQueueSupportEmail(
    (ticketData) =>
      queueSupportTicketCreatedEmail(
        ticketData,
        guestAccessToken
      ),
    ticket
  );

  return guestAccessToken
    ? {
        ...ticket,
        guestAccessToken,
      }
    : ticket;
};

// ==========================================
// CUSTOMER TICKET HISTORY
// ==========================================

export const getMySupportTickets = async (
  user,
  {
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  } = {}
) => {
  requireAuthenticatedUser(user);

  const currentPage = normalizePage(page);
  const pageSize = normalizeLimit(limit);

  let where = {};

  if (isAdmin(user)) {
    requireAdminPermission(
      user,
      ADMIN_TICKET_PERMISSION
    );

    where = {};
  } else {
    where = {
      requesterId: user.userId,
    };
  }

  const [tickets, total] =
    await prisma.$transaction([
      prisma.supportTicket.findMany({
        where,

        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },

          assignedAdmin: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },

          _count: {
            select: {
              messages: true,
            },
          },
        },

        orderBy: {
          updatedAt: "desc",
        },

        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),

      prisma.supportTicket.count({ where }),
    ]);

  return {
    tickets,

    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

// ==========================================
// GET TICKET DETAILS
// ==========================================

export const getSupportTicketById = async (
  ticketId,
  user,
  options = {}
) => {
  return getTicketForUser(
    ticketId,
    user,
    options
  );
};

// ==========================================
// ADMIN TICKET LIST
// ==========================================

export const getAdminSupportTickets = async (
  user,
  {
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
    status,
    priority,
    category,
    assignedAdminId,
    search,
  } = {}
) => {
  requireAdminPermission(
    user,
    ADMIN_TICKET_PERMISSION
  );

  const currentPage = normalizePage(page);
  const pageSize = normalizeLimit(limit);

  const where = {};

  if (status) {
    if (!SUPPORT_STATUSES.includes(status)) {
      throwError("Invalid support ticket status.");
    }

    where.status = status;
  }

  if (priority) {
    if (!SUPPORT_PRIORITIES.includes(priority)) {
      throwError("Invalid support ticket priority.");
    }

    where.priority = priority;
  }

  if (category) {
    if (!SUPPORT_CATEGORIES.includes(category)) {
      throwError("Invalid support ticket category.");
    }

    where.category = category;
  }

  if (
    assignedAdminId !== undefined &&
    assignedAdminId !== ""
  ) {
    if (assignedAdminId === "unassigned") {
      where.assignedAdminId = null;
    } else {
      where.assignedAdminId =
        normalizeId(assignedAdminId);
    }
  }

  if (
    typeof search === "string" &&
    search.trim()
  ) {
    const searchTerm = search.trim();

    where.OR = [
      {
        ticketNumber: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        subject: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        guestName: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        guestEmail: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        productName: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        shopName: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        requester: {
          is: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      },
      {
        requester: {
          is: {
            email: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  const [tickets, total] =
    await prisma.$transaction([
      prisma.supportTicket.findMany({
        where,

        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },

          assignedAdmin: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },

          _count: {
            select: {
              messages: true,
            },
          },
        },

        orderBy: [
          { priority: "desc" },
          { updatedAt: "desc" },
        ],

        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),

      prisma.supportTicket.count({ where }),
    ]);

  return {
    tickets,

    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

// ==========================================
// ADD SUPPORT MESSAGE
// ==========================================

export const addSupportTicketMessage = async (
  ticketId,
  user,
  data,
  guestAccessToken = null
) => {
  const ticket = await getTicketForUser(
    ticketId,
    user,
    { guestAccessToken }
  );

  const isGuest = !user?.userId;

  if (isGuest) {
    if (ticket.requesterId !== null) {
      throwError(
        "Guest access is not allowed for this ticket.",
        403
      );
    }
  } else if (!canReplyToTicket(ticket, user)) {
    throwError(
      "You are not authorized to reply to this ticket.",
      403
    );
  }

  if (
    typeof data?.message !== "string" ||
    !data.message.trim()
  ) {
    throwError("Message cannot be empty.");
  }

  if (
    ["CLOSED", "RESOLVED", "REJECTED"].includes(
      ticket.status
    )
  ) {
    throwError(
      "This ticket is no longer accepting replies. Reopen it before replying."
    );
  }

  const attachmentUrls =
    Array.isArray(data.attachmentUrls)
      ? data.attachmentUrls
      : [];

  const message =
    await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: user?.userId || null,
        message: data.message.trim(),
        attachmentUrls,
      },

      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

  const adminReply = isAdmin(user);

  const updatedTicket =
    await prisma.supportTicket.update({
      where: {
        id: ticket.id,
      },

      data: {
        status: adminReply
          ? "WAITING_FOR_USER"
          : "IN_PROGRESS",

        closedAt: null,
        resolvedAt: null,
        rejectedAt: null,
      },

      include: getTicketIncludes(),
    });

  if (
    adminReply &&
    (updatedTicket.requesterId ||
      updatedTicket.guestEmail)
  ) {
    await safelyQueueSupportEmail(
      queueSupportReplyEmail,
      {
        ticket: updatedTicket,
        message: message.message,
        recipient: getTicketRecipient(updatedTicket),
        messageId: message.id,
      }
    );
  }

  return {
    ticket: updatedTicket,
    message,
  };
};

// ==========================================
// UPDATE GENERAL TICKET STATUS
// RESOLVE AND REJECT USE DEDICATED ACTIONS
// ==========================================

export const updateSupportTicketStatus = async (
  ticketId,
  user,
  newStatus
) => {
  requireAdminPermission(
    user,
    ADMIN_UPDATE_PERMISSION
  );

  if (!SUPPORT_STATUSES.includes(newStatus)) {
    throwError("Invalid support ticket status.");
  }

  if (
    newStatus === "RESOLVED" ||
    newStatus === "REJECTED"
  ) {
    throwError(
      "Use the dedicated resolve or reject action for this status."
    );
  }

  const id = normalizeId(ticketId);

  if (!id) {
    throwError("Invalid support ticket ID.");
  }

  const ticket =
    await prisma.supportTicket.findUnique({
      where: { id },
    });

  if (!ticket) {
    throwError("Support ticket not found.", 404);
  }

  const updatedTicket =
    await prisma.supportTicket.update({
      where: {
        id: ticket.id,
      },

      data: {
        status: newStatus,

        closedAt:
          newStatus === "CLOSED"
            ? new Date()
            : null,

        resolvedAt: null,
        rejectedAt: null,
      },

      include: getTicketIncludes(),
    });

  await queueStatusEmail(
    updatedTicket,
    ticket.status
  );

  return updatedTicket;
};

// ==========================================
// RESOLVE SUPPORT TICKET
// SUMMARY IS OPTIONAL
// ==========================================

export const resolveSupportTicket = async (
  ticketId,
  user,
  summary = ""
) => {
  requireAdminPermission(
    user,
    ADMIN_UPDATE_PERMISSION
  );

  const id = normalizeId(ticketId);

  if (!id) {
    throwError("Invalid support ticket ID.");
  }

  if (
    typeof summary !== "string" ||
    summary.trim().length > 5000
  ) {
    throwError(
      "Resolution summary must be 5000 characters or fewer."
    );
  }

  const ticket =
    await prisma.supportTicket.findUnique({
      where: { id },
    });

  if (!ticket) {
    throwError("Support ticket not found.", 404);
  }

  if (
    ["RESOLVED", "REJECTED", "CLOSED"].includes(
      ticket.status
    )
  ) {
    throwError(
      "This ticket is already in a final status."
    );
  }

  const now = new Date();

  const updatedTicket =
    await prisma.supportTicket.update({
      where: {
        id: ticket.id,
      },

      data: {
        status: "RESOLVED",
        resolutionSummary: summary.trim() || null,
        resolvedAt: now,
        rejectedAt: null,
        rejectionDescription: null,
        closedAt: now,
      },

      include: getTicketIncludes(),
    });

  await queueStatusEmail(
    updatedTicket,
    ticket.status
  );

  return updatedTicket;
};

// ==========================================
// REJECT SUPPORT TICKET
// DESCRIPTION IS REQUIRED
// ==========================================

export const rejectSupportTicket = async (
  ticketId,
  user,
  description
) => {
  requireAdminPermission(
    user,
    ADMIN_UPDATE_PERMISSION
  );

  const id = normalizeId(ticketId);

  if (!id) {
    throwError("Invalid support ticket ID.");
  }

  if (
    typeof description !== "string" ||
    description.trim().length < 10
  ) {
    throwError(
      "Rejection description must be at least 10 characters."
    );
  }

  if (description.trim().length > 5000) {
    throwError(
      "Rejection description must be 5000 characters or fewer."
    );
  }

  const ticket =
    await prisma.supportTicket.findUnique({
      where: { id },
    });

  if (!ticket) {
    throwError("Support ticket not found.", 404);
  }

  if (
    ["RESOLVED", "REJECTED", "CLOSED"].includes(
      ticket.status
    )
  ) {
    throwError(
      "This ticket is already in a final status."
    );
  }

  const now = new Date();

  const updatedTicket =
    await prisma.supportTicket.update({
      where: {
        id: ticket.id,
      },

      data: {
        status: "REJECTED",
        rejectionDescription: description.trim(),
        rejectedAt: now,
        resolutionSummary: null,
        resolvedAt: null,
        closedAt: now,
      },

      include: getTicketIncludes(),
    });

  await queueStatusEmail(
    updatedTicket,
    ticket.status
  );

  return updatedTicket;
};

// ==========================================
// UPDATE TICKET PRIORITY
// ==========================================

export const updateSupportTicketPriority = async (
  ticketId,
  user,
  newPriority
) => {
  requireAdminPermission(
    user,
    ADMIN_UPDATE_PERMISSION
  );

  if (!SUPPORT_PRIORITIES.includes(newPriority)) {
    throwError("Invalid support ticket priority.");
  }

  const id = normalizeId(ticketId);

  if (!id) {
    throwError("Invalid support ticket ID.");
  }

  const ticket =
    await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true },
    });

  if (!ticket) {
    throwError("Support ticket not found.", 404);
  }

  return prisma.supportTicket.update({
    where: {
      id: ticket.id,
    },

    data: {
      priority: newPriority,
    },

    include: getTicketIncludes(),
  });
};

// ==========================================
// VERIFY ADMIN ID BEFORE ASSIGNMENT
// ==========================================

export const verifySupportAdminId = async (
  adminId,
  user
) => {
  requireAdminPermission(
    user,
    ADMIN_UPDATE_PERMISSION
  );

  const normalizedAdminId = normalizeId(adminId);

  if (!normalizedAdminId) {
    throwError("Admin ID is required.");
  }

  const admin = await prisma.user.findFirst({
    where: {
      id: normalizedAdminId,
      role: "ADMIN",
      isActive: true,
      adminRole: {
        is: {
          isActive: true,
        },
      },
    },

    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  if (!admin) {
    throwError(
      "Active Admin not found. Please check the Admin ID.",
      404
    );
  }

  return admin;
};

// ==========================================
// ASSIGN OR UNASSIGN TICKET
// ==========================================

export const assignSupportTicket = async (
  ticketId,
  user,
  adminId
) => {
  requireAdminPermission(
    user,
    ADMIN_UPDATE_PERMISSION
  );

  const id = normalizeId(ticketId);

  if (!id) {
    throwError("Invalid support ticket ID.");
  }

  const ticket =
    await prisma.supportTicket.findUnique({
      where: { id },
      select: {
        id: true,
        ticketNumber: true,
        assignedAdminId: true,
      },
    });

  if (!ticket) {
    throwError("Support ticket not found.", 404);
  }

  let assignedAdmin = null;

  if (
    adminId !== null &&
    adminId !== undefined &&
    adminId !== ""
  ) {
    assignedAdmin =
      await verifySupportAdminId(adminId, user);
  }

  const updatedTicket =
    await prisma.supportTicket.update({
      where: {
        id: ticket.id,
      },

      data: {
        assignedAdminId: assignedAdmin?.id || null,
      },

      include: getTicketIncludes(),
    });

  if (
    assignedAdmin &&
    ticket.assignedAdminId !== assignedAdmin.id
  ) {
    await notifyAssignedAdmin(
      updatedTicket,
      assignedAdmin
    );
  }

  return updatedTicket;
};

// ==========================================
// REOPEN SUPPORT TICKET
// ==========================================

export const reopenSupportTicket = async (
  ticketId,
  user,
  guestAccessToken = null
) => {
  const ticket = await getTicketForUser(
    ticketId,
    user,
    { guestAccessToken }
  );

  if (
    !["RESOLVED", "REJECTED", "CLOSED"].includes(
      ticket.status
    )
  ) {
    throwError(
      "Only resolved, rejected, or closed tickets can be reopened."
    );
  }

  if (user?.userId && isAdmin(user)) {
    requireAdminPermission(
      user,
      ADMIN_UPDATE_PERMISSION
    );
  }

  const updatedTicket =
    await prisma.supportTicket.update({
      where: {
        id: ticket.id,
      },

      data: {
        status: "OPEN",
        closedAt: null,
        resolvedAt: null,
        rejectedAt: null,
        resolutionSummary: null,
        rejectionDescription: null,
      },

      include: getTicketIncludes(),
    });

  await queueStatusEmail(
    updatedTicket,
    ticket.status
  );

  return updatedTicket;
};

// ==========================================
// EXPORTS
// ==========================================

export { SupportServiceError };
