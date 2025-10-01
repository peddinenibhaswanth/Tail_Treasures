const express = require("express")
const router = express.Router()
const authController = require("../controllers/authController")
const { forwardAuthenticated, ensureAuthenticated } = require("../middleware/auth")
const { userUpload } = require("../middleware/upload")
const User = require("../models/User")
const bcrypt = require("bcryptjs")
const Product = require("../models/Product")
const Appointment = require("../models/Appointment")
const AdoptionApplication = require("../models/AdoptionApplication")
const path = require("path")
const fs = require("fs")

// Login page
router.get("/login", forwardAuthenticated, authController.getLogin)

// Register page
router.get("/register", forwardAuthenticated, authController.getRegister)

// Login process
router.post("/login", authController.login)

// Register process
router.post("/register", userUpload.single("profileImage"), authController.register)

// Logout
router.get("/logout", authController.logout)

// Profile page
router.get("/profile", ensureAuthenticated, authController.getProfile)

// Update profile
router.post("/profile", ensureAuthenticated, userUpload.single("profileImage"), authController.updateProfile)

// Change password
router.post("/change-password", ensureAuthenticated, authController.changePassword)

// Delete account
router.delete("/delete-account", ensureAuthenticated, async (req, res, next) => {
  try {
    const { currentPassword } = req.body
    const user = await User.findById(req.user._id)

    // Check if password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      req.flash("error", "Incorrect password")
      return res.redirect("/profile")
    }

    // Delete user data based on role
    if (user.role === "seller") {
      // Delete seller's products
      const products = await Product.find({ seller: user._id })
      for (const product of products) {
        // Delete product images
        if (product.images && product.images.length > 0) {
          product.images.forEach((image) => {
            const imagePath = path.join(__dirname, "../public", image)
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath)
            }
          })
        }
        // Delete product
        await Product.findByIdAndDelete(product._id)
      }
    } else if (user.role === "veterinary") {
      // Cancel vet's appointments
      await Appointment.updateMany(
        { veterinary: user._id, status: { $nin: ["completed", "cancelled"] } },
        { status: "cancelled", notes: "Veterinarian account deleted" },
      )
    } else if (user.role === "customer") {
      // Cancel customer's pending applications
      await AdoptionApplication.updateMany(
        { adopter: user._id, status: { $nin: ["approved", "rejected"] } },
        { status: "cancelled", notes: "Adopter account deleted" },
      )
    }

    // Delete user's profile image
    if (user.profileImage && user.profileImage !== "/uploads/users/default.png") {
      const imagePath = path.join(__dirname, "../public", user.profileImage)
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }

    // Delete user
    await User.findByIdAndDelete(user._id)

    // Logout user
    req.logout((err) => {
      if (err) {
        return next(err)
      }
      req.flash("success", "Your account has been deleted successfully")
      res.redirect("/")
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while deleting your account")
    res.redirect("/profile")
  }
})

module.exports = router
