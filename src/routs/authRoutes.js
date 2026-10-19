
import express from "express";
import validate from "../middleware/validateMiddleware.js";
import { register, login, forgotPassword, resetPassword, refreshToken, logout, changePassword } from "../controllers/authControllers.js";
import { registerSchema , loginSchema , forgotPasswordSchema } from "../validators/userValidator.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.post("/register", validate(registerSchema), register)
router.post("/login", validate(loginSchema), login)
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword)
router.post("/reset-password", resetPassword)
router.post("/refresh-token", refreshToken)
router.post("/logout", auth, logout)
router.post("/change-password", auth, changePassword)
export default router;