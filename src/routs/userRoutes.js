
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

// ==========================================
// PERSONAL PROFILE
// ==========================================

// View own profile
router.get(
    "/profile",
    authMiddleware,
    getProfile
);

// Update own profile
router.put(
    "/update-profile",
    authMiddleware,
    validate(updateProfileSchema),
    updateProfile
);

// Upload own profile picture
router.put(
    "/profile-picture",
    authMiddleware,
    uploadProfileImage.single("profileImage"),
    uploadProfilePicture
);

// ==========================================
// MARKETPLACE USER MANAGEMENT
// ==========================================

// View all users
router.get(
    "",
    authMiddleware,
    requirePermission("VIEW_USERS"),
    getAllUsers
);

// View user details
router.get(
    "/:id",
    authMiddleware,
    requirePermission("VIEW_USERS"),
    getUserById
);

// Update user
router.put(
    "/update-user/:id",
    authMiddleware,
    requirePermission("UPDATE_USERS"),
    validate(updateUserSchema),
    updateUser
);

// Activate user
router.put(
    "/:id/activate",
    authMiddleware,
    requirePermission("ACTIVATE_USERS"),
    activateUser
);

// Deactivate user
router.put(
    "/:id/deactivate",
    authMiddleware,
    requirePermission("DEACTIVATE_USERS"),
    deactivateUser
);

// Delete user
router.delete(
    "/:id/delete",
    authMiddleware,
    requirePermission("DELETE_USERS"),
    deleteUser
);

export default router;
