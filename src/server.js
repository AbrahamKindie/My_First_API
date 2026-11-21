
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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
// ENVIRONMENT CONFIGURATION
// ==========================================

dotenv.config();

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
app.use("/admin", adminRoutes);
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
  console.error("Global Error Handler:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.statusCode
      ? err.message
      : "Internal server error",
  });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`ShopEase API running on port ${PORT}`);

  // Start persistent database polling for pending orders.
  try {
    startOrderScheduler();
    console.log("ShopEase order scheduler started");
  } catch (error) {
    console.error("Failed to start order scheduler:", error);
  }
});

export { server };
export default app;
