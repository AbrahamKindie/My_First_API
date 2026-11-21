
import express from "express";

import validate from "../middleware/validateMiddleware.js";
import auth from "../middleware/auth.js";

import {
  register,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  changePassword,
  verifyAdminPasswordSetup,
  setupAdminPassword,
} from "../controllers/authControllers.js";

import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  adminPasswordSetupSchema,
  verifyAdminPasswordSetupSchema,
} from "../validators/userValidator.js";

const router = express.Router();

// ==========================================
// PUBLIC AUTHENTICATION ROUTES
// ==========================================

// Register Buyer or Shop Owner
router.post(
  "/register",
  validate(registerSchema),
  register
);

// Login
router.post(
  "/login",
  validate(loginSchema),
  login
);

// Forgot Password
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  forgotPassword
);

// Reset Password
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  resetPassword
);

// Refresh Access Token
router.post(
  "/refresh-token",
  refreshToken
);

// Logout
router.post(
  "/logout",
  logout
);

// ==========================================
// ADMIN FIRST-TIME PASSWORD SETUP
// ==========================================

// Verify Admin Password Setup Token
router.post(
  "/admin-password/verify",
  validate(verifyAdminPasswordSetupSchema),
  verifyAdminPasswordSetup
);

// Complete Admin First-Time Password Setup
router.post(
  "/admin-password/setup",
  validate(adminPasswordSetupSchema),
  setupAdminPassword
);

// ==========================================
// PROTECTED AUTHENTICATION ROUTES
// ==========================================

// Change Password
router.post(
  "/change-password",
  auth,
  validate(changePasswordSchema),
  changePassword
);

export default router;
