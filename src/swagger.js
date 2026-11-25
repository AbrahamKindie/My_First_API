
import "dotenv/config";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;

const productionUrl = process.env.PRODUCTION_API_URL
  ? process.env.PRODUCTION_API_URL.replace(/\/+$/, "")
  : null;

// =====================================================
// OPENAPI HELPERS
// =====================================================

const ref = (name) => ({
  $ref: `#/components/schemas/${name}`,
});

const jsonBody = (schema, required = true) => ({
  required,
  content: {
    "application/json": {
      schema: ref(schema),
    },
  },
});

const multipartBody = (schema) => ({
  required: true,
  content: {
    "multipart/form-data": {
      schema: ref(schema),
    },
  },
});

const queryParameter = (name, description, schema = {
  type: "string",
}) => ({
  name,
  in: "query",
  required: false,
  description,
  schema,
});

const successResponse = {
  description: "Request completed successfully.",
  content: {
    "application/json": {
      schema: ref("SuccessResponse"),
    },
  },
};

const errorResponses = {
  "400": {
    description: "Invalid request data.",
    content: {
      "application/json": {
        schema: ref("ErrorResponse"),
      },
    },
  },
  "401": {
    description: "Authentication required or invalid access token.",
    content: {
      "application/json": {
        schema: ref("ErrorResponse"),
      },
    },
  },
  "403": {
    description: "Access denied or need permissions.",
    content: {
      "application/json": {
        schema: ref("ErrorResponse"),
      },
    },
  },
  "404": {
    description: "Requested resource not found.",
    content: {
      "application/json": {
        schema: ref("ErrorResponse"),
      },
    },
  },
  "409": {
    description: "Request conflicts with existing data or business rules.",
    content: {
      "application/json": {
        schema: ref("ErrorResponse"),
      },
    },
  },
  "500": {
    description: "Internal server error.",
    content: {
      "application/json": {
        schema: ref("ErrorResponse"),
      },
    },
  },
};

const paths = {};

let operationCounter = 0;

function add(
  route,
  method,
  summary,
  tag,
  options = {},
) {
  const {
    description = "",
    body,
    multipart,
    query = [],
    security = true,
    permission,
    responses = {},
    parameters = [],
    deprecated = false,
  } = options;

  const pathParameters = [
    ...route.matchAll(/\{([^}]+)\}/g),
  ].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: {
      type: "string",
    },
    description: `${match[1]} identifier.`,
  }));

  const operation = {
    operationId: `operation${++operationCounter}`,
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    ...(deprecated ? { deprecated: true } : {}),
    parameters: [
      ...pathParameters,
      ...query,
      ...parameters,
    ],
    responses: {
      "200": successResponse,
      "201": successResponse,
      ...errorResponses,
      ...responses,
    },
  };

  if (security === true) {
    operation.security = [{ bearerAuth: [] }];
  } else if (security === "optional") {
    operation.description = [
      operation.description,
      "Authentication is optional for this endpoint.",
    ].filter(Boolean).join("\n\n");
  }

  if (permission) {
    operation.description = [
      operation.description,
      `**Required Admin permission:** \`${permission}\`.`,
    ].filter(Boolean).join("\n\n");
  }

  if (body) {
    operation.requestBody = jsonBody(body);
  }

  if (multipart) {
    operation.requestBody = multipartBody(multipart);
  }

  paths[route] ??= {};
  paths[route][method.toLowerCase()] = operation;
}

// =====================================================
// AUTHENTICATION
// Public endpoints do not show a lock.
// Change password requires authentication.
// =====================================================

add("/auth/register", "post", "Register a new account", "Authentication", {
  body: "RegisterRequest",
  security: false,
  responses: {
    "201": {
      description: "Account registered successfully.",
    },
  },
});

add("/auth/login", "post", "Log in to an account", "Authentication", {
  body: "LoginRequest",
  security: false,
});

add("/auth/forgot-password", "post", "Request a password reset", "Authentication", {
  body: "ForgotPasswordRequest",
  security: false,
});

add("/auth/reset-password", "post", "Reset account password", "Authentication", {
  body: "ResetPasswordRequest",
  security: false,
});

add("/auth/refresh-token", "post", "Refresh access and refresh tokens", "Authentication", {
  body: "RefreshTokenRequest",
  security: false,
});

add("/auth/logout", "post", "Log out and invalidate refresh token", "Authentication", {
  body: "RefreshTokenRequest",
  security: false,
});

add("/auth/admin-password/verify", "post", "Verify an Admin password setup token", "Authentication", {
  body: "VerifyAdminPasswordSetupRequest",
  security: false,
});

add("/auth/admin-password/setup", "post", "Set the initial Admin password", "Authentication", {
  body: "AdminPasswordSetupRequest",
  security: false,
});

add("/auth/change-password", "post", "Change the authenticated user's password", "Authentication", {
  body: "ChangePasswordRequest",
});

// =====================================================
// PUBLIC PRODUCTS
// =====================================================

add("/products", "get", "Get marketplace products", "Public Products", {
  security: false,
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Number of products per page.", { type: "integer", minimum: 1 }),
    queryParameter("search", "Search products by keyword."),
    queryParameter("categoryId", "Product category ID.", { type: "integer" }),
    queryParameter("shopId", "Shop ID.", { type: "integer" }),
    queryParameter("sortBy", "Product sorting option."),
  ],
});

add("/products/shop-category/{categoryId}", "get", "Get products by shop category", "Public Products", {
  security: false,
});

add("/products/featured", "get", "Get featured products", "Public Products", {
  security: false,
});

add("/products/best-selling", "get", "Get best-selling products", "Public Products", {
  security: false,
});

add("/products/new-arrivals", "get", "Get newly added products", "Public Products", {
  security: false,
});

add("/products/{id}", "get", "Get product details", "Public Products", {
  security: false,
});

// =====================================================
// CUSTOMER PRODUCT INTERACTIONS
// =====================================================

add("/products/my-likes", "get", "Get products liked by the current user", "Customer Products");

add("/products/{id}/like", "post", "Like a product", "Customer Products");

add("/products/{id}/like", "delete", "Remove a product like", "Customer Products");

add("/products/{id}/likes", "get", "Get product like information", "Public Products", {
  security: "optional",
});

add("/products/{id}/reports", "post", "Report a product", "Customer Products", {
  body: "CreateProductReportRequest",
  responses: {
    "201": {
      description: "Product report submitted successfully.",
    },
  },
});

add("/products/my-reports", "get", "Get product reports submitted by the current user", "Customer Products");

// =====================================================
// SHOP OWNER PRODUCTS
// =====================================================

add("/products/my-shop", "get", "Get products belonging to my shop", "Shop Owner Products", {
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Number of products per page.", { type: "integer", minimum: 1 }),
    queryParameter("search", "Search products."),
    queryParameter("categoryId", "Product category ID.", { type: "integer" }),
    queryParameter("sortBy", "Product sorting option."),
  ],
});

add("/products/my-shop/{id}", "get", "Get one of my shop's products", "Shop Owner Products");

add("/products/my-shop", "post", "Create a shop product", "Shop Owner Products", {
  multipart: "CreateShopProductMultipart",
  responses: {
    "201": {
      description: "Product created successfully.",
    },
  },
});

add("/products/my-shop/{id}", "patch", "Update a shop product", "Shop Owner Products", {
  multipart: "UpdateShopProductMultipart",
});

add("/products/my-shop/{id}", "delete", "Delete a shop product", "Shop Owner Products");

add("/products/my-shop/{id}/featured", "patch", "Set product featured status", "Shop Owner Products", {
  body: "SetProductFeaturedRequest",
});

add("/products/my-shop/{id}/discount", "put", "Create or update a product discount", "Shop Owner Products", {
  body: "SetProductDiscountRequest",
});

add("/products/my-shop/{id}/discount", "delete", "Remove a product discount", "Shop Owner Products");

// =====================================================
// ADMIN PRODUCT MANAGEMENT
// =====================================================

add("/products/admin", "get", "Get products for Admin management", "Admin Products", {
  permission: "VIEW_PRODUCTS",
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Page size.", { type: "integer", minimum: 1, maximum: 100 }),
    queryParameter("search", "Search products."),
    queryParameter("productCategoryId", "Product category ID.", { type: "integer" }),
    queryParameter("shopId", "Shop ID.", { type: "integer" }),
    queryParameter("source", "Product source.", { type: "string", enum: ["ALL", "SHOP"] }),
    queryParameter("isFeatured", "Featured filter.", { type: "boolean" }),
    queryParameter("sortBy", "Sort order."),
  ],
});

add("/products/admin/{id}", "get", "Get product details for Admin management", "Admin Products", {
  permission: "VIEW_PRODUCTS",
});

add("/products/{id}/status", "patch", "Activate or deactivate a product", "Admin Products", {
  body: "SetProductStatusRequest",
  description: "Requires ACTIVATE_PRODUCTS when setting status to ACTIVE, or DEACTIVATE_PRODUCTS when setting status to ADMIN_DEACTIVATED.",
});

// =====================================================
// ADMIN PRODUCT REPORTS
// =====================================================

add("/products/reports", "get", "Get submitted product reports", "Admin Product Reports", {
  permission: "VIEW_PRODUCT_REPORTS",
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Page size.", { type: "integer", minimum: 1 }),
    queryParameter("status", "Report status."),
    queryParameter("reason", "Report reason."),
    queryParameter("productId", "Product ID.", { type: "integer" }),
    queryParameter("search", "Search reports."),
  ],
});

add("/products/reports/{reportId}", "patch", "Review a product report", "Admin Product Reports", {
  body: "ReviewProductReportRequest",
  permission: "REVIEW_PRODUCT_REPORTS",
});

// =====================================================
// PUBLIC SHOP CATEGORIES
// =====================================================

add("/categories", "get", "Get all public shop categories", "Public Categories", {
  security: false,
});

add("/categories/{id}", "get", "Get public shop category details", "Public Categories", {
  security: false,
});

// =====================================================
// SHOP OWNER PRODUCT CATEGORIES
// =====================================================

add("/categories/my-shop", "get", "Get my shop's product categories", "Shop Owner Categories");

add("/categories/my-shop/{id}", "get", "Get one of my shop's product categories", "Shop Owner Categories");

add("/categories/my-shop", "post", "Create a product category", "Shop Owner Categories", {
  body: "CreateProductCategoryRequest",
  responses: {
    "201": {
      description: "Product category created successfully.",
    },
  },
});

add("/categories/my-shop/{id}", "patch", "Update a product category", "Shop Owner Categories", {
  body: "UpdateProductCategoryRequest",
});

add("/categories/my-shop/{id}", "delete", "Delete a product category", "Shop Owner Categories");

// =====================================================
// CART
// =====================================================

add("/carts", "get", "Get the authenticated user's cart", "Customer Cart");

add("/carts/items", "post", "Add a product to the cart", "Customer Cart", {
  body: "AddToCartRequest",
});

add("/carts/items/{id}", "patch", "Update cart item quantity", "Customer Cart", {
  body: "UpdateCartItemRequest",
});

add("/carts/items/{id}", "delete", "Remove an item from the cart", "Customer Cart");

add("/carts/items", "delete", "Clear the cart", "Customer Cart");

// =====================================================
// CUSTOMER ORDERS
// =====================================================

add("/orders", "post", "Place an order", "Customer Orders", {
  body: "CreateOrderRequest",
  responses: {
    "201": {
      description: "Order created successfully.",
    },
  },
});

add("/orders/my-orders", "get", "Get my orders", "Customer Orders", {
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Page size.", { type: "integer", minimum: 1 }),
  ],
});

add("/orders/my-orders/{id}/cancel", "patch", "Cancel one of my orders", "Customer Orders");

// =====================================================
// SHOP OWNER ORDERS
// =====================================================

add("/orders/my-shop", "get", "Get orders received by my shop", "Shop Owner Orders", {
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Page size.", { type: "integer", minimum: 1 }),
    queryParameter("status", "Filter orders by status."),
  ],
});

add("/orders/my-shop/{id}", "get", "Get an order received by my shop", "Shop Owner Orders");

add("/orders/my-shop/status/{id}", "patch", "Update the status of my shop's order", "Shop Owner Orders", {
  body: "UpdateOrderStatusRequest",
});

// =====================================================
// ADMIN ORDERS
// =====================================================

add("/orders", "get", "Get all marketplace orders", "Admin Orders", {
  permission: "VIEW_ORDERS",
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Page size.", { type: "integer", minimum: 1 }),
    queryParameter("status", "Filter by order status."),
  ],
});

add("/orders/status/{id}", "patch", "Update an order status as Admin", "Admin Orders", {
  body: "UpdateOrderStatusRequest",
  permission: "UPDATE_ORDERS",
});

add("/orders/{id}", "get", "Get order details", "Order Details", {
  description: "Customers can access their own orders. Admins require VIEW_ORDERS.",
});

// =====================================================
// REVIEWS
// =====================================================

add("/reviews/product/{productId}", "get", "Get reviews for a product", "Product Reviews", {
  security: false,
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Number of reviews per page.", { type: "integer", minimum: 1, maximum: 100 }),
  ],
});

add("/reviews/product/{productId}", "post", "Create a product review", "Product Reviews", {
  body: "CreateReviewRequest",
  responses: {
    "201": {
      description: "Review created successfully.",
    },
  },
});

add("/reviews/{id}", "patch", "Update my product review", "Product Reviews", {
  body: "UpdateReviewRequest",
});

// =====================================================
// NOTIFICATIONS
// =====================================================

add("/notifications", "get", "Get my notifications", "Customer Notifications", {
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Number of notifications per page.", { type: "integer", minimum: 1, maximum: 50 }),
  ],
});

add("/notifications/unread-count", "get", "Get my unread notification count", "Customer Notifications");

add("/notifications/read-all", "patch", "Mark all notifications as read", "Customer Notifications");

add("/notifications/{id}/read", "patch", "Mark a notification as read", "Customer Notifications");

add("/notifications/{id}", "delete", "Delete a notification", "Customer Notifications");

// =====================================================
// SHOP OWNER PROFILE
// =====================================================

add("/shops/profile", "get", "Get my shop profile and available categories", "Shop Owner Profile");

add("/shops/update-profile", "put", "Update my shop profile", "Shop Owner Profile", {
  body: "UpdateShopProfileRequest",
});

add("/shops/my-shop/images", "patch", "Upload or update shop logo and cover image", "Shop Owner Profile", {
  multipart: "UpdateShopImagesMultipart",
});

// =====================================================
// CUSTOMER / USER ACCOUNT
// =====================================================

add("/users/profile", "get", "Get my account profile", "My Account");

add("/users/update-profile", "put", "Update my account profile", "My Account", {
  body: "UpdateProfileRequest",
});

add("/users/profile-picture", "put", "Upload my profile picture", "My Account", {
  multipart: "ProfilePictureMultipart",
});

// =====================================================
// ADMIN MARKETPLACE USER MANAGEMENT
// =====================================================

add("/users", "get", "Get marketplace users", "Admin Users", {
  permission: "MANAGE_USERS",
});

add("/users/{id}", "get", "Get marketplace user details", "Admin Users", {
  permission: "MANAGE_USERS",
});

add("/users/update-user/{id}", "put", "Update a marketplace user's email", "Admin Users", {
  body: "UpdateMarketplaceUserRequest",
  permission: "MANAGE_USERS",
});

add("/users/{id}/activate", "put", "Activate a marketplace user", "Admin Users", {
  permission: "MANAGE_USERS",
});

add("/users/{id}/deactivate", "put", "Deactivate a marketplace user", "Admin Users", {
  permission: "MANAGE_USERS",
});

add("/users/{id}/delete", "delete", "Delete a marketplace user", "Admin Users", {
  permission: "MANAGE_USERS",
});

// =====================================================
// ADMIN MANAGEMENT
// =====================================================

add("/admin", "post", "Create an Admin account", "Admin Management", {
  body: "CreateAdminRequest",
  permission: "CREATE_ADMINS",
  responses: {
    "201": {
      description: "Admin account created successfully.",
    },
  },
});

add("/admin", "get", "Get all Admin accounts", "Admin Management", {
  permission: "VIEW_ADMINS",
});

add("/admin/{adminId}", "patch", "Update an Admin account", "Admin Management", {
  body: "UpdateAdminRequest",
  permission: "UPDATE_ADMINS",
});

add("/admin/{adminId}/resend-password-setup", "post", "Resend Admin password setup email", "Admin Management", {
  permission: "RESEND_ADMIN_SETUP_EMAIL",
});

add("/admin/{adminId}/status", "patch", "Activate or deactivate an Admin account", "Admin Management", {
  body: "UpdateAdminStatusRequest",
  description: "Requires ACTIVATE_ADMINS or DEACTIVATE_ADMINS depending on the requested status.",
});

add("/admin/{adminId}", "delete", "Delete an Admin account", "Admin Management", {
  permission: "DELETE_ADMINS",
});

// =====================================================
// ADMIN ACTIVITY LOGS
// =====================================================

add("/admin/activity-logs", "get", "Get Admin activity logs", "Admin Activity Logs", {
  permission: "VIEW_ACTIVITY_LOGS",
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Page size, maximum 100.", { type: "integer", minimum: 1, maximum: 100 }),
    queryParameter("actorId", "Admin actor ID.", { type: "integer" }),
    queryParameter("action", "Filter by activity action."),
    queryParameter("targetType", "Filter by target type."),
    queryParameter("startDate", "Start date and time.", { type: "string", format: "date-time" }),
    queryParameter("endDate", "End date and time.", { type: "string", format: "date-time" }),
  ],
});

add("/admin/activity-logs/{logId}", "get", "Get one Admin activity log", "Admin Activity Logs", {
  permission: "VIEW_ACTIVITY_LOGS",
});

// =====================================================
// ADMIN DASHBOARD
// =====================================================

add("/admin/dashboard", "get", "Get Admin dashboard statistics", "Admin Dashboard", {
  permission: "VIEW_REPORTS",
});

// =====================================================
// ADMIN SHOP MANAGEMENT
// =====================================================

add("/admin/shops", "get", "Get shops for Admin management", "Admin Shops", {
  permission: "VIEW_SHOPS",
  query: [
    queryParameter("page", "Page number.", { type: "integer", minimum: 1 }),
    queryParameter("limit", "Page size.", { type: "integer", minimum: 1 }),
    queryParameter("search", "Search shops."),
    queryParameter("status", "Shop status.", { type: "string", enum: ["ACTIVE", "DEACTIVATED"] }),
  ],
});

add("/admin/shops/{shopId}", "get", "Get shop details for Admin management", "Admin Shops", {
  permission: "VIEW_SHOPS",
});

add("/admin/shops/{shopId}/status", "patch", "Activate or deactivate a shop", "Admin Shops", {
  body: "UpdateShopStatusRequest",
  description: "Requires ACTIVATE_SHOPS or DEACTIVATE_SHOPS depending on the requested status.",
});

// =====================================================
// ADMIN SHOP CATEGORY MANAGEMENT
// =====================================================

add("/admin/categories", "post", "Create a public shop category", "Admin Categories", {
  multipart: "CreateShopCategoryMultipart",
  permission: "CREATE_CATEGORIES",
  responses: {
    "201": {
      description: "Shop category created successfully.",
    },
  },
});

add("/admin/categories/{categoryId}", "patch", "Update a public shop category", "Admin Categories", {
  multipart: "UpdateShopCategoryMultipart",
  permission: "UPDATE_CATEGORIES",
});

add("/admin/categories/{categoryId}", "delete", "Delete a public shop category", "Admin Categories", {
  permission: "DELETE_CATEGORIES",
});

// =====================================================
// ADMIN ROLE AND PERMISSION MANAGEMENT
// =====================================================

add("/admin/roles/permissions", "get", "Get available Admin permissions", "Admin Roles");

add("/admin/roles", "get", "Get all Admin roles", "Admin Roles");

add("/admin/roles/{id}", "get", "Get Admin role details", "Admin Roles");

add("/admin/roles", "post", "Create an Admin role", "Admin Roles", {
  body: "CreateAdminRoleRequest",
  responses: {
    "201": {
      description: "Admin role created successfully.",
    },
  },
});

add("/admin/roles/{id}", "put", "Update an Admin role", "Admin Roles", {
  body: "UpdateAdminRoleRequest",
});

add("/admin/roles/{id}/status", "patch", "Activate or deactivate an Admin role", "Admin Roles", {
  body: "UpdateAdminRoleStatusRequest",
});

add("/admin/roles/{id}", "delete", "Delete an Admin role", "Admin Roles");

add("/admin/{adminId}/role", "patch", "Assign an Admin role to an Admin account", "Admin Roles", {
  body: "AssignAdminRoleRequest",
});

// =====================================================
// OPENAPI SPECIFICATION
// =====================================================

const swaggerSpec = {
  openapi: "3.0.3",

  info: {
    title: "ShopEase API",
    version: "1.0.0",
    description: `
# ShopEase REST API

API documentation for the ShopEase e-commerce platform.

## Authentication

Protected endpoints require a JWT access token.

1. Log in using **POST /auth/login**.
2. Copy the returned accessToken.
3. Click the **Authorize** button.
4. Enter the access token.
5. Click Authorize.

Swagger automatically displays a lock icon on endpoints that require authentication.

## Endpoint groups

- Authentication: Public account registration and authentication.
- Public Products and Public Categories: Public marketplace browsing.
- Customer: Cart, orders, reviews, likes, reports, and notifications.
- Shop Owner: Shop profile, product, category, and order management.
- Admin: Marketplace administration and permission-controlled operations.

## Admin permissions

Admin endpoints may require specific permissions. Super Admin accounts bypass normal Admin permission checks. Regular Admin accounts must have the permission required by the endpoint.

## Uploads

File upload endpoints use multipart/form-data. Uploaded files are served from the /uploads directory.
    `,
  },


servers: [
  ...(productionUrl
    ? [
        {
          url: productionUrl,
          description: "ShopEase Production API",
        },
      ]
    : []),
  {
    url: `http://localhost:${port}`,
    description: "Local development server",
  },
],


  tags: [
    {
      name: "Authentication",
      description: "Public authentication and password management.",
    },
    {
      name: "Public Products",
      description: "Public product browsing.",
    },
    {
      name: "Customer Products",
      description: "Authenticated customer product interactions.",
    },
    {
      name: "Shop Owner Products",
      description: "Shop Owner product management.",
    },
    {
      name: "Admin Products",
      description: "Admin product management.",
    },
    {
      name: "Admin Product Reports",
      description: "Admin product report review.",
    },
    {
      name: "Public Categories",
      description: "Public shop category browsing.",
    },
    {
      name: "Shop Owner Categories",
      description: "Shop Owner product category management.",
    },
    {
      name: "Customer Cart",
      description: "Authenticated customer cart operations.",
    },
    {
      name: "Customer Orders",
      description: "Customer order operations.",
    },
    {
      name: "Shop Owner Orders",
      description: "Shop Owner order management.",
    },
    {
      name: "Admin Orders",
      description: "Admin order management.",
    },
    {
      name: "Order Details",
      description: "Order details with role-based access.",
    },
    {
      name: "Product Reviews",
      description: "Product reviews and ratings.",
    },
    {
      name: "Customer Notifications",
      description: "Authenticated user's notifications.",
    },
    {
      name: "Shop Owner Profile",
      description: "Shop Owner profile and image management.",
    },
    {
      name: "My Account",
      description: "Authenticated user's personal account.",
    },
    {
      name: "Admin Users",
      description: "Admin management of marketplace users.",
    },
    {
      name: "Admin Management",
      description: "Admin account management.",
    },
    {
      name: "Admin Activity Logs",
      description: "Admin activity log access.",
    },
    {
      name: "Admin Dashboard",
      description: "Admin dashboard statistics.",
    },
    {
      name: "Admin Shops",
      description: "Admin shop management.",
    },
    {
      name: "Admin Categories",
      description: "Admin public shop category management.",
    },
    {
      name: "Admin Roles",
      description: "Admin roles and permission assignment.",
    },
  ],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your ShopEase access token.",
      },
    },

    schemas: {
      SuccessResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            example: "Request completed successfully.",
          },
          data: {
            type: "object",
            nullable: true,
            additionalProperties: true,
          },
        },
      },

      ErrorResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          message: {
            type: "string",
            example: "Invalid request data.",
          },
        },
      },

      RegisterRequest: {
        type: "object",
        required: [
          "name",
          "email",
          "password",
          "phone",
          "dateOfBirth",
          "gender",
        ],
        properties: {
          name: {
            type: "string",
            minLength: 2,
            example: "Abraham Kindie",
          },
          email: {
            type: "string",
            format: "email",
            example: "customer@example.com",
          },
          password: {
            type: "string",
            minLength: 8,
            example: "SecurePassword123",
          },
          phone: {
            type: "string",
            example: "0912345678",
            description: "Valid Ethiopian phone number.",
          },
          dateOfBirth: {
            type: "string",
            format: "date",
            example: "1998-05-15",
            description: "The registrant must be at least 18 years old.",
          },
          gender: {
            type: "string",
            enum: ["MALE", "FEMALE", "OTHER"],
          },
          address: {
            type: "string",
            example: "Bole, Addis Ababa",
          },
          city: {
            type: "string",
            example: "Addis Ababa",
          },
          country: {
            type: "string",
            example: "Ethiopia",
          },
          role: {
            type: "string",
            enum: ["USER", "SHOP_OWNER"],
            default: "USER",
          },
          shop: {
            $ref: "#/components/schemas/ShopRegistration",
          },
        },
        description: "SHOP_OWNER registration requires shop information. USER registration must not include shop information.",
      },

      ShopRegistration: {
        type: "object",
        required: ["name", "description", "shopCategoryId", "phone"],
        properties: {
          name: {
            type: "string",
            minLength: 2,
            example: "Abraham Electronics",
          },
          description: {
            type: "string",
            minLength: 10,
            example: "Electronics and accessories shop.",
          },
          shopCategoryId: {
            type: "integer",
            minimum: 1,
            example: 2,
          },
          customCategoryName: {
            type: "string",
            minLength: 2,
            maxLength: 100,
          },
          phone: {
            type: "string",
            example: "0912345678",
          },
          email: {
            type: "string",
            format: "email",
            nullable: true,
          },
          address: {
            type: "string",
          },
          city: {
            type: "string",
          },
          region: {
            type: "string",
          },
        },
        additionalProperties: false,
      },

      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
          },
          password: {
            type: "string",
            minLength: 1,
          },
        },
      },

      ForgotPasswordRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
          },
        },
      },

      ResetPasswordRequest: {
        type: "object",
        required: ["token", "newPassword"],
        properties: {
          token: {
            type: "string",
          },
          newPassword: {
            type: "string",
            minLength: 8,
          },
        },
      },

      ChangePasswordRequest: {
        type: "object",
        required: ["oldPassword", "newPassword"],
        properties: {
          oldPassword: {
            type: "string",
          },
          newPassword: {
            type: "string",
            minLength: 8,
            description: "Must differ from the old password.",
          },
        },
      },

      RefreshTokenRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: {
            type: "string",
          },
        },
      },

      VerifyAdminPasswordSetupRequest: {
        type: "object",
        required: ["token"],
        properties: {
          token: {
            type: "string",
          },
        },
      },

      AdminPasswordSetupRequest: {
        type: "object",
        required: ["token", "newPassword", "confirmPassword"],
        properties: {
          token: {
            type: "string",
          },
          newPassword: {
            type: "string",
            minLength: 8,
          },
          confirmPassword: {
            type: "string",
            minLength: 1,
          },
        },
      },

      CreateReviewRequest: {
        type: "object",
        required: ["rating", "comment"],
        properties: {
          rating: {
            type: "integer",
            minimum: 1,
            maximum: 5,
            example: 5,
          },
          comment: {
            type: "string",
            minLength: 3,
            maxLength: 1000,
            example: "Excellent product.",
          },
        },
        additionalProperties: false,
      },

      UpdateReviewRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          rating: {
            type: "integer",
            minimum: 1,
            maximum: 5,
          },
          comment: {
            type: "string",
            minLength: 3,
            maxLength: 1000,
          },
        },
        additionalProperties: false,
      },

      AddToCartRequest: {
        type: "object",
        required: ["productId"],
        properties: {
          productId: {
            type: "integer",
            minimum: 1,
          },
          quantity: {
            type: "integer",
            minimum: 1,
            default: 1,
          },
        },
        additionalProperties: false,
      },

      UpdateCartItemRequest: {
        type: "object",
        required: ["quantity"],
        properties: {
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 10000,
          },
        },
        additionalProperties: false,
      },

      CreateOrderRequest: {
        type: "object",
        required: [
          "shippingName",
          "shippingPhone",
          "shippingAddress",
          "shippingCity",
          "shippingCountry",
          "paymentMethod",
        ],
        properties: {
          shippingName: {
            type: "string",
            minLength: 2,
            maxLength: 100,
          },
          shippingPhone: {
            type: "string",
            minLength: 9,
            maxLength: 20,
          },
          shippingAddress: {
            type: "string",
            minLength: 6,
            maxLength: 250,
          },
          shippingCity: {
            type: "string",
            minLength: 2,
            maxLength: 100,
          },
          shippingCountry: {
            type: "string",
            minLength: 2,
            maxLength: 100,
            default: "Ethiopia",
          },
          paymentMethod: {
            type: "string",
            enum: ["CASH_ON_DELIVERY"],
            example: "CASH_ON_DELIVERY",
          },
        },
        additionalProperties: false,
      },

      UpdateOrderStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
          },
        },
        additionalProperties: false,
      },

      CreateProductReportRequest: {
        type: "object",
        required: ["reason"],
        properties: {
          reason: {
            type: "string",
            enum: [
              "COUNTERFEIT",
              "MISLEADING_INFORMATION",
              "PROHIBITED_PRODUCT",
              "SUSPICIOUS_ACTIVITY",
              "OTHER",
            ],
          },
          description: {
            type: "string",
            nullable: true,
            maxLength: 500,
          },
        },
        additionalProperties: false,
      },

      ReviewProductReportRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["UNDER_REVIEW", "RESOLVED", "DISMISSED"],
          },
          adminNote: {
            type: "string",
            nullable: true,
            maxLength: 500,
          },
        },
        additionalProperties: false,
      },

      CreateShopProductMultipart: {
        type: "object",
        required: ["name", "price", "stock", "productCategoryId"],
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 25,
          },
          description: {
            type: "string",
            nullable: true,
            maxLength: 200,
          },
          price: {
            type: "number",
            exclusiveMinimum: 0,
          },
          stock: {
            type: "integer",
            minimum: 0,
          },
          productCategoryId: {
            type: "integer",
            minimum: 1,
          },
          images: {
            type: "array",
            maxItems: 10,
            items: {
              type: "string",
              format: "binary",
            },
            description: "Upload up to 10 product images.",
          },
        },
      },

      UpdateShopProductMultipart: {
        type: "object",
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 25,
          },
          description: {
            type: "string",
            nullable: true,
            maxLength: 200,
          },
          price: {
            type: "number",
            exclusiveMinimum: 0,
          },
          stock: {
            type: "integer",
            minimum: 0,
          },
          productCategoryId: {
            type: "integer",
            minimum: 1,
          },
          retainedImages: {
            type: "string",
            description: "JSON string containing retained image paths.",
            example: '["/uploads/products/example.jpg"]',
          },
          images: {
            type: "array",
            maxItems: 10,
            items: {
              type: "string",
              format: "binary",
            },
          },
        },
      },

      SetProductStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["ACTIVE", "ADMIN_DEACTIVATED"],
          },
        },
      },

      SetProductFeaturedRequest: {
        type: "object",
        required: ["isFeatured"],
        properties: {
          isFeatured: {
            type: "boolean",
          },
        },
      },

      SetProductDiscountRequest: {
        type: "object",
        required: ["type", "value"],
        properties: {
          type: {
            type: "string",
            enum: ["PERCENTAGE", "FIXED"],
          },
          value: {
            type: "number",
            exclusiveMinimum: 0,
          },
          startsAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          endsAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          isActive: {
            type: "boolean",
          },
        },
      },

      CreateProductCategoryRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 40,
          },
          description: {
            type: "string",
            nullable: true,
            maxLength: 200,
          },
        },
      },

      UpdateProductCategoryRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 40,
          },
          description: {
            type: "string",
            nullable: true,
            maxLength: 200,
          },
        },
      },

      UpdateShopProfileRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 150,
          },
          description: {
            type: "string",
            minLength: 10,
            maxLength: 2000,
          },
          shopCategoryId: {
            type: "integer",
            minimum: 1,
          },
          address: {
            type: "string",
            nullable: true,
            maxLength: 255,
          },
          city: {
            type: "string",
            nullable: true,
            maxLength: 100,
          },
          region: {
            type: "string",
            nullable: true,
            maxLength: 100,
          },
          phone: {
            type: "string",
            minLength: 7,
            maxLength: 20,
          },
          email: {
            type: "string",
            format: "email",
            nullable: true,
            maxLength: 255,
          },
        },
        additionalProperties: false,
      },

      UpdateShopImagesMultipart: {
        type: "object",
        properties: {
          logo: {
            type: "string",
            format: "binary",
          },
          coverImage: {
            type: "string",
            format: "binary",
          },
        },
        description: "Upload at least one image: logo or coverImage.",
      },

      UpdateProfileRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 100,
          },
          phone: {
            type: "string",
            nullable: true,
          },
          gender: {
            type: "string",
            enum: ["MALE", "FEMALE", "OTHER"],
            nullable: true,
          },
          dateOfBirth: {
            type: "string",
            format: "date",
            nullable: true,
          },
          address: {
            type: "string",
            nullable: true,
          },
          city: {
            type: "string",
            nullable: true,
          },
          country: {
            type: "string",
            nullable: true,
          },
          profileImage: {
            type: "string",
            nullable: true,
          },
        },
      },

      ProfilePictureMultipart: {
        type: "object",
        required: ["profileImage"],
        properties: {
          profileImage: {
            type: "string",
            format: "binary",
          },
        },
      },

      CreateAdminRequest: {
        type: "object",
        required: ["name", "email", "adminRoleId"],
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 100,
          },
          email: {
            type: "string",
            format: "email",
          },
          phone: {
            type: "string",
            nullable: true,
          },
          dateOfBirth: {
            type: "string",
            format: "date",
            nullable: true,
          },
          gender: {
            type: "string",
            enum: ["MALE", "FEMALE", "OTHER"],
          },
          adminRoleId: {
            type: "integer",
            minimum: 1,
          },
        },
      },

      UpdateAdminRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 100,
          },
          email: {
            type: "string",
            format: "email",
          },
          phone: {
            type: "string",
            nullable: true,
          },
          dateOfBirth: {
            type: "string",
            format: "date",
            nullable: true,
          },
          gender: {
            type: "string",
            enum: ["MALE", "FEMALE", "OTHER"],
          },
        },
      },

      UpdateAdminStatusRequest: {
        type: "object",
        required: ["isActive"],
        properties: {
          isActive: {
            type: "boolean",
          },
        },
      },

      UpdateShopStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["ACTIVE", "DEACTIVATED"],
          },
        },
      },

      CreateShopCategoryMultipart: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 100,
          },
          description: {
            type: "string",
            maxLength: 500,
          },
          image: {
            type: "string",
            format: "binary",
          },
        },
      },

      UpdateShopCategoryMultipart: {
        type: "object",
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 100,
          },
          description: {
            type: "string",
            maxLength: 500,
          },
          image: {
            type: "string",
            format: "binary",
          },
        },
      },

      UpdateMarketplaceUserRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
          },
        },
      },

      CreateAdminRoleRequest: {
        type: "object",
        required: ["name", "permissions"],
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 100,
          },
          description: {
            type: "string",
            maxLength: 255,
          },
          permissions: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["VIEW_USERS", "VIEW_SHOPS"],
          },
        },
      },

      UpdateAdminRoleRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 100,
          },
          description: {
            type: "string",
            maxLength: 255,
            nullable: true,
          },
          permissions: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
      },

      UpdateAdminRoleStatusRequest: {
        type: "object",
        required: ["isActive"],
        properties: {
          isActive: {
            type: "boolean",
          },
        },
      },

      AssignAdminRoleRequest: {
        type: "object",
        required: ["adminRoleId"],
        properties: {
          adminRoleId: {
            type: "integer",
            minimum: 1,
          },
        },
      },
    },
  },

  paths,
};

// =====================================================
// DOCUMENTATION DIAGNOSTICS
// =====================================================

const discoveredPaths = Object.keys(swaggerSpec.paths);

const endpointCount = discoveredPaths.reduce(
  (total, route) => total + Object.keys(swaggerSpec.paths[route]).length,
  0,
);

console.log("\n========== SWAGGER DOCUMENTATION ==========");
console.log("Discovered paths:", discoveredPaths.length);
console.log("Documented operations:", endpointCount);

for (const route of discoveredPaths) {
  const methods = Object.keys(swaggerSpec.paths[route])
    .map((method) => method.toUpperCase())
    .join(", ");

  console.log(`${methods} ${route}`);
}

console.log("===========================================\n");

export default swaggerSpec;
