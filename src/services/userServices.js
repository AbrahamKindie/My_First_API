
import prisma from "../db/prisma.js";

// ==========================================
// FETCH ALL MARKETPLACE USERS
// ==========================================

export const fetchAllUsers = async () => {
    try {
        const where = {
            role: {
                in: ["USER", "SHOP_OWNER"],
            },
        };

        const totalUsers = await prisma.user.count({ where });

        const users = await prisma.user.findMany({
            where,
            orderBy: {
                sort_order: "asc",
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
                updatedAt: true,
            },
        });

        return { users, totalUsers };
    } catch (error) {
        console.error("Error fetching users:", error);
        throw error;
    }
};

// ==========================================
// SAFE USER PROFILE FIELDS
// DYNAMIC ADMIN ROLE AND PERMISSIONS
// ==========================================

const profileSelect = {
    id: true,
    name: true,
    email: true,
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

    adminRoleId: true,

    adminRole: {
        select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            permissions: {
                select: {
                    permission: true,
                },
            },
        },
    },

    // Shop information
    shop: {
        select: {
            id: true,
            name: true,
            description: true,
            shopCategoryId: true,

            shopCategory: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                },
            },

            logo: true,
            coverImage: true,
            address: true,
            city: true,
            region: true,
            phone: true,
            email: true,
            status: true,
            createdAt: true,
            updatedAt: true,
        },
    },

    createdAt: true,
    updatedAt: true,
};

// ==========================================
// ATTACH EFFECTIVE ADMIN PERMISSIONS
// ==========================================

const attachEffectiveAdminPermissions = (user) => {
    if (!user) return user;

    // Super Admin bypasses all Admin permissions.
    if (user.role === "SUPER_ADMIN") {
        return {
            ...user,
            adminRoleId: null,
            adminRole: null,
            adminPermissions: ["*"],
        };
    }

    // Marketplace users do not have Admin permissions.
    if (user.role !== "ADMIN") {
        return {
            ...user,
            adminRoleId: null,
            adminRole: null,
            adminPermissions: [],
        };
    }

    // An Admin without an active assigned role
    // receives no Admin permissions.
    const adminPermissions =
        user.adminRole?.isActive
            ? user.adminRole.permissions
                .map((item) => item.permission)
                .filter(
                    (permission) =>
                        permission !== "MANAGE_ADMIN_PERMISSIONS"
                )
            : [];

    return {
        ...user,
        adminPermissions,
    };
};

// ==========================================
// PROFILE ERROR HELPER
// ==========================================

const createProfileError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// ==========================================
// VALIDATE MARKETPLACE USER TARGET
// ==========================================

const getMarketplaceUser = async (userId) => {
    const id = Number(userId);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw createProfileError("Invalid user ID.", 400);
    }

    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
        },
    });

    if (!user) {
        throw createProfileError("User not found.", 404);
    }

    if (!["USER", "SHOP_OWNER"].includes(user.role)) {
        throw createProfileError(
            "This endpoint only manages marketplace users.",
            403
        );
    }

    return user;
};

// ==========================================
// GET LOGGED-IN USER PROFILE
// ALL AUTHENTICATED ROLES
// ==========================================

export const profile = async (userId) => {
    const id = Number(userId);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw createProfileError("Invalid user ID.", 400);
    }

    const user = await prisma.user.findUnique({
        where: {
            id,
        },
        select: profileSelect,
    });

    if (!user) {
        throw createProfileError("User profile not found.", 404);
    }

    return {
        success: true,
        message: "Profile fetched successfully.",
        user: attachEffectiveAdminPermissions(user),
    };
};

// ==========================================
// UPDATE LOGGED-IN USER PROFILE
//
// USER / SHOP_OWNER:
// Can update name, phone, gender, date of birth,
// address, city, country and profile image.
//
// ADMIN / SUPER_ADMIN:
// Can update name, gender, date of birth,
// address, city, country and profile image.
//
// ADMIN / SUPER_ADMIN CANNOT UPDATE:
// Email or phone.
// ==========================================

export const updateUserProfile = async (userId, role, data) => {
    const allowedRoles = [
        "USER",
        "SHOP_OWNER",
        "ADMIN",
        "SUPER_ADMIN",
    ];

    if (!allowedRoles.includes(role)) {
        throw createProfileError("Invalid user role.", 403);
    }

    const id = Number(userId);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw createProfileError("Invalid user ID.", 400);
    }

    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        throw createProfileError("Invalid profile data.", 400);
    }

    // ==========================================
    // FETCH CURRENT ACCOUNT
    // ==========================================

    const existingUser = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            role: true,
            phone: true,
            isActive: true,
        },
    });

    if (!existingUser) {
        throw createProfileError("User not found.", 404);
    }

    // Always verify the authenticated role against the database.
    if (existingUser.role !== role) {
        throw createProfileError(
            "Your account role has changed. Please log in again.",
            403
        );
    }

    if (!existingUser.isActive) {
        throw createProfileError(
            "Your account is inactive.",
            403
        );
    }

    const isCustomerRole = [
        "USER",
        "SHOP_OWNER",
    ].includes(existingUser.role);

    const isAdminRole = [
        "ADMIN",
        "SUPER_ADMIN",
    ].includes(existingUser.role);

    // ==========================================
    // ALLOWED PROFILE FIELDS
    // ==========================================

    const customerEditableFields = [
        "name",
        "phone",
        "gender",
        "dateOfBirth",
        "address",
        "city",
        "country",
        "profileImage",
    ];

    const adminEditableFields = [
        "name",
        "gender",
        "dateOfBirth",
        "address",
        "city",
        "country",
        "profileImage",
    ];

    const allowedFields = isAdminRole
        ? adminEditableFields
        : customerEditableFields;

    // Reject unsupported or restricted fields.
    const submittedFields = Object.keys(data);

    const invalidFields = submittedFields.filter(
        (field) => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
        if (
            isAdminRole &&
            invalidFields.some((field) =>
                ["email", "phone", "adminRoleId", "permissions"].includes(field)
            )
        ) {
            throw createProfileError(
                "You cannot change your email, phone number, Admin Role, or permissions through My Account.",
                403
            );
        }

        throw createProfileError(
            `You cannot update these profile fields: ${invalidFields.join(", ")}.`,
            403
        );
    }

    const updateData = {};

    // ==========================================
    // COPY ALLOWED FIELDS
    // ==========================================

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updateData[field] = data[field];
        }
    }

    // ==========================================
    // VALIDATE NAME
    // ==========================================

    if (updateData.name !== undefined) {
        if (
            typeof updateData.name !== "string" ||
            updateData.name.trim().length < 2 ||
            updateData.name.trim().length > 100
        ) {
            throw createProfileError(
                "Name must contain between 2 and 100 characters.",
                400
            );
        }

        updateData.name = updateData.name.trim();
    }

    // ==========================================
    // VALIDATE PHONE
    // USER / SHOP_OWNER ONLY
    // ==========================================

    if (
        isCustomerRole &&
        updateData.phone !== undefined
    ) {
        if (
            updateData.phone !== null &&
            typeof updateData.phone !== "string"
        ) {
            throw createProfileError(
                "Invalid phone number.",
                400
            );
        }

        updateData.phone =
            updateData.phone?.trim() || null;

        if (
            updateData.phone &&
            updateData.phone !== existingUser.phone
        ) {
            const phoneExists = await prisma.user.findFirst({
                where: {
                    phone: updateData.phone,
                    NOT: { id },
                },
                select: { id: true },
            });

            if (phoneExists) {
                throw createProfileError(
                    "This phone number is already registered.",
                    409
                );
            }
        }
    }

    // ==========================================
    // VALIDATE GENDER
    // ==========================================

    if (
        updateData.gender !== undefined &&
        updateData.gender !== null &&
        !["MALE", "FEMALE", "OTHER"].includes(updateData.gender)
    ) {
        throw createProfileError(
            "Invalid gender.",
            400
        );
    }

    // ==========================================
    // VALIDATE DATE OF BIRTH
    // ADMIN MUST BE AT LEAST 18
    // ==========================================

    if (updateData.dateOfBirth !== undefined) {
        if (
            updateData.dateOfBirth === null ||
            updateData.dateOfBirth === ""
        ) {
            updateData.dateOfBirth = null;
        } else {
            if (
                typeof updateData.dateOfBirth !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(
                    updateData.dateOfBirth
                )
            ) {
                throw createProfileError(
                    "Date of birth must use YYYY-MM-DD format.",
                    400
                );
            }

            const [year, month, day] =
                updateData.dateOfBirth.split("-").map(Number);

            const dateOfBirth = new Date(
                Date.UTC(year, month - 1, day)
            );

            // Reject invalid calendar dates.
            if (
                dateOfBirth.getUTCFullYear() !== year ||
                dateOfBirth.getUTCMonth() !== month - 1 ||
                dateOfBirth.getUTCDate() !== day
            ) {
                throw createProfileError(
                    "Invalid date of birth.",
                    400
                );
            }

            const today = new Date();

            let age =
                today.getFullYear() - year;

            if (
                today.getMonth() + 1 < month ||
                (
                    today.getMonth() + 1 === month &&
                    today.getDate() < day
                )
            ) {
                age--;
            }

            if (dateOfBirth >= new Date(
                Date.UTC(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                )
            )) {
                throw createProfileError(
                    "Date of birth must be in the past.",
                    400
                );
            }

            if (isAdminRole && age < 18) {
                throw createProfileError(
                    "Admin must be at least 18 years old.",
                    400
                );
            }

            updateData.dateOfBirth = dateOfBirth;
        }
    }

    // ==========================================
    // VALIDATE ADDRESS, CITY AND COUNTRY
    // ==========================================

    const textFields = [
        "address",
        "city",
        "country",
    ];

    for (const field of textFields) {
        if (updateData[field] !== undefined) {
            if (
                updateData[field] !== null &&
                typeof updateData[field] !== "string"
            ) {
                throw createProfileError(
                    `Invalid ${field}.`,
                    400
                );
            }

            updateData[field] =
                updateData[field]?.trim() || null;
        }
    }

    // ==========================================
    // VALIDATE PROFILE IMAGE
    // ==========================================

    if (updateData.profileImage !== undefined) {
        if (
            updateData.profileImage !== null &&
            typeof updateData.profileImage !== "string"
        ) {
            throw createProfileError(
                "Invalid profile image.",
                400
            );
        }

        updateData.profileImage =
            updateData.profileImage?.trim() || null;
    }

    // ==========================================
    // CHECK UPDATE DATA
    // ==========================================

    if (Object.keys(updateData).length === 0) {
        throw createProfileError(
            "At least one profile field must be provided.",
            400
        );
    }

    // ==========================================
    // UPDATE PROFILE
    // ==========================================

    try {
        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            select: profileSelect,
        });

        return {
            success: true,
            message: "Profile updated successfully.",
            user: attachEffectiveAdminPermissions(updatedUser),
        };
    } catch (error) {
        if (error.code === "P2002") {
            throw createProfileError(
                "The supplied information is already in use.",
                409
            );
        }

        throw error;
    }
};


// ==========================================
// GET MARKETPLACE USER BY ID
// ==========================================

export const getOneUser = async (req, res) => {
    try {
        const user = await getMarketplaceUser(req.params.id);

        const userDetails = await prisma.user.findUnique({
            where: { id: user.id },
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
                updatedAt: true,
            },
        });

        return res.status(200).json({
            success: true,
            user: userDetails,
        });
    } catch (error) {
        console.error("Error fetching marketplace user:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error.",
        });
    }
};

// ==========================================
// UPDATE MARKETPLACE USER
// ==========================================

export const userUpdate = async (req, res) => {
    try {
        const user = await getMarketplaceUser(req.params.id);
        const { email } = req.body;

        if (email && email.trim().toLowerCase() !== user.email) {
            const existingUser = await prisma.user.findUnique({
                where: {
                    email: email.trim().toLowerCase(),
                },
                select: { id: true },
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Email is already in use by another user.",
                });
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                ...(email && {
                    email: email.trim().toLowerCase(),
                    isVerified: false,
                }),
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isVerified: true,
                isActive: true,
                updatedAt: true,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Marketplace user updated successfully.",
            user: updatedUser,
        });
    } catch (error) {
        console.error("Error updating marketplace user:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.code === "P2002"
                ? "Email is already in use."
                : error.message || "Internal server error.",
        });
    }
};

// ==========================================
// ACTIVATE MARKETPLACE USER
// ==========================================

export const userActivate = async (req, res) => {
    try {
        const user = await getMarketplaceUser(req.params.id);

        if (user.isActive) {
            return res.status(400).json({
                success: false,
                message: "User is already active.",
            });
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { isActive: true },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
            },
        });

        return res.status(200).json({
            success: true,
            message: "User activated successfully.",
            user: updatedUser,
        });
    } catch (error) {
        console.error("Error activating user:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error.",
        });
    }
};

// ==========================================
// DEACTIVATE MARKETPLACE USER
// ==========================================

export const userDeactivate = async (req, res) => {
    try {
        const user = await getMarketplaceUser(req.params.id);

        if (!user.isActive) {
            return res.status(400).json({
                success: false,
                message: "User is already deactivated.",
            });
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                isActive: false,
                refreshToken: null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
            },
        });

        return res.status(200).json({
            success: true,
            message: "User deactivated successfully.",
            user: updatedUser,
        });
    } catch (error) {
        console.error("Error deactivating user:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error.",
        });
    }
};

// ==========================================
// DELETE MARKETPLACE USER
// ==========================================

export const userDelete = async (req, res) => {
    try {
        const user = await getMarketplaceUser(req.params.id);

        const [
            orderCount,
            reviewCount,
            reportCount,
            ownedShop,
        ] = await Promise.all([
            prisma.order.count({
                where: { userId: user.id },
            }),

            prisma.productReview.count({
                where: { userId: user.id },
            }),

            prisma.productReport.count({
                where: { userId: user.id },
            }),

            prisma.shop.findUnique({
                where: { ownerId: user.id },
                select: { id: true },
            }),
        ]);

        if (
            orderCount > 0 ||
            reviewCount > 0 ||
            reportCount > 0 ||
            ownedShop
        ) {
            return res.status(409).json({
                success: false,
                message: "This account cannot be deleted because it has associated marketplace records.",
                dependencies: {
                    orders: orderCount,
                    reviews: reviewCount,
                    submittedReports: reportCount,
                    ownsShop: Boolean(ownedShop),
                },
            });
        }

        await prisma.user.delete({
            where: { id: user.id },
        });

        return res.status(200).json({
            success: true,
            message: "Marketplace user deleted successfully.",
        });
    } catch (error) {
        console.error("Error deleting marketplace user:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error.",
        });
    }
};
