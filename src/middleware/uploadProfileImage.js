
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const uploadDirectory = path.join(
  process.cwd(),
  "uploads",
  "profiles"
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    cb(null, `${randomUUID()}${extension}`);
  },
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error("Only JPEG, PNG, WebP, and GIF images are allowed.")
    );
  }

  cb(null, true);
};

const uploadProfileImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

export default uploadProfileImage;
