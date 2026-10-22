
import prisma from "../db/prisma.js";
import { fetchAllUsers, profile, updateUserProfile, getOneUser, userUpdate, userActivate } from "../services/userServices.js";

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
}

export const updateProfile = async (req, res) => {
    try {

        return updateUserProfile(req, res);
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


export const getUserById = async (req, res) => {
    try {

        return getOneUser(req, res);

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

     return userUpdate(req, res);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const activateUser = async (req, res) => {
    try {

        return userActivate(req, res);

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