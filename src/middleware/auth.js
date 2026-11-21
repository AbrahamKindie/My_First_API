
import JWT from "jsonwebtoken";
import prisma from "../db/prisma.js";

// ==========================================
// AUTHENTICATION CONFIGURATION
// ==========================================

const ALLOWED_ROLES = [
  "USER",
  "SHOP_OWNER",
  "ADMIN",
  "SUPER_ADMIN",
];

const LEGACY_ADMIN_PERMISSIONS = new Set([
  "MANAGE_ADMIN_PERMISSIONS",
]);

// ==========================================
// LOAD CURRENT USER FROM DATABASE
// ==========================================

const loadAuthenticatedUser = async (userId) => {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isVerified: true,
      adminRoleId: true,

      // Dynamic Admin Role and database permissions
      adminRole: {
        select: {
          id: true,
          name: true,
          isActive: true,

          permissions: {
            where: {
              permission: {
                isActive: true,
              },
            },

            select: {
              permission: {
                select: {
                  key: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },

      // Shop information
      shop: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });
};

// ==========================================
// BUILD DATABASE-DRIVEN ADMIN PERMISSIONS
// ==========================================

const buildAdminPermissions = (user) => {
  // Super Admin bypasses permission checks.
  if (user.role === "SUPER_ADMIN") {
    return [];
  }

  // Only ADMIN accounts with an active matching role
  // can receive database-driven permissions.
  if (
    user.role !== "ADMIN" ||
    !user.adminRole ||
    !user.adminRole.isActive ||
    user.adminRole.id !== user.adminRoleId
  ) {
    return [];
  }

  const permissions = user.adminRole.permissions
    .map((item) => item.permission)
    .filter(
      (permission) =>
        permission &&
        permission.isActive === true &&
        typeof permission.key === "string" &&
        permission.key.trim().length > 0 &&
        !LEGACY_ADMIN_PERMISSIONS.has(permission.key)
    )
    .map((permission) => permission.key);

  return [...new Set(permissions)];
};

// ==========================================
// BUILD AUTHENTICATED REQUEST USER
// ==========================================

const buildRequestUser = (user) => {
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,

    // Database-driven Admin permissions
    adminPermissions: buildAdminPermissions(user),

    // Super Admin bypass flag
    isSuperAdmin,

    // Assigned Admin Role
    adminRole:
      user.role === "ADMIN" && user.adminRole
        ? {
            id: user.adminRole.id,
            name: user.adminRole.name,
            isActive: user.adminRole.isActive,
          }
        : null,

    adminRoleId:
      user.role === "ADMIN"
        ? user.adminRoleId
        : null,
  };
};

// ==========================================
// VALIDATE CURRENT ACCOUNT
// ==========================================

const validateUser = (user) => {
  if (!user) {
    return {
      valid: false,
      status: 401,
      message: "Account no longer exists.",
    };
  }

  if (!user.isActive) {
    return {
      valid: false,
      status: 403,
      message: "Your account is inactive.",
    };
  }

  if (!ALLOWED_ROLES.includes(user.role)) {
    return {
      valid: false,
      status: 403,
      message: "Your account has an invalid role.",
    };
  }

  // Only ADMIN accounts may have a dynamic Admin Role.
  if (
    user.role !== "ADMIN" &&
    user.adminRoleId !== null
  ) {
    return {
      valid: false,
      status: 403,
      message: "Invalid role assignment for this account.",
    };
  }

  // An ADMIN must have a matching Admin Role.
  if (user.role === "ADMIN") {
    if (!user.adminRoleId || !user.adminRole) {
      return {
        valid: false,
        status: 403,
        message: "No valid Admin Role is assigned to this account.",
      };
    }

    if (user.adminRole.id !== user.adminRoleId) {
      return {
        valid: false,
        status: 403,
        message: "Invalid Admin Role assignment.",
      };
    }

    if (!user.adminRole.isActive) {
      return {
        valid: false,
        status: 403,
        message: "Your assigned Admin Role is inactive.",
      };
    }
  }

  return {
    valid: true,
  };
};

// ==========================================
// ATTACH USER AND SHOP INFORMATION
// ==========================================

const attachUserToRequest = (req, user) => {
  req.user = buildRequestUser(user);

  // Never trust a shop ID supplied by the client.
  // Only attach the database-owned shop to SHOP_OWNER accounts.
  if (user.role === "SHOP_OWNER" && user.shop) {
    req.user.shop = user.shop;
    req.shop = user.shop;
    req.shopId = user.shop.id;
  } else {
    req.shop = null;
    req.shopId = null;
  }
};

// ==========================================
// VERIFY ACCESS TOKEN
// ==========================================

const verifyAccessToken = (authHeader) => {
  if (!authHeader) {
    return {
      valid: false,
      status: 401,
      message: "Authorization header is missing.",
    };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      status: 401,
      message: "Invalid authorization format.",
    };
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return {
      valid: false,
      status: 401,
      message: "Access token is missing.",
    };
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  const decoded = JWT.verify(
    token,
    process.env.JWT_SECRET,
    {
      algorithms: ["HS256"],
    }
  );

  if (
    !decoded ||
    !Number.isSafeInteger(decoded.userId) ||
    decoded.userId <= 0
  ) {
    return {
      valid: false,
      status: 401,
      message: "Invalid authentication token.",
    };
  }

  return {
    valid: true,
    userId: decoded.userId,
  };
};

// ==========================================
// HANDLE JWT AND AUTHENTICATION ERRORS
// ==========================================

const handleAuthenticationError = (
  error,
  res,
  errorLabel
) => {
  if (
    error?.name === "TokenExpiredError" ||
    error?.name === "JsonWebTokenError" ||
    error?.name === "NotBeforeError"
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token.",
    });
  }

  console.error(`${errorLabel}:`, error);

  return res.status(500).json({
    success: false,
    message: "Authentication verification failed.",
  });
};

// ==========================================
// SHARED AUTHENTICATION HANDLER
// ==========================================

const authenticateRequest = async (
  req,
  res,
  next,
  { optional = false } = {}
) => {
  try {
    const authHeader = req.headers.authorization;

    // Allow guests to continue without authentication.
    if (optional && !authHeader) {
      return next();
    }

    // Verify authorization header and JWT.
    const tokenResult = verifyAccessToken(authHeader);

    if (!tokenResult.valid) {
      return res.status(tokenResult.status).json({
        success: false,
        message: tokenResult.message,
      });
    }

    // Always retrieve the latest account and permissions
    // from the database.
    const user = await loadAuthenticatedUser(
      tokenResult.userId
    );

    const validation = validateUser(user);

    if (!validation.valid) {
      return res.status(validation.status).json({
        success: false,
        message: validation.message,
      });
    }

    // Attach authenticated user and database-owned shop.
    attachUserToRequest(req, user);

    return next();
  } catch (error) {
    return handleAuthenticationError(
      error,
      res,
      optional
        ? "Optional Authentication Error"
        : "Authentication Middleware Error"
    );
  }
};

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

const authentication = async (req, res, next) => {
  return authenticateRequest(req, res, next);
};

// ==========================================
// OPTIONAL AUTHENTICATION MIDDLEWARE
// ==========================================

export const optionalAuthenticate = async (
  req,
  res,
  next
) => {
  return authenticateRequest(
    req,
    res,
    next,
    { optional: true }
  );
};

export default authentication;
