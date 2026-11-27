
import {
  getSupportTicketById,
} from "../services/supportServices.js";

// ==========================================
// ROLE HELPERS
// ==========================================

const isAdmin = (user) =>
  user?.role === "ADMIN" ||
  user?.role === "SUPER_ADMIN";

const isSuperAdmin = (user) =>
  user?.role === "SUPER_ADMIN";

// ==========================================
// PERMISSION HELPER
// ==========================================

const hasPermission = (user, permission) => {
  if (isSuperAdmin(user)) return true;

  return (
    Array.isArray(user?.adminPermissions) &&
    user.adminPermissions.includes(permission)
  );
};

// ==========================================
// ADMIN AUTHORIZATION
// ==========================================

const requireActiveAdmin = (req, res, next) => {
  if (!req.user?.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  if (!isAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Administrator access required.",
    });
  }

  if (req.user.isActive !== true) {
    return res.status(403).json({
      success: false,
      message: "Your administrator account is inactive.",
    });
  }

  next();
};

// ==========================================
// SUPPORT USER AUTHORIZATION
// ==========================================

export const requireSupportUser = (req, res, next) => {
  if (!req.user?.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  const allowedRoles = [
    "USER",
    "SHOP_OWNER",
    "ADMIN",
    "SUPER_ADMIN",
  ];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to use support.",
    });
  }

  if (
    isAdmin(req.user) &&
    req.user.isActive !== true
  ) {
    return res.status(403).json({
      success: false,
      message: "Your administrator account is inactive.",
    });
  }

  next();
};

// ==========================================
// ADMIN - VIEW SUPPORT TICKETS
// VIEW_SHOP_CUSTOMER_TICKETS
// ==========================================

export const requireSupportAdminView = [
  requireActiveAdmin,

  (req, res, next) => {
    if (
      !hasPermission(
        req.user,
        "VIEW_SHOP_CUSTOMER_TICKETS"
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view support tickets.",
        requiredPermission: "VIEW_SHOP_CUSTOMER_TICKETS",
      });
    }

    next();
  },
];

// ==========================================
// ADMIN - REPLY TO SUPPORT TICKETS
// REPLY_SHOP_CUSTOMER_TICKETS
// ==========================================

export const requireSupportAdminReply = [
  requireActiveAdmin,

  (req, res, next) => {
    if (
      !hasPermission(
        req.user,
        "REPLY_SHOP_CUSTOMER_TICKETS"
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to reply to support tickets.",
        requiredPermission: "REPLY_SHOP_CUSTOMER_TICKETS",
      });
    }

    next();
  },
];

// ==========================================
// ADMIN - UPDATE TICKET STATUS
// UPDATE_SHOP_CUSTOMER_TICKET_STATUS
// ==========================================

export const requireSupportAdminStatusUpdate = [
  requireActiveAdmin,

  (req, res, next) => {
    if (
      !hasPermission(
        req.user,
        "UPDATE_SHOP_CUSTOMER_TICKET_STATUS"
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update support ticket status.",
        requiredPermission: "UPDATE_SHOP_CUSTOMER_TICKET_STATUS",
      });
    }

    next();
  },
];

// ==========================================
// ADMIN - GENERAL SUPPORT MANAGEMENT
// ==========================================

export const requireSupportAdminManage = [
  requireActiveAdmin,

  (req, res, next) => {
    const canReply = hasPermission(
      req.user,
      "REPLY_SHOP_CUSTOMER_TICKETS"
    );

    const canUpdateStatus = hasPermission(
      req.user,
      "UPDATE_SHOP_CUSTOMER_TICKET_STATUS"
    );

    if (!canReply && !canUpdateStatus) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage support tickets.",
      });
    }

    next();
  },
];

// ==========================================
// TICKET VIEW PERMISSION
// ADMIN / CUSTOMER / GUEST
// ==========================================

export const requireSupportTicketViewPermission = (
  req,
  res,
  next
) => {
  // Admins must have the Admin viewing permission.
  if (isAdmin(req.user)) {
    if (!hasPermission(
      req.user,
      "VIEW_SHOP_CUSTOMER_TICKETS"
    )) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view support tickets.",
        requiredPermission: "VIEW_SHOP_CUSTOMER_TICKETS",
      });
    }

    return next();
  }

  // Customer and guest access is checked by
  // requireSupportTicketAccess.
  next();
};

// ==========================================
// TICKET REPLY PERMISSION
// ADMIN / CUSTOMER / GUEST
// ==========================================

export const requireSupportTicketReplyPermission = (
  req,
  res,
  next
) => {
  // Admin replies require the Admin reply permission.
  if (isAdmin(req.user)) {
    if (!hasPermission(
      req.user,
      "REPLY_SHOP_CUSTOMER_TICKETS"
    )) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to reply to support tickets.",
        requiredPermission: "REPLY_SHOP_CUSTOMER_TICKETS",
      });
    }

    return next();
  }

  // Customer ownership or guest token has already
  // been checked by requireSupportTicketAccess.
  next();
};

// ==========================================
// TICKET REOPEN PERMISSION
// ADMIN / CUSTOMER / GUEST
// ==========================================

export const requireSupportTicketReopenPermission = (
  req,
  res,
  next
) => {
  // Admin reopening requires status-update permission.
  if (isAdmin(req.user)) {
    if (!hasPermission(
      req.user,
      "UPDATE_SHOP_CUSTOMER_TICKET_STATUS"
    )) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to reopen support tickets.",
        requiredPermission: "UPDATE_SHOP_CUSTOMER_TICKET_STATUS",
      });
    }

    return next();
  }

  // Customer and guest authorization is delegated
  // to ticket ownership or guest-token verification.
  next();
};

// ==========================================
// SUPPORT TICKET ACCESS
// CUSTOMER / ADMIN / GUEST
// ==========================================

export const requireSupportTicketAccess = async (
  req,
  res,
  next
) => {
  try {
    const guestAccessToken =
      req.headers["x-support-access-token"];

    const ticket = await getSupportTicketById(
      req.params.id,
      req.user || null,
      { guestAccessToken }
    );

    req.supportTicket = ticket;

    req.guestSupportAccess = !req.user?.userId;

    next();
  } catch (error) {
    next(error);
  }
};
