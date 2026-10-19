
import express from "express";
import validate from "../middleware/validateMiddleware.js";
import { getAllUsers, getUserById, updateUser, activateUser, deactivateUser, deleteUser } from "../controllers/userControllers.js";
import { updateUserSchema } from "../validators/userValidator.js";
import authMiddleware from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

router.get("", authMiddleware, requireAdmin, getAllUsers);
router.get("/:id", authMiddleware, requireAdmin, getUserById);
router.put("/:id/update-user", authMiddleware, requireAdmin, validate(updateUserSchema), updateUser);
router.put("/:id/activate", authMiddleware, requireAdmin, activateUser);
router.put("/:id/deactivate", authMiddleware, requireAdmin, deactivateUser);
router.delete("/:id/delete", authMiddleware, requireAdmin, deleteUser);

export default router;