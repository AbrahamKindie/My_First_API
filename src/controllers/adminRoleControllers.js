
import {
  getAvailableAdminPermissions,
  getAdminRoles,
  getAdminRoleById,
  createAdminRole,
  updateAdminRole,
  updateAdminRoleStatus,
  deleteAdminRole,
  assignAdminRole,
} from "../services/adminRoleServices.js";

// ==========================================
// COMMON ERROR HANDLER
// ==========================================

const handleControllerError = (res, error) => {
  console.error("Admin Role Controller Error:", error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "An unexpected server error occurred.",
  });
};

// ==========================================
// ID VALIDATION
// ==========================================

const getPositiveSafeInteger = (value) => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

// ==========================================
// VALIDATE AUTHENTICATED ADMIN
// AUTHENTICATION MIDDLEWARE MUST SET
// req.user.userId
// ==========================================

const getAuthenticatedAdminId = (req, res) => {
  const actorId = getPositiveSafeInteger(req.user?.userId);

  if (actorId === null) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });

    return null;
  }

  return actorId;
};

// ==========================================
// VALIDATE REQUEST BODY
// ==========================================

const isValidRequestBody = (body) => {
  return (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body)
  );
};

// ==========================================
// VALIDATE ROUTE ID
// ==========================================

const getValidatedRouteId = (value, fieldName, res) => {
  const id = getPositiveSafeInteger(value);

  if (id === null) {
    res.status(400).json({
      success: false,
      message: `Invalid ${fieldName}.`,
    });

    return null;
  }

  return id;
};

// ==========================================
// GET AVAILABLE PERMISSIONS
// GET /admin/roles/permissions
// VIEW_ADMIN_ROLES REQUIRED
// ==========================================

export const getAvailableAdminPermissionsController = async (
  req,
  res
) => {
  try {
    const actorId = getAuthenticatedAdminId(req, res);
    if (actorId === null) return;

    const permissions = await getAvailableAdminPermissions(actorId);

    return res.status(200).json({
      success: true,
      message: "Available Admin permissions retrieved successfully.",
      count: permissions.length,
      data: permissions,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ==========================================
// GET ALL ADMIN ROLES
// GET /admin/roles
// VIEW_ADMIN_ROLES REQUIRED
// ==========================================

export const getAdminRolesController = async (req, res) => {
  try {
    const actorId = getAuthenticatedAdminId(req, res);
    if (actorId === null) return;

    const roles = await getAdminRoles(actorId);

    return res.status(200).json({
      success: true,
      message: "Admin roles retrieved successfully.",
      count: roles.length,
      data: roles,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ==========================================
// GET ADMIN ROLE BY ID
// GET /admin/roles/:id
// VIEW_ADMIN_ROLES REQUIRED
// ==========================================

export const getAdminRoleByIdController = async (req, res) => {
  try {
    const actorId = getAuthenticatedAdminId(req, res);
    if (actorId === null) return;

    const roleId = getValidatedRouteId(
      req.params.id,
      "Admin role ID",
      res
    );

    if (roleId === null) return;

    const role = await getAdminRoleById(roleId, actorId);

    return res.status(200).json({
      success: true,
      message: "Admin role retrieved successfully.",
      data: role,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ==========================================
// CREATE ADMIN ROLE
// POST /admin/roles
// CREATE_ADMIN_ROLES REQUIRED
// ==========================================

export const createAdminRoleController = async (req, res) => {
  try {
    const actorId = getAuthenticatedAdminId(req, res);
    if (actorId === null) return;

    if (!isValidRequestBody(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Admin role data.",
      });
    }

    const role = await createAdminRole(req.body, actorId);

    return res.status(201).json({
      success: true,
      message: "Admin role created successfully.",
      data: role,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ==========================================
// UPDATE ADMIN ROLE
// PUT /admin/roles/:id
// UPDATE_ADMIN_ROLES REQUIRED
// ==========================================

export const updateAdminRoleController = async (req, res) => {
  try {
    const actorId = getAuthenticatedAdminId(req, res);
    if (actorId === null) return;

    const roleId = getValidatedRouteId(
      req.params.id,
      "Admin role ID",
      res
    );

    if (roleId === null) return;

    if (!isValidRequestBody(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Admin role update data.",
      });
    }

    const role = await updateAdminRole(roleId, req.body, actorId);

    return res.status(200).json({
      success: true,
      message: "Admin role updated successfully.",
      data: role,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ==========================================
// ACTIVATE / DEACTIVATE ADMIN ROLE
// PATCH /admin/roles/:id/status
// UPDATE_ADMIN_ROLES REQUIRED
// ==========================================

export const updateAdminRoleStatusController = async (req, res) => {
  try {
    const actorId = getAuthenticatedAdminId(req, res);
    if (actorId === null) return;

    const roleId = getValidatedRouteId(
      req.params.id,
      "Admin role ID",
      res
    );

    if (roleId === null) return;

    if (!isValidRequestBody(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role status data.",
      });
    }

    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    const role = await updateAdminRoleStatus(
      roleId,
      isActive,
      actorId
    );

    return res.status(200).json({
      success: true,
      message: role.isActive
        ? "Admin role activated successfully."
        : "Admin role deactivated successfully.",
      data: role,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ==========================================
// DELETE ADMIN ROLE
// DELETE /admin/roles/:id
// DELETE_ADMIN_ROLES REQUIRED
// ==========================================

export const deleteAdminRoleController = async (req, res) => {
  try {
    const actorId = getAuthenticatedAdminId(req, res);
    if (actorId === null) return;

    const roleId = getValidatedRouteId(
      req.params.id,
      "Admin role ID",
      res
    );

    if (roleId === null) return;

    const result = await deleteAdminRole(roleId, actorId);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ==========================================
// ASSIGN ADMIN ROLE
// PATCH /admin/:adminId/role
// ASSIGN_ADMIN_ROLES REQUIRED
// ==========================================

export const assignAdminRoleController = async (req, res) => {
  try {
    const actorId = getAuthenticatedAdminId(req, res);
    if (actorId === null) return;

    const adminId = getValidatedRouteId(
      req.params.adminId,
      "Admin ID",
      res
    );

    if (adminId === null) return;

    if (!isValidRequestBody(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Admin role assignment data.",
      });
    }

    const adminRoleId = getPositiveSafeInteger(req.body.adminRoleId);

    if (adminRoleId === null) {
      return res.status(400).json({
        success: false,
        message: "A valid Admin role ID is required.",
      });
    }

    const admin = await assignAdminRole(
      adminId,
      adminRoleId,
      actorId
    );

    return res.status(200).json({
      success: true,
      message: "Admin role assigned successfully.",
      data: admin,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
