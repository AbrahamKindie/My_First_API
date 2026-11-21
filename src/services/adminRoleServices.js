
import prisma from "../db/prisma.js";

// ==========================================
// LEGACY PERMISSIONS
// THESE MUST NEVER BE ASSIGNED OR EFFECTIVE
// ==========================================

const legacyPermissions = new Set([
  "MANAGE_ADMIN_PERMISSIONS",
]);

// ==========================================
// REUSABLE ERROR HANDLER
// ==========================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ==========================================
// VALIDATE DATABASE ID
// ==========================================

const validateDatabaseId = (value, label = "ID") => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError(`Invalid ${label}.`, 400);
  }

  return id;
};

// ==========================================
// ASSIGNED ADMIN PROFILE FIELDS
// ==========================================

const assignedAdminSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  profileImage: true,
  gender: true,
  dateOfBirth: true,
  address: true,
  city: true,
  country: true,
  role: true,
  isActive: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
};

// ==========================================
// ADMIN ROLE RESPONSE RELATIONS
// DATABASE-DRIVEN PERMISSIONS
// ==========================================

const adminRoleResponseInclude = {
  permissions: {
    where: {
      permission: {
        isActive: true,
      },
    },
    select: {
      permission: {
        select: {
          id: true,
          key: true,
          group: true,
          label: true,
          description: true,
          isActive: true,
        },
      },
    },
    orderBy: {
      permission: {
        key: "asc",
      },
    },
  },

  admins: {
    where: {
      role: "ADMIN",
    },
    select: assignedAdminSelect,
    orderBy: {
      createdAt: "desc",
    },
  },

  _count: {
    select: {
      admins: true,
    },
  },
};

// ==========================================
// ADMIN ROLE DETAIL RESPONSE RELATIONS
// ==========================================

const adminRoleDetailResponseInclude = {
  ...adminRoleResponseInclude,
};

// ==========================================
// VALIDATE PERMISSION ARRAY
// CHECKS STRUCTURE AND LEGACY PERMISSIONS
// DATABASE VALIDATION HAPPENS SEPARATELY
// ==========================================

const validatePermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    throw createError(
      "Permissions must be provided as an array.",
      400
    );
  }

  const invalidPermissions = permissions.filter(
    (permission) =>
      typeof permission !== "string" ||
      !/^[A-Z][A-Z0-9_]*$/.test(permission)
  );

  if (invalidPermissions.length > 0) {
    throw createError(
      "Every permission must be a valid permission key.",
      400
    );
  }

  if (
    permissions.some((permission) =>
      legacyPermissions.has(permission)
    )
  ) {
    throw createError(
      "MANAGE_ADMIN_PERMISSIONS is a legacy permission and cannot be assigned to Admin roles.",
      400
    );
  }

  return [...new Set(permissions)];
};

// ==========================================
// RESOLVE PERMISSIONS FROM DATABASE
//
// IMPORTANT:
// AdminRolePermission USES permissionId,
// NOT A PERMISSION STRING.
// ==========================================

const resolvePermissionRecords = async (tx, permissionKeys) => {
  if (!permissionKeys.length) {
    return [];
  }

  const permissions = await tx.adminPermission.findMany({
    where: {
      key: {
        in: permissionKeys,
      },
      isActive: true,
    },
    select: {
      id: true,
      key: true,
      group: true,
      label: true,
      description: true,
      isActive: true,
    },
  });

  const foundKeys = new Set(
    permissions.map((permission) => permission.key)
  );

  const invalidPermissions = permissionKeys.filter(
    (key) => !foundKeys.has(key)
  );

  if (invalidPermissions.length > 0) {
    throw createError(
      `Unknown or inactive permissions: ${invalidPermissions.join(", ")}`,
      400
    );
  }

  return permissions;
};

// ==========================================
// GET ACTIVE PERMISSION KEYS
// ==========================================

const getActivePermissionKeys = async (tx) => {
  const permissions = await tx.adminPermission.findMany({
    where: {
      isActive: true,
    },
    select: {
      key: true,
    },
    orderBy: {
      key: "asc",
    },
  });

  return permissions
    .map((permission) => permission.key)
    .filter((key) => !legacyPermissions.has(key));
};

// ==========================================
// GET ROLE PERMISSIONS
//
// DATABASE RELATION:
// item.permission.key
// ==========================================

const getRolePermissions = (role) => {
  return [
    ...new Set(
      (role?.permissions || [])
        .map((item) => item.permission?.key)
        .filter(
          (key) =>
            typeof key === "string" &&
            !legacyPermissions.has(key)
        )
    ),
  ].sort();
};

// ==========================================
// VALIDATE ADMIN ACTOR
//
// SUPER ADMIN HAS UNRESTRICTED ACCESS.
// REGULAR ADMIN PERMISSIONS ARE LOADED
// DIRECTLY FROM THE DATABASE.
// ==========================================

const validateAdminActor = async (
  tx,
  actorId,
  requiredPermission
) => {
  const id = validateDatabaseId(
    actorId,
    "Admin authentication"
  );

  const actor = await tx.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      adminRoleId: true,

      adminRole: {
        select: {
          id: true,
          name: true,
          isActive: true,

          permissions: {
            where: {
              permission: {
                isActive: true,
              },
            },
            select: {
              permission: {
                select: {
                  id: true,
                  key: true,
                  isActive: true,
                },
              },
            },
            orderBy: {
              permission: {
                key: "asc",
              },
            },
          },
        },
      },
    },
  });

  if (
    !actor ||
    !actor.isActive ||
    !["ADMIN", "SUPER_ADMIN"].includes(actor.role)
  ) {
    throw createError(
      "Active Admin authorization required.",
      403
    );
  }

  // SUPER ADMIN BYPASS

  if (actor.role === "SUPER_ADMIN") {
    const activePermissions =
      await getActivePermissionKeys(tx);

    return {
      ...actor,
      adminPermissions: activePermissions,
      isSuperAdmin: true,
    };
  }

  // REGULAR ADMIN ROLE VALIDATION

  if (
    !actor.adminRoleId ||
    !actor.adminRole ||
    !actor.adminRole.isActive ||
    actor.adminRole.id !== actor.adminRoleId
  ) {
    throw createError(
      "Your account does not have an active Admin role.",
      403
    );
  }

  const adminPermissions = getRolePermissions(
    actor.adminRole
  );

  if (!adminPermissions.includes(requiredPermission)) {
    throw createError(
      "You do not have permission to perform this action.",
      403
    );
  }

  return {
    ...actor,
    adminPermissions,
    isSuperAdmin: false,
  };
};

// ==========================================
// PREVENT PERMISSION ESCALATION
// ==========================================

const validatePermissionAssignment = (
  actor,
  requestedPermissions,
  existingPermissions = []
) => {
  if (actor.role === "SUPER_ADMIN") {
    return;
  }

  const actorPermissions = actor.adminPermissions || [];

  const existing = Array.isArray(existingPermissions)
    ? existingPermissions
    : [];

  const newPermissions = requestedPermissions.filter(
    (permission) => !existing.includes(permission)
  );

  const unauthorizedPermissions = newPermissions.filter(
    (permission) => !actorPermissions.includes(permission)
  );

  if (unauthorizedPermissions.length > 0) {
    throw createError(
      `You cannot grant permissions you do not possess: ${unauthorizedPermissions.join(", ")}`,
      403
    );
  }
};

// ==========================================
// CHECK WHETHER ACTOR CAN USE A ROLE
// ==========================================

const validateRoleAssignmentAuthority = (
  actor,
  rolePermissions
) => {
  if (actor.role === "SUPER_ADMIN") {
    return;
  }

  const actorPermissions = actor.adminPermissions || [];

  const unauthorizedPermissions = rolePermissions.filter(
    (permission) => !actorPermissions.includes(permission)
  );

  if (unauthorizedPermissions.length > 0) {
    throw createError(
      `You cannot assign a role containing permissions you do not possess: ${unauthorizedPermissions.join(", ")}`,
      403
    );
  }
};

// ==========================================
// FORMAT ASSIGNED ADMIN PROFILE
// ==========================================

const formatAssignedAdmin = (admin) => ({
  id: admin.id,
  name: admin.name,
  email: admin.email,
  phone: admin.phone,
  profileImage: admin.profileImage,
  gender: admin.gender,
  dateOfBirth: admin.dateOfBirth,
  address: admin.address,
  city: admin.city,
  country: admin.country,
  role: admin.role,
  isActive: admin.isActive,
  isVerified: admin.isVerified,
  createdAt: admin.createdAt,
  updatedAt: admin.updatedAt,
});

// ==========================================
// FORMAT ADMIN ROLE RESPONSE
// ==========================================

const formatAdminRole = (role) => {
  const assignedAdmins = (role.admins || []).map(
    formatAssignedAdmin
  );

  const assignedAdminCount = assignedAdmins.length;

  const activeAdminCount = assignedAdmins.filter(
    (admin) => admin.isActive
  ).length;

  const inactiveAdminCount =
    assignedAdminCount - activeAdminCount;

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isActive: role.isActive,

    permissions: getRolePermissions(role),

    admins: assignedAdminCount,
    activeAdmins: activeAdminCount,

    assignedAdminCount,
    activeAdminCount,
    inactiveAdminCount,

    assignedAdmins,

    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
};

// ==========================================
// ACTIVITY LOG HELPER
// ==========================================

const createRoleActivityLog = async (
  tx,
  actorId,
  action,
  roleId,
  details
) => {
  await tx.adminActivityLog.create({
    data: {
      actorId,
      action,
      targetType: "ADMIN_ROLE",
      targetId: roleId,
      details,
    },
  });
};

// ==========================================
// GET AVAILABLE ADMIN PERMISSIONS
// VIEW_ADMIN_ROLES REQUIRED
//
// RETURNS ACTIVE DATABASE PERMISSION KEYS.
// ==========================================

export const getAvailableAdminPermissions = async (
  actorId
) => {
  return prisma.$transaction(async (tx) => {
    await validateAdminActor(
      tx,
      actorId,
      "VIEW_ADMIN_ROLES"
    );

    const permissions = await tx.adminPermission.findMany({
      where: {
        isActive: true,
        key: {
          notIn: [...legacyPermissions],
        },
      },
      select: {
        id: true,
        key: true,
        group: true,
        label: true,
        description: true,
        isActive: true,
      },
      orderBy: [
        {
          group: "asc",
        },
        {
          key: "asc",
        },
      ],
    });

    return permissions;
  });
};

// ==========================================
// GET ALL ADMIN ROLES
// VIEW_ADMIN_ROLES REQUIRED
// ==========================================

export const getAdminRoles = async (actorId) => {
  return prisma.$transaction(async (tx) => {
    await validateAdminActor(
      tx,
      actorId,
      "VIEW_ADMIN_ROLES"
    );

    const roles = await tx.adminRole.findMany({
      include: adminRoleResponseInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    return roles.map(formatAdminRole);
  });
};

// ==========================================
// GET ADMIN ROLE BY ID
// VIEW_ADMIN_ROLES REQUIRED
// ==========================================

export const getAdminRoleById = async (
  roleId,
  actorId
) => {
  const id = validateDatabaseId(
    roleId,
    "Admin role ID"
  );

  return prisma.$transaction(async (tx) => {
    await validateAdminActor(
      tx,
      actorId,
      "VIEW_ADMIN_ROLES"
    );

    const role = await tx.adminRole.findUnique({
      where: {
        id,
      },
      include: adminRoleDetailResponseInclude,
    });

    if (!role) {
      throw createError(
        "Admin role not found.",
        404
      );
    }

    return formatAdminRole(role);
  });
};

// ==========================================
// CREATE ADMIN ROLE
// ==========================================

export const createAdminRole = async (
  data,
  actorId
) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Invalid Admin role data.",
      400
    );
  }

  if (typeof data.name !== "string") {
    throw createError(
      "Role name is required.",
      400
    );
  }

  const name = data.name.trim();

  const description =
    typeof data.description === "string"
      ? data.description.trim() || null
      : data.description == null
        ? null
        : undefined;

  if (description === undefined) {
    throw createError(
      "Role description must be a string.",
      400
    );
  }

  if (
    !name ||
    name.length < 2 ||
    name.length > 100
  ) {
    throw createError(
      "Role name must contain between 2 and 100 characters.",
      400
    );
  }

  if (description && description.length > 255) {
    throw createError(
      "Role description cannot exceed 255 characters.",
      400
    );
  }

  const permissions = validatePermissions(
    data.permissions ?? []
  );

  return prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      "CREATE_ADMIN_ROLES"
    );

    let permissionRecords = [];

    if (permissions.length > 0) {
      if (
        actor.role !== "SUPER_ADMIN" &&
        !actor.adminPermissions.includes(
          "MANAGE_ADMIN_ROLE_PERMISSIONS"
        )
      ) {
        throw createError(
          "You need MANAGE_ADMIN_ROLE_PERMISSIONS to assign role permissions.",
          403
        );
      }

      validatePermissionAssignment(
        actor,
        permissions
      );

      permissionRecords = await resolvePermissionRecords(
        tx,
        permissions
      );
    }

    const existingRole = await tx.adminRole.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

    if (existingRole) {
      throw createError(
        "An Admin role with this name already exists.",
        409
      );
    }

    const role = await tx.adminRole.create({
      data: {
        name,
        description,
        isActive: true,
      },
    });

    if (permissionRecords.length > 0) {
      await tx.adminRolePermission.createMany({
        data: permissionRecords.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }

    const createdRole = await tx.adminRole.findUnique({
      where: {
        id: role.id,
      },
      include: adminRoleResponseInclude,
    });

    await createRoleActivityLog(
      tx,
      actor.id,
      "CREATE_ADMIN_ROLE",
      role.id,
      {
        name: role.name,
        description: role.description,
        permissions: getRolePermissions(createdRole),
      }
    );

    return formatAdminRole(createdRole);
  });
};

// ==========================================
// UPDATE ADMIN ROLE
// ==========================================

export const updateAdminRole = async (
  roleId,
  data,
  actorId
) => {
  const id = validateDatabaseId(
    roleId,
    "Admin role ID"
  );

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Invalid Admin role update data.",
      400
    );
  }

  const updateData = {};

  if (data.name !== undefined) {
    if (typeof data.name !== "string") {
      throw createError(
        "Role name must be a string.",
        400
      );
    }

    const name = data.name.trim();

    if (
      !name ||
      name.length < 2 ||
      name.length > 100
    ) {
      throw createError(
        "Role name must contain between 2 and 100 characters.",
        400
      );
    }

    updateData.name = name;
  }

  if (data.description !== undefined) {
    if (
      data.description !== null &&
      typeof data.description !== "string"
    ) {
      throw createError(
        "Role description must be a string or null.",
        400
      );
    }

    const description =
      data.description?.trim() || null;

    if (
      description &&
      description.length > 255
    ) {
      throw createError(
        "Role description cannot exceed 255 characters.",
        400
      );
    }

    updateData.description = description;
  }

  const permissionsProvided =
    data.permissions !== undefined;

  const permissions = permissionsProvided
    ? validatePermissions(data.permissions)
    : null;

  if (
    Object.keys(updateData).length === 0 &&
    !permissionsProvided
  ) {
    throw createError(
      "At least one role field must be provided.",
      400
    );
  }

  return prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      "UPDATE_ADMIN_ROLES"
    );

    const existingRole = await tx.adminRole.findUnique({
      where: {
        id,
      },
      include: {
        permissions: {
          where: {
            permission: {
              isActive: true,
            },
          },
          select: {
            permission: {
              select: {
                id: true,
                key: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!existingRole) {
      throw createError(
        "Admin role not found.",
        404
      );
    }

    const previousPermissions =
      getRolePermissions(existingRole);

    let permissionRecords = [];

    if (permissionsProvided) {
      if (
        actor.role !== "SUPER_ADMIN" &&
        !actor.adminPermissions.includes(
          "MANAGE_ADMIN_ROLE_PERMISSIONS"
        )
      ) {
        throw createError(
          "You need MANAGE_ADMIN_ROLE_PERMISSIONS to change role permissions.",
          403
        );
      }

      validatePermissionAssignment(
        actor,
        permissions,
        previousPermissions
      );

      permissionRecords = await resolvePermissionRecords(
        tx,
        permissions
      );
    }

    if (updateData.name !== undefined) {
      const duplicateRole = await tx.adminRole.findFirst({
        where: {
          id: {
            not: id,
          },
          name: {
            equals: updateData.name,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicateRole) {
        throw createError(
          "Another Admin role with this name already exists.",
          409
        );
      }
    }

    if (permissionsProvided) {
      await tx.adminRolePermission.deleteMany({
        where: {
          roleId: id,
        },
      });

      if (permissionRecords.length > 0) {
        await tx.adminRolePermission.createMany({
          data: permissionRecords.map((permission) => ({
            roleId: id,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    await tx.adminRole.update({
      where: {
        id,
      },
      data: updateData,
    });

    const updatedRole = await tx.adminRole.findUnique({
      where: {
        id,
      },
      include: adminRoleResponseInclude,
    });

    await createRoleActivityLog(
      tx,
      actor.id,
      "UPDATE_ADMIN_ROLE",
      id,
      {
        previousData: {
          name: existingRole.name,
          description: existingRole.description,
          permissions: previousPermissions,
        },
        updatedData: {
          name: updatedRole.name,
          description: updatedRole.description,
          permissions: getRolePermissions(updatedRole),
        },
      }
    );

    return formatAdminRole(updatedRole);
  });
};

// ==========================================
// ACTIVATE / DEACTIVATE ADMIN ROLE
//
// A ROLE CANNOT BE DEACTIVATED WHILE IT IS
// ASSIGNED TO ANY ACTIVE ADMIN ACCOUNT.
// ==========================================

export const updateAdminRoleStatus = async (
  roleId,
  isActive,
  actorId
) => {
  const id = validateDatabaseId(
    roleId,
    "Admin role ID"
  );

  if (typeof isActive !== "boolean") {
    throw createError(
      "isActive must be true or false.",
      400
    );
  }

  return prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      "UPDATE_ADMIN_ROLES"
    );

    const role = await tx.adminRole.findUnique({
      where: {
        id,
      },
      include: adminRoleResponseInclude,
    });

    if (!role) {
      throw createError(
        "Admin role not found.",
        404
      );
    }

    if (role.isActive === isActive) {
      throw createError(
        `This role is already ${isActive ? "active" : "inactive"}.`,
        400
      );
    }

    if (!isActive) {
      const activeAdminCount = await tx.user.count({
        where: {
          adminRoleId: id,
          role: "ADMIN",
          isActive: true,
        },
      });

      if (activeAdminCount > 0) {
        throw createError(
          `Cannot deactivate this role because ${activeAdminCount} active Admin account(s) are assigned to it. Reassign or deactivate those Admin accounts first.`,
          400
        );
      }
    }

    if (isActive) {
      validateRoleAssignmentAuthority(
        actor,
        getRolePermissions(role)
      );
    }

    const updatedRoleRecord = await tx.adminRole.update({
      where: {
        id,
      },
      data: {
        isActive,
      },
    });

    const updatedRole = await tx.adminRole.findUnique({
      where: {
        id,
      },
      include: adminRoleResponseInclude,
    });

    await createRoleActivityLog(
      tx,
      actor.id,
      isActive
        ? "ACTIVATE_ADMIN_ROLE"
        : "DEACTIVATE_ADMIN_ROLE",
      id,
      {
        name: updatedRoleRecord.name,
        previousStatus: role.isActive,
        newStatus: isActive,
        assignedAdminCount: role.admins.length,
        activeAdminCount: role.admins.filter(
          (admin) => admin.isActive
        ).length,
      }
    );

    return formatAdminRole(updatedRole);
  });
};

// ==========================================
// DELETE ADMIN ROLE
//
// BLOCK DELETION WHEN ADMINS ARE ASSIGNED,
// INCLUDING INACTIVE ADMINS.
// ==========================================

export const deleteAdminRole = async (
  roleId,
  actorId
) => {
  const id = validateDatabaseId(
    roleId,
    "Admin role ID"
  );

  return prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      "DELETE_ADMIN_ROLES"
    );

    const role = await tx.adminRole.findUnique({
      where: {
        id,
      },
      include: {
        permissions: {
          where: {
            permission: {
              isActive: true,
            },
          },
          select: {
            permission: {
              select: {
                id: true,
                key: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            admins: true,
          },
        },
      },
    });

    if (!role) {
      throw createError(
        "Admin role not found.",
        404
      );
    }

    if (role._count.admins > 0) {
      throw createError(
        `Cannot delete this role because ${role._count.admins} Admin account(s) are still assigned to it. Reassign those Admins first.`,
        400
      );
    }

    await createRoleActivityLog(
      tx,
      actor.id,
      "DELETE_ADMIN_ROLE",
      id,
      {
        name: role.name,
        description: role.description,
        permissions: getRolePermissions(role),
        assignedAdminCount: role._count.admins,
      }
    );

    await tx.adminRole.delete({
      where: {
        id,
      },
    });

    return {
      id: role.id,
      name: role.name,
      message: "Admin role deleted successfully.",
    };
  });
};

// ==========================================
// ASSIGN ADMIN ROLE
//
// ONLY ACTIVE ROLES CAN BE ASSIGNED.
// ADMINS CANNOT CHANGE THEIR OWN ROLE.
// ==========================================

export const assignAdminRole = async (
  adminId,
  roleId,
  actorId
) => {
  const adminUserId = validateDatabaseId(
    adminId,
    "Admin ID"
  );

  const adminRoleId = validateDatabaseId(
    roleId,
    "Admin role ID"
  );

  return prisma.$transaction(async (tx) => {
    const actor = await validateAdminActor(
      tx,
      actorId,
      "ASSIGN_ADMIN_ROLES"
    );

    if (
      actor.role !== "SUPER_ADMIN" &&
      actor.id === adminUserId
    ) {
      throw createError(
        "You cannot change your own Admin role.",
        403
      );
    }

    const admin = await tx.user.findUnique({
      where: {
        id: adminUserId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        adminRoleId: true,

        adminRole: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!admin || admin.role !== "ADMIN") {
      throw createError(
        "Admin account not found.",
        404
      );
    }

    const role = await tx.adminRole.findUnique({
      where: {
        id: adminRoleId,
      },
      include: {
        permissions: {
          where: {
            permission: {
              isActive: true,
            },
          },
          select: {
            permission: {
              select: {
                id: true,
                key: true,
                isActive: true,
              },
            },
          },
          orderBy: {
            permission: {
              key: "asc",
            },
          },
        },
      },
    });

    if (!role) {
      throw createError(
        "Admin role not found.",
        404
      );
    }

    if (!role.isActive) {
      throw createError(
        "You can only assign an active Admin role.",
        400
      );
    }

    if (admin.adminRoleId === role.id) {
      throw createError(
        "This Admin is already assigned to this role.",
        400
      );
    }

    validateRoleAssignmentAuthority(
      actor,
      getRolePermissions(role)
    );

    const previousRole = admin.adminRole;

    const updatedAdmin = await tx.user.update({
      where: {
        id: admin.id,
      },
      data: {
        adminRoleId: role.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        adminRoleId: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,

        adminRole: {
          select: {
            id: true,
            name: true,
            isActive: true,

            permissions: {
              where: {
                permission: {
                  isActive: true,
                },
              },
              select: {
                permission: {
                  select: {
                    id: true,
                    key: true,
                    isActive: true,
                  },
                },
              },
              orderBy: {
                permission: {
                  key: "asc",
                },
              },
            },
          },
        },
      },
    });

    await tx.adminActivityLog.create({
      data: {
        actorId: actor.id,
        action: "ASSIGN_ADMIN_ROLE",
        targetType: "USER",
        targetId: admin.id,
        details: {
          adminName: admin.name,
          adminEmail: admin.email,

          previousRole: previousRole
            ? {
                id: previousRole.id,
                name: previousRole.name,
              }
            : null,

          newRole: {
            id: role.id,
            name: role.name,
          },

          permissions: getRolePermissions(role),
        },
      },
    });

    return {
      ...updatedAdmin,

      adminPermissions: getRolePermissions(
        updatedAdmin.adminRole || {
          permissions: [],
        }
      ),
    };
  });
};
