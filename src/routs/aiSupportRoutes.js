
import express from "express";

import { optionalAuthenticate } from "../middleware/auth.js";

import {
  createAiConversationController,
  getAiConversationController,
  sendAiMessageController,
  escalateAiConversationController,
} from "../controllers/aiSupportControllers.js";

const router = express.Router();

// Create a conversation for a guest or authenticated user.
router.post(
  "/conversations",
  optionalAuthenticate,
  createAiConversationController
);

// Retrieve only the conversation belonging to the current user or guest token.
router.get(
  "/conversations/:conversationId",
  optionalAuthenticate,
  getAiConversationController
);

// Send a message and receive an AI response.
router.post(
  "/conversations/:conversationId/messages",
  optionalAuthenticate,
  sendAiMessageController
);

// Escalate an AI conversation into the existing Human Support ticket system.
router.post(
  "/conversations/:conversationId/escalate",
  optionalAuthenticate,
  escalateAiConversationController
);

export default router;
