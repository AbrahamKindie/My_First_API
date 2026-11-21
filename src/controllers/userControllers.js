
import { unlink } from "node:fs/promises";

import {
    fetchAllUsers,
    profile,
    updateUserProfile,
    getOneUser,
    userUpdate,
    userActivate,
    userDeactivate,
    userDelete,
} from "../services/userServices.js";

// ==========================================
// GET ALL USERS
// ==========================================

export const getAllUsers = async (req, res) => {
    try {
        const { users, totalUsers } = await fetchAllUsers();

        return res.status(200).json({
            success: true,
            users,
            totalUsers,
        });
    } catch (error) {
        console.error("Error fetching users:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

// ==========================================
// GET LOGGED-IN USER PROFILE
// ALL AUTHENTICATED ROLES
// ==========================================

export const getProfile = async (req, res) => {
    try {
        const result = await profile(req.user.userId);

        return res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching profile:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error.",
        });
    }
};

// ==========================================
// UPDATE LOGGED-IN USER PROFILE
// ROLE-BASED RESTRICTIONS
// ==========================================


export const updateProfile = async (req, res) => {
    try {
        if (!req.user?.userId || !req.user?.role) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const result = await updateUserProfile(
            req.user.userId,
            req.user.role,
            req.body
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error("Error updating profile:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error.",
        });
    }
};


// ==========================================
// UPLOAD PROFILE PICTURE
// ALL AUTHENTICATED ROLES
// ==========================================

export const uploadProfilePicture = async (req, res) => {
    let uploadedFilePath = req.file?.path;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select a profile picture.",
            });
        }

        const profileImage = `/uploads/profiles/${req.file.filename}`;

        const result = await updateUserProfile(
            req.user.userId,
            req.user.role,
            { profileImage }
        );

        // Database update succeeded. Keep the uploaded file.
        uploadedFilePath = null;

        return res.status(200).json({
            success: true,
            message: "Profile picture updated successfully.",
            user: result.user,
        });
    } catch (error) {
        console.error("Error uploading profile picture:", error);

        // Remove the newly uploaded file if the database update fails.
        if (uploadedFilePath) {
            try {
                await unlink(uploadedFilePath);
            } catch (cleanupError) {
                console.error(
                    "Error cleaning up uploaded profile picture:",
                    cleanupError
                );
            }
        }

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error.",
        });
    }
};

// ==========================================
// GET USER BY ID
// ==========================================

export const getUserById = async (req, res) => {
    try {
        return await getOneUser(req, res);
    } catch (error) {
        console.error("Error fetching user by ID:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

// ==========================================
// UPDATE MARKETPLACE USER
// ==========================================

export const updateUser = async (req, res) => {
    try {
        return await userUpdate(req, res);
    } catch (error) {
        console.error("Error updating user:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

// ==========================================
// ACTIVATE USER
// ==========================================

export const activateUser = async (req, res) => {
    try {
        return await userActivate(req, res);
    } catch (error) {
        console.error("Error activating user:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

// ==========================================
// DEACTIVATE USER
// ==========================================

export const deactivateUser = async (req, res) => {
    try {
        return await userDeactivate(req, res);
    } catch (error) {
        console.error("Error deactivating user:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

// ==========================================
// DELETE USER
// ==========================================

export const deleteUser = async (req, res) => {
    try {
        return await userDelete(req, res);
    } catch (error) {
        console.error("Error deleting user:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};
