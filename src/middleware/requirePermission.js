
const validPermissions = new Set([
  // USER MANAGEMENT
  "VIEW_USERS",
  "CREATE_USERS",
  "UPDATE_USERS",
  "DELETE_USERS",
  "ACTIVATE_USERS",
  "DEACTIVATE_USERS",

  // SHOP MANAGEMENT
  "VIEW_SHOPS",
  "UPDATE_SHOPS",
  "ACTIVATE_SHOPS",
  "DEACTIVATE_SHOPS",

  // PRODUCT MANAGEMENT
  "VIEW_PRODUCTS",
  "ACTIVATE_PRODUCTS",
  "DEACTIVATE_PRODUCTS",

  // ADMIN MANAGEMENT
  "VIEW_ADMINS",
  "CREATE_ADMINS",
  "UPDATE_ADMINS",
  "ACTIVATE_ADMINS",
  "DEACTIVATE_ADMINS",
  "DELETE_ADMINS",
  "RESEND_ADMIN_SETUP_EMAIL",

  // ADMIN ROLE MANAGEMENT
  "VIEW_ADMIN_ROLES",
  "CREATE_ADMIN_ROLES",
  "UPDATE_ADMIN_ROLES",
  "DELETE_ADMIN_ROLES",
  "MANAGE_ADMIN_ROLE_PERMISSIONS",
  "ASSIGN_ADMIN_ROLES",

  // ACTIVITY LOGS
  "VIEW_ACTIVITY_LOGS",

  // CATEGORY MANAGEMENT
  "VIEW_CATEGORIES",
  "CREATE_CATEGORIES",
  "UPDATE_CATEGORIES",
  "DELETE_CATEGORIES",

  // ORDER MANAGEMENT
  "VIEW_ORDERS",
  "UPDATE_ORDERS",
  "CANCEL_ORDERS",

  // PAYMENT MANAGEMENT
  "VIEW_PAYMENTS",
  "UPDATE_PAYMENTS",
  "REFUND_PAYMENTS",

  // DISCOUNT MANAGEMENT
  "VIEW_DISCOUNTS",
  "CREATE_DISCOUNTS",
  "UPDATE_DISCOUNTS",
  "DELETE_DISCOUNTS",

  // REVIEW MANAGEMENT
  "VIEW_REVIEWS",
  "DELETE_REVIEWS",

  // PRODUCT REPORT MANAGEMENT
  "VIEW_PRODUCT_REPORTS",
  "REVIEW_PRODUCT_REPORTS",

  // NOTIFICATION MANAGEMENT
  "VIEW_NOTIFICATIONS",
  "CREATE_NOTIFICATIONS",
  "UPDATE_NOTIFICATIONS",
  "DELETE_NOTIFICATIONS",
  "SEND_NOTIFICATIONS",

  // REPORTS AND ANALYTICS
  "VIEW_REPORTS",
  "EXPORT_REPORTS",

  // SYSTEM SETTINGS
  "VIEW_SETTINGS",
  "UPDATE_SETTINGS",

  // SUPPORT MANAGEMENT
  "CREATE_SUPPORT_TICKETS",
  "VIEW_OWN_SUPPORT_TICKETS",
  "REPLY_OWN_SUPPORT_TICKETS",
  "CLOSE_OWN_SUPPORT_TICKETS",
  "REOPEN_OWN_SUPPORT_TICKETS",
  "VIEW_SHOP_CUSTOMER_TICKETS",
  "REPLY_SHOP_CUSTOMER_TICKETS",
  "UPDATE_SHOP_CUSTOMER_TICKET_STATUS",
]);

const isValidPermission = (permission) =>
  typeof permission === "string" &&
  validPermissions.has(permission);

const requirePermission = (requiredPermission) => {
  if (
    typeof requiredPermission !== "string" &&
    typeof requiredPermission !== "function"
  ) {
    throw new TypeError(
      "requirePermission expects a permission key or a permission callback."
    );
  }

  if (
    typeof requiredPermission === "string" &&
    !isValidPermission(requiredPermission)
  ) {
    throw new TypeError(
      `Invalid or unsupported permission: ${requiredPermission}`
    );
  }

  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      const { role, isActive } = req.user;

      if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
        return res.status(403).json({
          success: false,
          message: "Administrator access required.",
        });
      }

      if (isActive !== true) {
        return res.status(403).json({
          success: false,
          message: "Your administrator account is inactive.",
        });
      }

      // Super Admin bypasses permission checks.
      if (role === "SUPER_ADMIN") {
        return next();
      }

      let permission;

      try {
        permission =
          typeof requiredPermission === "function"
            ? requiredPermission(req)
            : requiredPermission;
      } catch (error) {
        console.error("[PERMISSION RESOLUTION ERROR]", error);

        return res.status(400).json({
          success: false,
          message: "Unable to determine the required permission.",
        });
      }

      if (!isValidPermission(permission)) {
        return res.status(400).json({
          success: false,
          message: "Invalid or unsupported permission.",
        });
      }

      const permissions = Array.isArray(req.user.adminPermissions)
        ? req.user.adminPermissions
        : [];

      if (!permissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action.",
          requiredPermission: permission,
        });
      }

      return next();
    } catch (error) {
      console.error("[REQUIRE PERMISSION ERROR]", error);

      return res.status(500).json({
        success: false,
        message: "An error occurred while checking permissions.",
      });
    }
  };
};

export default requirePermission;
