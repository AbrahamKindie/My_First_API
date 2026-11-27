
import {
  createSupportTicket,
  getMySupportTickets,
  getSupportTicketById,
  getAdminSupportTickets,
  addSupportTicketMessage,
  updateSupportTicketStatus,
  updateSupportTicketPriority,
  assignSupportTicket,
  reopenSupportTicket,
  resolveSupportTicket,
  rejectSupportTicket,
  verifySupportAdminId,
  SupportServiceError,
} from "../services/supportServices.js";

import { createSupportTicketSchema } from "../validators/supportValidations.js";

// ==========================================
// CREATE TICKET
// ==========================================

export const createTicket = async (req, res, next) => {
  try {
    const validation =
      createSupportTicketSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid support ticket information.",
        errors: validation.error.flatten(),
      });
    }

    const ticket = await createSupportTicket(
      req.user || null,
      validation.data
    );

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully.",
      data: {
        ...ticket,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        guestAccessToken:
          ticket.guestAccessToken || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CUSTOMER TICKET HISTORY
// ==========================================

export const getMyTickets = async (req, res, next) => {
  try {
    const result = await getMySupportTickets(
      req.user,
      req.query
    );

    return res.status(200).json({
      success: true,
      message: "Support tickets retrieved successfully.",
      data: result.tickets,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ADMIN TICKET LIST
// ==========================================

export const getAdminTickets = async (
  req,
  res,
  next
) => {
  try {
    const result = await getAdminSupportTickets(
      req.user,
      req.query
    );

    return res.status(200).json({
      success: true,
      message: "Support tickets retrieved successfully.",
      data: result.tickets,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// TICKET DETAILS
// ==========================================

export const getTicketDetails = async (
  req,
  res,
  next
) => {
  try {
    const ticket = req.supportTicket
      ? req.supportTicket
      : await getSupportTicketById(
          req.params.id,
          req.user || null,
          {
            guestAccessToken:
              req.headers["x-support-access-token"],
          }
        );

    return res.status(200).json({
      success: true,
      message: "Support ticket retrieved successfully.",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// REPLY TO TICKET
// ==========================================

export const replyToTicket = async (
  req,
  res,
  next
) => {
  try {
    const result = await addSupportTicketMessage(
      req.params.id,
      req.user || null,
      req.body,
      req.headers["x-support-access-token"]
    );

    return res.status(201).json({
      success: true,
      message: "Reply added successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// UPDATE TICKET STATUS
// ==========================================

export const updateTicketStatus = async (
  req,
  res,
  next
) => {
  try {
    const ticket = await updateSupportTicketStatus(
      req.params.id,
      req.user,
      req.body.status
    );

    return res.status(200).json({
      success: true,
      message: "Support ticket status updated successfully.",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// RESOLVE TICKET
// SUMMARY IS OPTIONAL
// ==========================================

export const resolveTicket = async (
  req,
  res,
  next
) => {
  try {
    const ticket = await resolveSupportTicket(
      req.params.id,
      req.user,
      req.body.summary || ""
    );

    return res.status(200).json({
      success: true,
      message: "Support ticket resolved successfully.",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// REJECT TICKET
// DESCRIPTION IS REQUIRED
// ==========================================

export const rejectTicket = async (
  req,
  res,
  next
) => {
  try {
    const ticket = await rejectSupportTicket(
      req.params.id,
      req.user,
      req.body.description
    );

    return res.status(200).json({
      success: true,
      message: "Support ticket rejected successfully.",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// UPDATE TICKET PRIORITY
// ==========================================

export const updateTicketPriority = async (
  req,
  res,
  next
) => {
  try {
    const ticket = await updateSupportTicketPriority(
      req.params.id,
      req.user,
      req.body.priority
    );

    return res.status(200).json({
      success: true,
      message: "Support ticket priority updated successfully.",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// VERIFY ADMIN ID
// ==========================================

export const verifyAdminId = async (
  req,
  res,
  next
) => {
  try {
    const admin = await verifySupportAdminId(
      req.body.adminId,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Admin verified successfully.",
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ASSIGN ADMIN TO TICKET
// ==========================================

export const assignTicket = async (
  req,
  res,
  next
) => {
  try {
    const ticket = await assignSupportTicket(
      req.params.id,
      req.user,
      req.body.adminId
    );

    return res.status(200).json({
      success: true,
      message: req.body.adminId
        ? "Support ticket assigned successfully."
        : "Support ticket unassigned successfully.",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// REOPEN TICKET
// ==========================================

export const reopenTicket = async (
  req,
  res,
  next
) => {
  try {
    const ticket = await reopenSupportTicket(
      req.params.id,
      req.user || null,
      req.headers["x-support-access-token"]
    );

    return res.status(200).json({
      success: true,
      message: "Support ticket reopened successfully.",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};
