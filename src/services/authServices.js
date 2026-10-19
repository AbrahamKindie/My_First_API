
import bcrypt from "bcrypt";
import prisma from "../db/prisma.js";
import JWT from "jsonwebtoken";
import crypto from "crypto";
import transporter from "../utils/email.js";

const sort_order = async () => {
    const lastUser = await prisma.user.findFirst({
        orderBy: {
            sort_order: "desc"
        }
    });

    return lastUser ? lastUser.sort_order + 1 : 1;
}
const nextSortOrder = await sort_order();

export const registerUser = async (userData) => {
    const {
        name,
        email,
        password,
        phone,
        dateOfBirth,
        gender,
        address,
        city,
        country,
        profileImage
    } = userData;

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        const existingUser = await prisma.user.findUnique({
            where: {
                email: cleanEmail
            }
        });

        const existingPhone = await prisma.user.findUnique({
            where: {
                phone: phone
            }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered"
            });
        }

        if (existingPhone) {
            return res.status(409).json({
                success: false,
                message: "Phone number already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name: cleanName,
                email: cleanEmail,
                password: hashedPassword,
                sort_order: nextSortOrder,
                phone,
                dateOfBirth: dateOfBirth
                    ? new Date(dateOfBirth)
                    : null,
                gender: gender,
                address: address,
                city: city,
                country: country,
                profileImage: profileImage
            }
        });

        return user;

    };

     const hashedRefreshToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
        };

  export const loginUser = async (req,res)=> {

    const { email, password } = req.body;

    const cleanEmail = email.trim().toLowerCase();
    
        const user = await prisma.user.findUnique({
            where: {
                email: cleanEmail
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = JWT.sign(
            { 
                userId: user.id 
            },
            process.env.JWT_SECRET, 
            {
            expiresIn: "1h"
        });

        const refreshToken = crypto.randomBytes(64).toString("hex");
        const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const hashedToken = hashedRefreshToken(refreshToken);

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                refreshToken: hashedToken,
                refreshTokenExpiry: refreshTokenExpiry
            }
        });

    return {
        token: token,
        refreshToken: refreshToken,
        user
    };
}

export const refreshAccessToken = async (req, res) =>{

    const {refreshToken }= req.body;
      
    if(!refreshToken){
        return res.status(401).json({
            message: "Refresh token is required"
        });
    }
     
    const hashRefreshToken = hashedRefreshToken(refreshToken);

    const user= await prisma.user.findFirst({
        where: {
            refreshToken: hashRefreshToken
        }
    });

    if(!user){
        return res.status(401).json({
            message: "Invalid refresh token"
        });
    }

    if(!user.refreshTokenExpiry || user.refreshTokenExpiry < new Date()){
        return res.status(401).json({
            message: "Invalid Refresh token or Refresh token has expired"
        });
    }

    const newAccessToken = JWT.sign(
        {
            userId: user.id
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1h"
        }
    );

    return newAccessToken;

};


export const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
    return res.status(400).json({
        message: "Old password and new password are required"
    });
}

if (
    typeof oldPassword !== "string" || typeof newPassword !== "string") 
    {
    return res.status(400).json({
        message: "Passwords must be strings"
    });
    }

    if (newPassword.length < 8) {
    return res.status(400).json({
        message: "New password must be at least 8 characters long"
    });
}

    try {
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.userId
            }
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid old password"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: {
                id: req.user.userId
            },
            data: {
                password: hashedPassword
            }
        });

        return res.status(200).json({
            message: "Password changed successfully"
        });

    } catch (error) {
        console.error("Error changing password:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }

};


export const forgotPasswordUser = async (req, res) => {
    try {
          const { email } = req.body;     

        if (!email || typeof email !== "string") {
            return res.status(400).json({
                message: "Please Provide Valid Email Address"
            });
        }

        const CleanEmail = email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
            where: {
                email: CleanEmail
            }

        });

        if (!user) {
            return res.status(404).json({
                message: "If the email is registered, a password reset link has been sent."
            });
        }

        // Generate a reset token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Save the reset token and expiry in the database
        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                resetPasswordToken: resetToken,
                resetPasswordExpires: resetTokenExpiry
            }
        });

        const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;

        // Send email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Reset Your Password",
            text: `Click this link to reset your password: ${resetLink}`
        });

        return res.status(200).json({
            success: true,
            message: "If the email is registered, a password reset link has been sent.",
            token: resetToken // For testing purposes, you might want to return the token in the response. Remove this in production.
        });

    } catch (error) {
        console.error("Error in forgot password:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }

};

export const  resetPasswordUser = async (req, res) => {

    const { token, newPassword } = req.body;

    if( !token || !newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({
            message: "Invalid request. Please provide a valid token and a new password with at least 8 characters."
        });
    }

    try {
        const user = await prisma.user.findFirst({
            where: {
                resetPasswordToken: token
            }
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid or expired reset token"
            });
        }

        if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
            return res.status(400).json({
                message: "Invalid or expired reset token"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update the user's password
        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        
        });

        return res.status(200).json({
            success: true,
            message: "Password reset successfully"
        });

    } catch (error) {
        console.error("Error in reset password:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export const logoutUser = async(refreshToken) => {

    if (!refreshToken) {
        return res.status(400).json({
            message: "Refresh token is required"
        });
    }

    const hashRefreshToken = hashedRefreshToken(refreshToken);
     
    const user = await prisma.user.findFirst({
        where: {
            refreshToken: hashRefreshToken
        }
    });

    if (!user) {
        return res.status(401).json({
            message: "Logout failed. Invalid refresh token"
        });
    }
  
     await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                refreshToken: null,
                refreshTokenExpiry: null
            }
        });
      return true;

    };
    
    // export default {
    //     registerUser,
    //     loginUser,
    //     refreshAccessToken,
    //     logoutUser
    // };