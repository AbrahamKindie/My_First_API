import { z } from "zod";

export const registerSchema = z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters long" }),
    phone: z.string().regex( /^(0[79]\d{8}|\+251[79]\d{8}|251[79]\d{8})$/,
        "Invalid phone number"
    ),
    dateOfBirth: z.string().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    profileImage: z.string().optional()
});

export const loginSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(0, { message: "Password is required" })
});

export const updateProfileSchema = z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }).optional(),
    email: z.string().email({ message: "Invalid email address" }).optional(),
    phone: z.string().regex( /^(0[79]\d{8}|\+251[79]\d{8}|251[79]\d{8})$/,
        "Invalid phone number"
    ).optional(),
   dateOfBirth: z.string().optional(),
   address: z.string().optional(),
   city: z.string().optional(),
   country: z.string().optional(),
   profileImage: z.string().optional()

});

export const forgotPasswordSchema = z.object({
    email: z.string().email({ message: "Invalid email address" })
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(6, { message: "Current password must be at least 6 characters long" }),
    newPassword: z.string().min(6, { message: "New password must be at least 6 characters long" })
});

export const updateUserSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }).optional(),
    role: z.enum(["USER", "ADMIN"]).optional()
});