
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

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new buyer or shop owner
 *     description: Creates a new ShopEase account.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Registration data validated by registerSchema.
 *             additionalProperties: true
 *     responses:
 *       201:
 *         description: Account registered successfully
 *       400:
 *         description: Invalid registration information
 *       409:
 *         description: Account already exists
 *       500:
 *         description: Internal server error
 */
router.post(
  "/register",
  validate(registerSchema),
  register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login to a ShopEase account
 *     description: Authenticates a user and starts an account session.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Login credentials validated by loginSchema.
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid request information
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post(
  "/login",
  validate(loginSchema),
  login
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset
 *     description: Initiates the password recovery process.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Password recovery data validated by forgotPasswordSchema.
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Password recovery request processed
 *       400:
 *         description: Invalid request information
 *       500:
 *         description: Internal server error
 */
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  forgotPassword
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset account password
 *     description: Resets a user's password using the password reset information.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Reset information validated by resetPasswordSchema.
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired reset information
 *       500:
 *         description: Internal server error
 */
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  resetPassword
);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Requests a new access token using the refresh token.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Access token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 *       500:
 *         description: Internal server error
 */
router.post(
  "/refresh-token",
  refreshToken
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout from a ShopEase account
 *     description: Ends the current authentication session.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Invalid authentication information
 *       500:
 *         description: Internal server error
 */
router.post(
  "/logout",
  logout
);

// ==========================================
// ADMIN FIRST-TIME PASSWORD SETUP
// ==========================================

/**
 * @swagger
 * /auth/admin-password/verify:
 *   post:
 *     summary: Verify administrator password setup token
 *     description: Checks whether an administrator's first-time password setup token is valid.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Setup token data validated by verifyAdminPasswordSetupSchema.
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Setup token verified
 *       400:
 *         description: Invalid or expired setup token
 *       500:
 *         description: Internal server error
 */
router.post(
  "/admin-password/verify",
  validate(verifyAdminPasswordSetupSchema),
  verifyAdminPasswordSetup
);

/**
 * @swagger
 * /auth/admin-password/setup:
 *   post:
 *     summary: Complete administrator first-time password setup
 *     description: Allows an administrator to create their initial password.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Password setup data validated by adminPasswordSetupSchema.
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Administrator password setup completed
 *       400:
 *         description: Invalid or expired setup information
 *       500:
 *         description: Internal server error
 */
router.post(
  "/admin-password/setup",
  validate(adminPasswordSetupSchema),
  setupAdminPassword
);

// ==========================================
// PROTECTED AUTHENTICATION ROUTES
// ==========================================

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change account password
 *     description: Changes the password of the authenticated user.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Password change data validated by changePasswordSchema.
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid password information
 *       401:
 *         description: Authentication required or current password incorrect
 *       500:
 *         description: Internal server error
 */
router.post(
  "/change-password",
  auth,
  validate(changePasswordSchema),
  changePassword
);

export default router;
