
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../services/notificationServices.js";

// Get logged-in user's notifications
export const getNotificationsController = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await getUserNotifications(
      userId,
      {
        page: req.query.page,
        limit: req.query.limit,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: result.notifications,
      unreadCount: result.unreadCount,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to retrieve notifications",
    });
  }
};

// Get unread notification count
export const getUnreadCountController = async (req, res) => {
  try {
    const userId = req.user.userId;

    const count = await getUnreadNotificationCount(userId);

    return res.status(200).json({
      success: true,
      message: "Unread notification count retrieved successfully",
      data: {
        unreadCount: count,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to retrieve unread count",
    });
  }
};

// Mark one notification as read
export const markNotificationReadController = async (
  req,
  res
) => {
  try {
    const userId = req.user.userId;

    const notification = await markNotificationAsRead(
      userId,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to mark notification as read",
    });
  }
};

// Mark all notifications as read
export const markAllNotificationsReadController = async (
  req,
  res
) => {
  try {
    const userId = req.user.userId;

    const result = await markAllNotificationsAsRead(userId);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to mark all notifications as read",
    });
  }
};

// Delete one notification
export const deleteNotificationController = async (
  req,
  res
) => {
  try {
    const userId = req.user.userId;

    const result = await deleteNotification(
      userId,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to delete notification",
    });
  }
};
