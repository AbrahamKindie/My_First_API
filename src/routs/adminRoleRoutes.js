
import express from "express";

import {
  getAvailableAdminPermissionsController,
  getAdminRolesController,
  getAdminRoleByIdController,
  createAdminRoleController,
  updateAdminRoleController,
  updateAdminRoleStatusController,
  deleteAdminRoleController,
  assignAdminRoleController,
} from "../controllers/adminRoleControllers.js";

import authentication from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// AUTHENTICATION
// All routes require an authenticated user.
// The service enforces Admin permissions.
// ==========================================

router.use(authentication);

// ==========================================
// ADMIN ROLE PERMISSIONS
// ==========================================

// GET /admin/roles/permissions
router.get(
  "/roles/permissions",
  getAvailableAdminPermissionsController
);

// ==========================================
// ADMIN ROLE CRUD
// ==========================================

// GET /admin/roles
router.get(
  "/roles",
  getAdminRolesController
);

// GET /admin/roles/:id
router.get(
  "/roles/:id",
  getAdminRoleByIdController
);

// POST /admin/roles
router.post(
  "/roles",
  createAdminRoleController
);

// PUT /admin/roles/:id
router.put(
  "/roles/:id",
  updateAdminRoleController
);

// PATCH /admin/roles/:id/status
router.patch(
  "/roles/:id/status",
  updateAdminRoleStatusController
);

// DELETE /admin/roles/:id
router.delete(
  "/roles/:id",
  deleteAdminRoleController
);

// ==========================================
// ASSIGN ROLE TO ADMIN
// PATCH /admin/:adminId/role
// ==========================================

router.patch(
  "/:adminId/role",
  assignAdminRoleController
);

export default router;
