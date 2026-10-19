
import prisma from "../db/prisma.js";
import { fetchAllUsers, profile } from "../services/userServices.js";

export const getAllUsers = async (req, res) => {
    try{
        const { users, totalUsers } = await fetchAllUsers();

        res.json({ users, totalUsers });

    } catch (error) {
        console.error("Error fetching users:", error);

        res.status(500).json({ message: "Internal server error" });
    }
};
 
export const getProfile = async (req, res) => {
    try{

         const user = await profile(req, res);

        return res.status(200).json({ user });

    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


export const updateProfile = async (req, res) => {
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
};


export const getUserById = async (req, res) => {

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

};

export const updateUser = async (req, res) => {
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

export const activateUser = async (req, res) => {
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

export const deactivateUser = async (req, res) => {
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
};

export const deleteUser = async (req, res) => {
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

        await prisma.user.delete({
            where: {
                id: userId
            }
        });

        res.status(200).json({
            message: "User deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};