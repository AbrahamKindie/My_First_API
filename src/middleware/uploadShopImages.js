
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// ==========================================
// SHOP IMAGE DIRECTORIES
// ==========================================

const uploadDirectory = path.join(
  process.cwd(),
  "uploads",
  "shops"
);

const logoDirectory = path.join(uploadDirectory, "logos");
const coverDirectory = path.join(uploadDirectory, "covers");

fs.mkdirSync(logoDirectory, { recursive: true });
fs.mkdirSync(coverDirectory, { recursive: true });

// ==========================================
// ALLOWED IMAGE TYPES
// ==========================================

const allowedMimeTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// ==========================================
// STORAGE CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "logo") {
      return cb(null, logoDirectory);
    }

    if (file.fieldname === "coverImage") {
      return cb(null, coverDirectory);
    }

    return cb(new Error("Invalid shop image field."));
  },

  filename: (req, file, cb) => {
    const extension = allowedMimeTypes[file.mimetype];

    if (!extension) {
      return cb(new Error("Unsupported image type."));
    }

    cb(null, `${randomUUID()}${extension}`);
  },
});

// ==========================================
// FILE FILTER
// ==========================================

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes[file.mimetype]) {
    return cb(
      new Error(
        "Only JPEG, PNG, WebP, and GIF images are allowed."
      )
    );
  }

  cb(null, true);
};

// ==========================================
// MULTER CONFIGURATION
// ==========================================

const uploadShopImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2,
  },
});

export default uploadShopImages;
