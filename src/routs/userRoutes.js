
import express from "express";
import validate from "../middleware/validateMiddleware.js";
import { getAllUsers, getUserById, updateUser, activateUser, deactivateUser, deleteUser, updateProfile } from "../controllers/userControllers.js";
import { updateUserSchema, updateProfileSchema } from "../validators/userValidator.js";
import authMiddleware from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

router.get("", authMiddleware, requireAdmin, getAllUsers);
router.get("/:id", authMiddleware, requireAdmin, getUserById);
router.put("/update-profile", authMiddleware, validate(updateProfileSchema), updateProfile )
router.put("/update-user/:id", authMiddleware, requireAdmin, validate(updateUserSchema), updateUser);
router.put("/:id/activate", authMiddleware, requireAdmin, activateUser);
router.put("/:id/deactivate", authMiddleware, requireAdmin, deactivateUser);
router.delete("/:id/delete", authMiddleware, requireAdmin, deleteUser);

export default router;