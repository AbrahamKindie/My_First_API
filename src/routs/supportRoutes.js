
import { Router } from "express";

import authenticate, {
  optionalAuthenticate,
} from "../middleware/auth.js";

import validate from "../middleware/validateMiddleware.js";

import {
  requireSupportUser,
  requireSupportAdminView,
  requireSupportAdminReply,
  requireSupportAdminStatusUpdate,
  requireSupportTicketAccess,
  requireSupportTicketViewPermission,
  requireSupportTicketReplyPermission,
  requireSupportTicketReopenPermission,
} from "../middleware/supportAccess.js";

import {
  createTicket,
  getMyTickets,
  getAdminTickets,
  getTicketDetails,
  replyToTicket,
  updateTicketStatus,
  updateTicketPriority,
  assignTicket,
  reopenTicket,
  resolveTicket,
  rejectTicket,
  verifyAdminId,
} from "../controllers/supportControllers.js";

import {
  createSupportTicketSchema,
  createSupportMessageSchema,
  updateSupportTicketStatusSchema,
  updateSupportTicketPrioritySchema,
  assignSupportTicketSchema,
  resolveSupportTicketSchema,
  rejectSupportTicketSchema,
  verifySupportAdminSchema,
  supportTicketParamsSchema,
  supportTicketListQuerySchema,
  adminSupportTicketListQuerySchema,
} from "../validators/supportValidations.js";

const router = Router();

// ==========================================
// CREATE SUPPORT TICKET
// GUEST / AUTHENTICATED CUSTOMER
// ==========================================

router.post(
  "/",
  optionalAuthenticate,
  validate(createSupportTicketSchema, {
    source: "body",
  }),
  createTicket
);

// ==========================================
// CUSTOMER - OWN TICKETS
// ==========================================

router.get(
  "/my",
  authenticate,
  requireSupportUser,
  validate(supportTicketListQuerySchema, {
    source: "query",
  }),
  getMyTickets
);

// ==========================================
// ADMIN - ALL SUPPORT TICKETS
// Permission: VIEW_SHOP_CUSTOMER_TICKETS
// ==========================================

router.get(
  "/admin",
  authenticate,
  requireSupportAdminView,
  validate(adminSupportTicketListQuerySchema, {
    source: "query",
  }),
  getAdminTickets
);

// ==========================================
// ADMIN - VERIFY ADMIN ID
// Permission: UPDATE_SHOP_CUSTOMER_TICKET_STATUS
// ==========================================

router.post(
  "/admin/verify",
  authenticate,
  requireSupportUser,
  requireSupportAdminStatusUpdate,
  validate(verifySupportAdminSchema, {
    source: "body",
  }),
  verifyAdminId
);

// ==========================================
// TICKET DETAILS
// CUSTOMER OWNER / VERIFIED GUEST / ADMIN
// ==========================================

router.get(
  "/:id",
  optionalAuthenticate,
  validate(supportTicketParamsSchema, {
    source: "params",
  }),
  requireSupportTicketAccess,
  requireSupportTicketViewPermission,
  getTicketDetails
);

// ==========================================
// TICKET REPLIES
// CUSTOMER OWNER / VERIFIED GUEST / ADMIN
// ==========================================

router.post(
  "/:id/messages",
  optionalAuthenticate,
  validate(supportTicketParamsSchema, {
    source: "params",
  }),
  validate(createSupportMessageSchema, {
    source: "body",
  }),
  requireSupportTicketAccess,
  requireSupportTicketReplyPermission,
  replyToTicket
);

// ==========================================
// ADMIN - UPDATE TICKET STATUS
// ==========================================

router.patch(
  "/:id/status",
  authenticate,
  requireSupportUser,
  validate(supportTicketParamsSchema, {
    source: "params",
  }),
  validate(updateSupportTicketStatusSchema, {
    source: "body",
  }),
  requireSupportAdminStatusUpdate,
  updateTicketStatus
);

// ==========================================
// ADMIN - RESOLVE TICKET
// Summary is optional
// ==========================================

router.patch(
  "/:id/resolve",
  authenticate,
  requireSupportUser,
  validate(supportTicketParamsSchema, {
    source: "params",
  }),
  validate(resolveSupportTicketSchema, {
    source: "body",
  }),
  requireSupportAdminStatusUpdate,
  resolveTicket
);

// ==========================================
// ADMIN - REJECT TICKET
// Description is required
// ==========================================

router.patch(
  "/:id/reject",
  authenticate,
  requireSupportUser,
  validate(supportTicketParamsSchema, {
    source: "params",
  }),
  validate(rejectSupportTicketSchema, {
    source: "body",
  }),
  requireSupportAdminStatusUpdate,
  rejectTicket
);

// ==========================================
// ADMIN - UPDATE TICKET PRIORITY
// Permission: UPDATE_SHOP_CUSTOMER_TICKET_STATUS
// ==========================================

router.patch(
  "/:id/priority",
  authenticate,
  requireSupportUser,
  validate(supportTicketParamsSchema, {
    source: "params",
  }),
  validate(updateSupportTicketPrioritySchema, {
    source: "body",
  }),
  requireSupportAdminStatusUpdate,
  updateTicketPriority
);

// ==========================================
// ADMIN - ASSIGN / UNASSIGN TICKET
// Permission: UPDATE_SHOP_CUSTOMER_TICKET_STATUS
// ==========================================

router.patch(
  "/:id/assign",
  authenticate,
  requireSupportUser,
  validate(supportTicketParamsSchema, {
    source: "params",
  }),
  validate(assignSupportTicketSchema, {
    source: "body",
  }),
  requireSupportAdminStatusUpdate,
  assignTicket
);

// ==========================================
// REOPEN TICKET
// CUSTOMER OWNER / VERIFIED GUEST / ADMIN
// ==========================================

router.post(
  "/:id/reopen",
  optionalAuthenticate,
  validate(supportTicketParamsSchema, {
    source: "params",
  }),
  requireSupportTicketAccess,
  requireSupportTicketReopenPermission,
  reopenTicket
);

export default router;
