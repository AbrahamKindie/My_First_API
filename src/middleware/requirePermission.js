
const legacyPermissions = new Set([
  "MANAGE_ADMIN_PERMISSIONS",
]);

const isValidPermission = (permission) =>
  typeof permission === "string" &&
  /^[A-Z][A-Z0-9_]*$/.test(permission) &&
  !legacyPermissions.has(permission);

// ==========================================
// REQUIRE ADMIN PERMISSION
// SUPPORTS STATIC AND DYNAMIC PERMISSIONS
// ==========================================

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
      // Authentication middleware must run first.
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      const { role, isActive } = req.user;

      // Only Admin and Super Admin accounts are accepted.
      if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
        return res.status(403).json({
          success: false,
          message: "Administrator access required.",
        });
      }

      // Reject inactive Admin accounts.
      if (isActive !== true) {
        return res.status(403).json({
          success: false,
          message: "Your administrator account is inactive.",
        });
      }

      // Super Admin has unrestricted access.
      if (role === "SUPER_ADMIN") {
        return next();
      }

      // Resolve the permission for this request.
      let permission;

      try {
        permission =
          typeof requiredPermission === "function"
            ? requiredPermission(req)
            : requiredPermission;
      } catch (error) {
        console.error(
          "[PERMISSION RESOLUTION ERROR]",
          error
        );

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

      // Permissions must be loaded by authentication middleware.
      const permissions = Array.isArray(
        req.user.adminPermissions
      )
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
      console.error(
        "[REQUIRE PERMISSION ERROR]",
        error
      );

      return res.status(500).json({
        success: false,
        message: "An error occurred while checking permissions.",
      });
    }
  };
};

export default requirePermission;
