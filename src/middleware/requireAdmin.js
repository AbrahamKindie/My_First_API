import prisma from "../db/prisma.js";
const requireAdmin = async (req, res, next) => {

    try {
          
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.userId,
            },
        });

        if (!user) {
            return res.status(404).json(
                { message: "User not found" }
            
            );
        }

    if (user.role !== "ADMIN") {
    
        return res.status(403).json(
            { 
                message: "Access denied. Admin privileges required." 
            });
    }

     next();

}catch (error) {
        console.error("Error checking admin role:", error);

        res.status(500).json(
            { 
                message: "Internal server error" 
            });
    }

}

export default requireAdmin;
