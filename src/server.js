
import express from "express";
import bcrypt from "bcrypt";
import prisma from "./db/prisma.js";
import JWT from "jsonwebtoken";
import authMiddleware from "./middleware/auth.js";
import requireAdmin from "./middleware/requireAdmin.js";
import crypto from "crypto";
import transporter from "./utils/email.js";


const app = express();

app.use(express.json());

app.post("/register", async(req, res) => {

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
} = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            message: "All fields are required"
        });
    }

     if (typeof name !== "string"){
        return res.status(400).json({
            message: "Name must be a string"
        });
    }

    if (name.trim().length < 3) {
        return res.status(400).json({
            message: "Name must be at least 3 characters long"
        });
    }

    if (typeof email !== "string") {
        return res.status(400).json({
            message: "Email must be a string"
        });
    }

    const cleanEmail = email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
        return res.status(400).json({
            message: "Please provide a valid email address"
        });
    }

   if (password.length < 8) {
    return res.status(409).json({
        message: "Password must be at least 8 characters long"
    });
}

try{
const existingUser = await prisma.user.findUnique({
    where: {
        email: cleanEmail
    }
});

 if (existingUser) {
    return res.status(400).json({
        message: "Email is already registered"
    });
}
    
    const hashedPassword = await bcrypt.hash(password, 10);
     //console.log(hashedPassword);

     const lastUser = await prisma.user.findFirst({
        orderBy: {
            sort_order: "desc"
        }
    });
    const nextOrder = lastUser ? lastUser.sort_order + 1 : 1;

const user = await prisma.user.create({
    data: {
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        sort_order: nextOrder,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        address,
        city,
        country,
        profileImage
    }
});

    return res.status(201).json({
        message : "user Registered Successfully",
        user: {
        id: user.id,
        sort_order: user.sort_order,
        name: user.name,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
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

    })
} catch (error) {

    console.error("Error registering user:", error);

    if (error.code === "P2002") {
        return res.status(409).json({
            message: "Email is already registered"
        });
    }

    return res.status(500).json({
        message: "Internal server error"
    });
}

});

app.get("/users", authMiddleware, requireAdmin, async (req, res) => {
    
    try{

         const totalUsers = await prisma.user.count();
        const users = await prisma.user.findMany({
            orderBy: {
                sort_order: "asc"
            },
            select: {
                id: true,
                name: true,
                email: true,
                sort_order: true,
                phone: true,
                dateOfBirth: true,
                gender: true,
                address: true,
                city: true,
                country: true,
                profileImage: true,
                isVerified: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true
            }
        });
        res.json({ users, totalUsers });

    } catch (error) {
        console.error("Error fetching users:", error);

        res.status(500).json({ message: "Internal server error" });
    }
});

   const hashedRefreshToken = (token) => {
            return crypto.createHash("sha256").update(token).digest("hex");
        };
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: {
                email: email.trim()
            }
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
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

        res.json({
            message: "Login successful",
            accessToken: token,
            refreshToken: refreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                sort_order: user.sort_order,
                phone: user.phone,
                dateOfBirth: user.dateOfBirth,
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
            },
        });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/refresh-Token", async (req, res) =>{
     try{

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

});

app.post("/logout", authMiddleware, async (req, res) => {
       
    try{
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({
            message: "Refresh token is required"
        });
    }
     
    const user = await prisma.user.findFirst({
        where: {
            refreshToken: refreshToken
        }
    });

    if (!user) {
        return res.status(401).json({
            message: "Logout failed. Invalid refresh token"
        });
    }
  
        await prisma.user.update({
            where: {
                id: req.user.userId
            },
            data: {
                refreshToken: null,
                refreshTokenExpiry: null
            }
        });

        return res.status(200).json({
            message: "Logged out successfully"
        });
    } catch (error) {
        console.error("Error during logout:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/profile", authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.userId
            },
            select: {
                id: true,
                name: true,
                email: true,
                sort_order: true,
                phone: true,
                dateOfBirth: true,
                gender: true,
                address: true,
                city: true,
                country: true,
                profileImage: true,
                isVerified: true,
                isActive: true,
                role: true,
                createdAt: true,
                updatedAt: true
            }
        });
      
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({ user });

    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.put("/change-password", authMiddleware, async (req, res) => {
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
        res.status(500).json({ message: "Internal server error" });
    }
});

app.put("/update-profile", authMiddleware, async (req, res) => {
    const { name, phone, dateOfBirth, gender, address, city, country, profileImage } = req.body;

    try {
        const updatedUser = await prisma.user.update({
            where: {
                id: req.user.userId
            },
            data: {
                name,
                phone,
                dateOfBirth: dateOfBirth
                    ? new Date(dateOfBirth)
                    : dateOfBirth,
                gender,
                address,
                city,
                country,
                profileImage
            }
        });

        return res.status(200).json(
            {
                 user: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    sort_order: updatedUser.sort_order,
                    phone: updatedUser.phone,
                    dateOfBirth: updatedUser.dateOfBirth,
                    gender: updatedUser.gender,
                    address: updatedUser.address,
                    city: updatedUser.city,
                    country: updatedUser.country,
                    profileImage: updatedUser.profileImage,
                    isVerified: updatedUser.isVerified,
                    isActive: updatedUser.isActive,
                    role: updatedUser.role,
                    createdAt: updatedUser.createdAt,
                    updatedAt: updatedUser.updatedAt
                }

             });


    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/forget-password", async (req, res) => {
    const { email } = req.body;
    try {

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
            message: "Password reset link sent to your email",
            resetToken: resetToken
        });
        

    } catch (error) {
        console.error("Error forgetting password:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/reset-password", async (req, res) => {
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
            message: "Password reset successfully"
        });

    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/users/:id", authMiddleware, requireAdmin, async (req, res) => {

    try{
    const userId = Number(req.params.id);

    if (Number.isNaN(userId)) {
        return res.status(400).json({
            message: "Invalid user ID"
        });
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });

    if (!user) {
        return res.status(404).json({
            message: "User not found"
        });
    }

    res.status(200).json(
        { 
            
        user :{
           id: user.id,
           name: user.name,
           email: user.email,
           sort_order: user.sort_order,
            phone: user.phone,
                dateOfBirth: user.dateOfBirth,
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

}catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).json(
        { 
            message: "Internal server error" 

    });
}

});

app.put("/users/:id/update-user", authMiddleware, requireAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const { email, role } = req.body;

        if (Number.isNaN(userId)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }


        if (email && email.trim() !== user.email) {
             const existingUser = await prisma.user.findUnique({
                    where: {
                        email: email.trim()
                    }
        })
          if (existingUser) {
            return res.status(400).json({
                message: "Email is already in use by another user"
            });

        }

        }

        if( role && !["USER", "ADMIN"].includes(role)){
            return res.status(400).json({
                message: "Invalid role. Role must be either 'USER' or 'ADMIN'"
            });
        }
           
        const updateData = {};
         
        if (email) {
            updateData.email = email.trim();
        }

        if (role) {
            updateData.role = role;
        }

        const updatedUser = await prisma.user.update({
            where: {
                id: userId
            },
            data: updateData
        });

        res.status(200).json({
            message: "User updated successfully",

            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                sort_order: updatedUser.sort_order,
                phone: updatedUser.phone,
                dateOfBirth: updatedUser.dateOfBirth,
                gender: updatedUser.gender,
                address: updatedUser.address,
                city: updatedUser.city,
                country: updatedUser.country,
                profileImage: updatedUser.profileImage,
                isVerified: updatedUser.isVerified,
                isActive: updatedUser.isActive,
                role: updatedUser.role,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt
            }
        });

    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }

});

app.put("/users/:id/activate", authMiddleware, requireAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);

        if (Number.isNaN(userId)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const updatedUser = await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                isActive: true
            }
        });

        res.status(200).json({
            message: "User activated successfully",
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                isActive: updatedUser.isActive,
                role: updatedUser.role,
            }
        });

    } catch (error) {
        console.error("Error activating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.put("/users/:id/deactivate", authMiddleware, requireAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);

        if (Number.isNaN(userId)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (!user.isActive){
            return res.status(400).json(
                {
                    message: "User is already deactivated"
                }
               )
        }

        const updatedUser = await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                isActive: false
            }
        });

        res.status(200).json({
            message: "User deactivated successfully",
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                isActive: updatedUser.isActive,
                role: updatedUser.role,
            }
        });

    } catch (error) {
        console.error("Error deactivating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});



