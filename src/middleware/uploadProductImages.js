
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const uploadDirectory = path.join(
  process.cwd(),
  "uploads",
  "products"
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  console.log("[MULTER RECEIVED FILE]", file.originalname);

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error("Only JPEG, PNG, WEBP, and GIF images are allowed")
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
});

console.log("[PRODUCT MULTER] Initialized: maximum 10 files");

export default upload;
