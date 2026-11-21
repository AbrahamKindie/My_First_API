
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  forgotPasswordUser,
  resetPasswordUser,
  changePassword as changePasswordUser,
  verifyAdminPasswordSetup as verifyAdminPasswordSetupService,
  setupAdminPassword as setupAdminPasswordService,
} from "../services/authServices.js";

// ==========================================
// REUSABLE ERROR HANDLER
// ==========================================

const handleAuthError = (res, error, context) => {
  console.error(`\n${context}:`);
  console.error(error);

  if (error.code === "P2002") {
    const rawTarget = error.meta?.target || [];

    const target = Array.isArray(rawTarget)
      ? rawTarget.map(String)
      : [String(rawTarget)];

    const isPhoneError = target.some((field) =>
      field.toLowerCase().includes("phone")
    );

    return res.status(409).json({
      success: false,
      message: isPhoneError
        ? "Phone number already exists."
        : "Email is already registered.",
    });
  }

  const statusCode =
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
      ? error.statusCode
      : 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode < 500
        ? error.message
        : "Internal server error.",
  });
};

// ==========================================
// REGISTER
// ==========================================

export const register = async (req, res) => {
  try {
    const result = await registerUser(req.body || {});

    return res.status(201).json({
      success: true,
      message: result.message,
      registrationType: result.registrationType,
      nextStep: result.nextStep,
      user: result.user,
      ...(result.shop ? { shop: result.shop } : {}),
    });
  } catch (error) {
    return handleAuthError(res, error, "User Registration Error");
  }
};

// ==========================================
// LOGIN
// ==========================================

export const login = async (req, res) => {
  try {
    const result = await loginUser(req, res);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      accessToken: result.token,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    return handleAuthError(res, error, "Login Error");
  }
};

// ==========================================
// REFRESH TOKEN
// ==========================================

export const refreshToken = async (req, res) => {
  try {
    const result = await refreshAccessToken(
      req.body?.refreshToken
    );

    return res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully.",
      accessToken: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    return handleAuthError(res, error, "Refresh Token Error");
  }
};

// ==========================================
// LOGOUT
// ==========================================

export const logout = async (req, res) => {
  try {
    await logoutUser(req.body?.refreshToken);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    return handleAuthError(res, error, "Logout Error");
  }
};

// ==========================================
// CHANGE PASSWORD
// ==========================================

export const changePassword = async (req, res) => {
  try {
    return await changePasswordUser(req, res);
  } catch (error) {
    return handleAuthError(res, error, "Change Password Error");
  }
};

// ==========================================
// FORGOT PASSWORD
// ==========================================

export const forgotPassword = async (req, res) => {
  try {
    return await forgotPasswordUser(req, res);
  } catch (error) {
    return handleAuthError(res, error, "Forgot Password Error");
  }
};

// ==========================================
// RESET PASSWORD
// ==========================================

export const resetPassword = async (req, res) => {
  try {
    return await resetPasswordUser(req, res);
  } catch (error) {
    return handleAuthError(res, error, "Reset Password Error");
  }
};

// ==========================================
// VERIFY ADMIN PASSWORD SETUP LINK
// ==========================================

export const verifyAdminPasswordSetup = async (req, res) => {
  try {
    const result = await verifyAdminPasswordSetupService(
      req.body?.token
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleAuthError(
      res,
      error,
      "Admin Password Setup Verification Error"
    );
  }
};

// ==========================================
// SET ADMIN FIRST-TIME PASSWORD
// ==========================================

export const setupAdminPassword = async (req, res) => {
  try {
    const result = await setupAdminPasswordService(
      req.body?.token,
      req.body?.newPassword,
      req.body?.confirmPassword
    );

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return handleAuthError(
      res,
      error,
      "Admin Password Setup Error"
    );
  }
};
