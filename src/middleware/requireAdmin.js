
const requireAdmin = (req, res, next) => {
  try {
    // ==========================================
    // 1. ENSURE AUTHENTICATION
    // ==========================================

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // ==========================================
    // 2. CHECK ACCOUNT STATUS
    // ==========================================

    if (req.user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    // ==========================================
    // 3. VERIFY ADMIN ROLE
    // ==========================================

    const allowedRoles = [
      "ADMIN",
      "SUPER_ADMIN",
    ];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Admin privileges required.",
      });
    }

    // ==========================================
    // 4. ALLOW ACCESS
    // ==========================================

    return next();

  } catch (error) {
    console.error(
      "Admin Authorization Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export default requireAdmin;
