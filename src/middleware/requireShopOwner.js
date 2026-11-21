
const requireShopOwner = (req, res, next) => {
  try {
    // ============================================
    // 1. ENSURE AUTHENTICATION
    // ============================================

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // ============================================
    // 2. CHECK USER ACCOUNT STATUS
    // ============================================

    if (req.user.isActive !== true) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    // ============================================
    // 3. VERIFY SHOP OWNER ROLE
    // ============================================

    if (req.user.role !== "SHOP_OWNER") {
      return res.status(403).json({
        success: false,
        message: "Only Shop Owners can access this resource.",
      });
    }

    // ============================================
    // 4. ENSURE REGISTERED SHOP EXISTS
    // ============================================

    // This shop comes from the authenticated user's
    // database relationship, not from client input.
    const shop = req.user.shop;

    if (
      !shop ||
      !Number.isSafeInteger(shop.id) ||
      shop.id <= 0
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have a registered shop.",
      });
    }

    // ============================================
    // 5. CHECK SHOP STATUS
    // ============================================

    if (shop.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your shop is deactivated.",
        code: "SHOP_DEACTIVATED",
        shopStatus: shop.status,
      });
    }

    // ============================================
    // 6. MAKE SHOP AVAILABLE TO CONTROLLERS
    // ============================================

    req.shop = shop;
    req.shopId = shop.id;

    return next();

  } catch (error) {
    console.error(
      "Shop Owner Authorization Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to verify Shop Owner permissions.",
    });
  }
};

export default requireShopOwner;
