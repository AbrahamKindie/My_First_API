
import bcrypt from "bcrypt";
import prisma from "../db/prisma.js";
import { registerUser, loginUser, refreshAccessToken, logoutUser, forgotPasswordUser, resetPasswordUser } from "../services/authServices.js";


export const register = async (req, res) => {

    try {
        const user = await registerUser(req.body);

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                dateOfBirth: user.dateOfBirth,
                sort_order: user.sort_order,
                gender: user.gender,
                address: user.address,
                city: user.city,
                country: user.country,
                profileImage: user.profileImage,
                isVerified: user.isVerified,
                isActive: user.isActive,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });

    } catch (error) {
        console.error("Error registering user:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "Email is already registered"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


 export const login = async (req, res) => {

    try {

        const loginuser = await loginUser(req, res);
        
        res.status(200).json({  
            success: true,
            message: "Login successful",
            accessToken: loginuser.token,
            refreshToken: loginuser.refreshToken,
            user: loginuser.user

        });
        
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const refreshToken = async (req, res) => {
    try {
        
   const newAccessToken = await refreshAccessToken(req.body);
    res.json({
        message: "Token refreshed successfully",
        accessToken: newAccessToken
    });
} catch (error) {
    console.error("Error refreshing token:", error);

    res.status(500).json(
        { 
            message: "Internal server error" 
        });
}

};

export const logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        await logoutUser(refreshToken);

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });

    } catch (error) {
        console.error("Error during logout:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Internal server error"
        });
    }
};

export const changePassword = async (req, res) => {
    try {

        const { currentPassword, newPassword } = req.body;

        await changePassword(currentPassword, newPassword);

        return res.status(200).json({
            message: "Password changed successfully"
        });

    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

 export const forgotPassword = async (req, res) => {
    try {

        await forgotPasswordUser(req, res);

    } catch (error) {

        console.error("Error forgetting password:", error);

        res.status(500).json({ message: "Internal server error" });
    }
};
 
export const resetPassword = async (req, res) => {
    try {
        await resetPasswordUser(req,res);

    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

