
import {
  createAiSupportConversation,
  getAiSupportConversation,
  sendAiSupportMessage,
  escalateAiSupportConversation,
  AiSupportServiceError,
} from "../services/aiSupportServices.js";

const getGuestToken = (req) =>
  req.headers["x-ai-support-token"] || null;

const handleError = (res, error) => {
  if (error instanceof AiSupportServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  console.error("AI SUPPORT CONTROLLER ERROR:", error);

  return res.status(500).json({
    success: false,
    message: "An unexpected AI Support error occurred.",
  });
};

export const createAiConversationController = async (req, res) => {
  try {
    const result = await createAiSupportConversation(
      req.user || null
    );

    return res.status(201).json({
      success: true,
      message: "AI Support conversation created.",
      data: {
        conversation: {
          id: result.conversation.id,
          status: result.conversation.status,
          createdAt: result.conversation.createdAt,
        },
        guestAccessToken: result.guestAccessToken,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getAiConversationController = async (req, res) => {
  try {
    const conversation = await getAiSupportConversation({
      conversationId: req.params.conversationId,
      user: req.user || null,
      guestToken: getGuestToken(req),
    });

    return res.status(200).json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          status: conversation.status,
          supportTicketId: conversation.supportTicketId,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messages: conversation.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          })),
        },
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const sendAiMessageController = async (req, res) => {
  try {
    const result = await sendAiSupportMessage({
      conversationId: req.params.conversationId,
      user: req.user || null,
      guestToken: getGuestToken(req),
      message: req.body.message,
    });

    return res.status(200).json({
      success: true,
      message: "AI response generated.",
      data: {
        userMessage: {
          id: result.userMessage.id,
          role: result.userMessage.role,
          content: result.userMessage.content,
          createdAt: result.userMessage.createdAt,
        },
        assistantMessage: {
          id: result.assistantMessage.id,
          role: result.assistantMessage.role,
          content: result.assistantMessage.content,
          createdAt: result.assistantMessage.createdAt,
        },
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const escalateAiConversationController = async (req, res) => {
  try {
    const result = await escalateAiSupportConversation({
      conversationId: req.params.conversationId,
      user: req.user || null,
      guestToken: getGuestToken(req),
      category: req.body.category || "OTHER",
      subject: req.body.subject,
      guestName: req.body.guestName,
      guestEmail: req.body.guestEmail,
    });

    return res.status(201).json({
      success: true,
      message: "Conversation successfully escalated to Human Support.",
      data: {
        conversationId: result.conversationId,
        ticketId: result.ticket.id,
        ticketNumber: result.ticket.ticketNumber,
        guestAccessToken: result.ticket.guestAccessToken || null,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};
