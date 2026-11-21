import express from "express";
import validate from "../middleware/validateMiddleware.js";
import authMiddleware from "../middleware/auth.js";
import requirePermission from "../middleware/requirePermission.js";
import uploadProfileImage from "../middleware/uploadProfileImage.js";

import {
    getAllUsers,
    getUserById,
    updateUser,
    activateUser,
    deactivateUser,
    deleteUser,
    getProfile,
    updateProfile,
    uploadProfilePicture,
} from "../controllers/userControllers.js";

import {
    updateUserSchema,
    updateProfileSchema,
} from "../validators/userValidator.js";

const router = express.Router();

// PERSONAL PROFILE
router.get("/profile", authMiddleware, getProfile);
router.put("/update-profile", authMiddleware, validate(updateProfileSchema), updateProfile);
router.put("/profile-picture", authMiddleware, uploadProfileImage.single("profileImage"), uploadProfilePicture);

// MARKETPLACE USER MANAGEMENT
router.get("", authMiddleware, requirePermission("MANAGE_USERS"), getAllUsers);
router.get("/:id", authMiddleware, requirePermission("MANAGE_USERS"), getUserById);
router.put("/update-user/:id", authMiddleware, requirePermission("MANAGE_USERS"), validate(updateUserSchema), updateUser);
router.put("/:id/activate", authMiddleware, requirePermission("MANAGE_USERS"), activateUser);
router.put("/:id/deactivate", authMiddleware, requirePermission("MANAGE_USERS"), deactivateUser);
router.delete("/:id/delete", authMiddleware, requirePermission("MANAGE_USERS"), deleteUser);

export default router;