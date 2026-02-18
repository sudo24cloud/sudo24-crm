const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

/**
 * ✅ Ensure uploads folder exists:
 * server/uploads
 */
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `emp_${Date.now()}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  if (!ok) return cb(new Error("Only JPG/PNG/WEBP allowed"), false);
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

/**
 * ✅ POST /api/upload/employee-photo
 * form-data key: "photo"
 * returns: { url: "/uploads/<filename>" }
 *
 * NOTE: For now this is open if user is logged-in via token in frontend.
 * If you want strict admin-only, I will add isAuth + isAdmin after seeing your auth middleware.
 */
router.post("/employee-photo", upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

module.exports = router;
