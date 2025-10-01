const multer = require("multer")
const path = require("path")
const fs = require("fs")

// Ensure upload directories exist
const createDirIfNotExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Create upload directories
createDirIfNotExists("public/uploads/pets")
createDirIfNotExists("public/uploads/products")
createDirIfNotExists("public/uploads/users")

// Configure storage for pet images
const petStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/pets")
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`)
  },
})

// Configure storage for product images
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/products")
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`)
  },
})

// Configure storage for user profile images
const userStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/users")
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`)
  },
})

// File filter for images
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true)
  } else {
    cb(new Error("Only image files are allowed!"), false)
  }
}

// Create upload instances
const petUpload = multer({
  storage: petStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

const productUpload = multer({
  storage: productStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

const userUpload = multer({
  storage: userStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
})

module.exports = {
  petUpload,
  productUpload,
  userUpload,
}
