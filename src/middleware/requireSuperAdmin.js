
import prisma from "../db/prisma.js";

const requireSuperAdmin = async (req, res, next) => {
  try {
    // ==========================================
    // AUTHENTICATION CHECK
    // ==========================================

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const userId = req.user.userId ?? req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication credentials.",
      });
    }

    // ==========================================
    // FETCH CURRENT ACCOUNT
    // ==========================================

    const superAdmin = await prisma.user.findUnique({
      where: {
        id: Number(userId),
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    // ==========================================
    // ROLE CHECK
    // ==========================================

    if (superAdmin.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can perform this action.",
      });
    }

    // ==========================================
    // ACCOUNT STATUS CHECK
    // ==========================================

    if (!superAdmin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your Super Admin account is deactivated.",
      });
    }

    // ==========================================
    // AUTHORIZED
    // ==========================================

    return next();
  } catch (error) {
    console.error("Super Admin Middleware Error:", error);

    return res.status(500).json({
      success: false,
      message: "An error occurred while checking Super Admin access.",
    });
  }
};

export default requireSuperAdmin;
