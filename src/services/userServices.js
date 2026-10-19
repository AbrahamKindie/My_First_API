
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
