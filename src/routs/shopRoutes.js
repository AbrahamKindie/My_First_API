
import express from "express";
import authentication from "../middleware/auth.js";
import requireShopOwner from "../middleware/requireShopOwner.js";
import validate from "../middleware/validateMiddleware.js";
import uploadShopImages from "../middleware/uploadShopImages.js";

import {
  getMyShopProfileController,
  updateMyShopProfileController,
  updateMyShopImagesController,
} from "../controllers/shopControllers.js";

import {
  updateShopProfileSchema,
} from "../validators/shopValidations.js";

const router = express.Router();

// ==========================================
// SHOP OWNER PROFILE MANAGEMENT
// ==========================================

// GET /shops/profile
router.get(
  "/profile",
  authentication,
  requireShopOwner,
  getMyShopProfileController
);

// PUT /shops/update-profile
router.put(
  "/update-profile",
  authentication,
  requireShopOwner,
  validate(updateShopProfileSchema),
  updateMyShopProfileController
);

// ==========================================
// SHOP LOGO AND COVER IMAGE UPLOAD
// ==========================================

// PATCH /shops/my-shop/images
router.patch(
  "/my-shop/images",
  authentication,
  requireShopOwner,
  uploadShopImages.fields([
    { name: "logo", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  updateMyShopImagesController
);

export default router;
