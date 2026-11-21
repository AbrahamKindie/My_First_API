
import express from "express";
import auth from "../middleware/auth.js";

import {
  getNotificationsController,
  getUnreadCountController,
  markNotificationReadController,
  markAllNotificationsReadController,
  deleteNotificationController,
} from "../controllers/notificationControllers.js";

const router = express.Router();

// All notification routes require authentication
router.use(auth);

// Get all notifications
router.get("/", getNotificationsController);

// Get unread notification count
router.get("/unread-count", getUnreadCountController);

// Mark all notifications as read
router.patch("/read-all", markAllNotificationsReadController);

// Mark one notification as read
router.patch("/:id/read", markNotificationReadController);

// Delete one notification
router.delete("/:id", deleteNotificationController);

export default router;
