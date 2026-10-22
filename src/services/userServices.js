
import prisma from "../db/prisma.js";

export const fetchAllUsers = async (req, res) => {
    
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

        return { users, totalUsers };

    }catch (error) {
        console.error("Error fetching users:", error);
        throw new Error("Internal server error");
    }

}


export const profile = async (req, res) => {
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

        return {
            success: true,
            message: "User profile fetched successfully",
            user
        };
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}


export const updateUserProfile = async (req, res) => {
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
                 success: true,
                 message: "User profile updated successfully",
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
        console.error("Error updating user profile:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

export const getOneUser = async (req, res) => {

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
        res.status(500).json({ message: "Internal server error" });
    }
}


export const userUpdate = async (req, res) => {
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

};

export const userActivate = async (req, res) => {
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
};

