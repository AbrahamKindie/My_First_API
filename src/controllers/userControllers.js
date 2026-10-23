
import prisma from "../db/prisma.js";
import { fetchAllUsers, profile, updateUserProfile, getOneUser, userUpdate, userActivate, userDeactivate, userDelete } from "../services/userServices.js";

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
    try{

        return userDeactivate(req, res);

    } catch (error) {
        console.error("Error deactivating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteUser = async (req, res) => {
    
    try{

        return userDelete(req, res);

    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};