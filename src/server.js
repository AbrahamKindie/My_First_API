
import "dotenv/config";

import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";

// ==========================================
// ROUTES
// ==========================================

import authRoutes from "./routs/authRoutes.js";
import productRoutes from "./routs/productRoutes.js";
import categoryRoutes from "./routs/categoryRoutes.js";
import cartRoutes from "./routs/cartRoutes.js";
import orderRoutes from "./routs/orderRoutes.js";
import reviewRoutes from "./routs/reviewRouts.js";
import notificationRoutes from "./routs/notificationRoutes.js";
import adminRoutes from "./routs/adminRoutes.js";
import shopRoutes from "./routs/shopRoutes.js";
import userRoutes from "./routs/userRoutes.js";
import adminRoleRoutes from "./routs/adminRoleRoutes.js";

// ==========================================
// BACKGROUND SERVICES
// ==========================================

import { startOrderScheduler } from "./services/orderScheduler.js";

// ==========================================
// EXPRESS APPLICATION
// ==========================================

const app = express();

// ==========================================
// DIRECTORY CONFIGURATION
// ==========================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// GLOBAL MIDDLEWARE
// ==========================================

app.use(cors());

app.use(express.json({ limit: "10mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// ==========================================
// SWAGGER / OPENAPI DOCUMENTATION
// ==========================================

// OpenAPI JSON specification.
app.get("/openapi.json", (req, res) => {
  res.status(200).json(swaggerSpec);
});

// Interactive Swagger UI.
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "ShopEase API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "list",
      filter: true,
      showCommonExtensions: true,
    },
  })
);

// ==========================================
// STATIC FILES
// ==========================================

app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"))
);

// ==========================================
// API ROUTES
// ==========================================

app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/categories", categoryRoutes);
app.use("/carts", cartRoutes);
app.use("/orders", orderRoutes);
app.use("/reviews", reviewRoutes);
app.use("/notifications", notificationRoutes);
app.use("/shops", shopRoutes);
app.use("/users", userRoutes);

// Admin account and marketplace management.
app.use("/admin", adminRoutes);

// Admin roles and permission management.
app.use("/admin", adminRoleRoutes);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ShopEase API is running",
  });
});

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
  console.error("========== GLOBAL ERROR ==========");
  console.error("Request:", req.method, req.originalUrl);
  console.error("Error name:", err.name);
  console.error("Error code:", err.code);
  console.error("Error message:", err.message);
  console.error("Full error:", err);
  console.error("==================================");

  // Delegate if response headers have already been sent.
  if (res.headersSent) {
    return next(err);
  }

  // ==========================================
  // MULTER ERRORS
  // ==========================================

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
      code: err.code,
      field: err.field || null,
    });
  }

  // ==========================================
  // OTHER APPLICATION ERRORS
  // ==========================================

  const statusCode = err.statusCode || err.status || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : statusCode >= 500
          ? "Internal server error"
          : err.message,
  });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;
const PRODUCTION_API_URL= process.env.PRODUCTION_API_URL;

const server = app.listen(PORT, () => {
  console.log("========================================");
  console.log("          SHOEASE BACKEND API");
  console.log("========================================");
  console.log(`Server:       http://localhost:${PORT}`);
  console.log(`Swagger UI:   http://localhost:${PORT}/api-docs`);
  console.log(`OpenAPI JSON: http://localhost:${PORT}/openapi.json`);
  console.log(`production JSON : ${PRODUCTION_API_URL}/openapi.json`);
  console.log("========================================");

  // ==========================================
  // START ORDER SCHEDULER
  // ==========================================

  try {
    startOrderScheduler();
    console.log("[ORDER SCHEDULER] Started successfully.");
  } catch (error) {
    console.error("[ORDER SCHEDULER] Failed to start:", error);
  }
});

// ==========================================
// EXPORTS
// ==========================================

export { server };
export default app;
