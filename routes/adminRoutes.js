const express = require("express")
const router = express.Router()
const { ensureAuthenticated, isAdmin, isStrictlyAdmin } = require("../middleware/auth")
const User = require("../models/User")
const Pet = require("../models/Pet")
const Product = require("../models/Product")
const Order = require("../models/Order")
const AdoptionApplication = require("../models/AdoptionApplication")
const Appointment = require("../models/Appointment")
const Message = require("../models/Message")
const { userUpload } = require("../middleware/upload")
const bcrypt = require("bcryptjs")
const nodemailer = require("nodemailer")
const fs = require("fs")
const path = require("path")

// Admin dashboard is handled by the main dashboard route

// User management
router.get("/users", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 })

    // Separate approved and pending users
    const approvedUsers = users.filter((user) => user.isApproved)
    const pendingUsers = users.filter((user) => !user.isApproved)

    res.render("pages/admin/users", {
      title: "Manage Users",
      users: approvedUsers,
      pendingUsers,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading users")
    res.redirect("/admin/dashboard")
  }
})

// View user
router.get("/users/:id", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error", "User not found")
      return res.redirect("/admin/users")
    }

    // Get user-specific data based on role
    const userData = {}

    if (user.role === "customer") {
      userData.applications = await AdoptionApplication.find({ adopter: user._id }).populate("pet", "name status")

      userData.orders = await Order.find({ customer: user._id })
    } else if (user.role === "seller") {
      userData.products = await Product.find({ seller: user._id })
    } else if (user.role === "veterinary") {
      userData.appointments = await Appointment.find({ veterinary: user._id }).populate("customer", "name")
    }

    res.render("pages/admin/user-detail", {
      title: user.name,
      user,
      ...userData,
      currentPath: "/admin/users",
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading user details")
    res.redirect("/admin/users")
  }
})

// View pending user details
router.get("/users/pending/:id", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error", "User not found")
      return res.redirect("/admin/users")
    }

    res.render("pages/admin/pending-user-detail", {
      title: "Pending User Details",
      user,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading user details")
    res.redirect("/admin/users")
  }
})

// Approve user
router.post("/users/:id/approve", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error", "User not found")
      return res.redirect("/admin/users")
    }

    user.isApproved = true
    await user.save()

    req.flash("success", "User approved successfully")
    res.redirect("/admin/users")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while approving the user")
    res.redirect("/admin/users")
  }
})

// Reject user
router.post("/users/:id/reject", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error", "User not found")
      return res.redirect("/admin/users")
    }

    // Delete user
    await User.findByIdAndDelete(user._id)

    req.flash("success", "User rejected and removed successfully")
    res.redirect("/admin/users")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while rejecting the user")
    res.redirect("/admin/users")
  }
})

// Approve user
router.get("/users/:id/approve", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error", "User not found")
      return res.redirect("/admin/users")
    }

    user.isApproved = true
    await user.save()

    req.flash("success", "User approved successfully")
    res.redirect(`/admin/users/${user._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while approving the user")
    res.redirect("/admin/users")
  }
})

// Reject user
router.get("/users/:id/reject", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error", "User not found")
      return res.redirect("/admin/users")
    }

    // In a real app, you might want to send an email notification
    // For now, we'll just delete the user
    await User.findByIdAndDelete(user._id)

    req.flash("success", "User rejected and removed")
    res.redirect("/admin/users")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while rejecting the user")
    res.redirect("/admin/users")
  }
})

// Delete user
router.delete("/users/:id", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error", "User not found")
      return res.redirect("/admin/users")
    }

    // Delete user's profile image if it's not the default
    if (user.profileImage && user.profileImage !== "/images/default-profile.jpg") {
      const imagePath = path.join(__dirname, "../public", user.profileImage)
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }

    // Delete user's products if they're a seller
    if (user.role === "seller") {
      const products = await Product.find({ seller: user._id })

      for (const product of products) {
        // Delete product images
        if (product.images && product.images.length > 0) {
          for (const image of product.images) {
            const imagePath = path.join(__dirname, "../public", image)
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath)
            }
          }
        }

        // Delete the product
        await Product.findByIdAndDelete(product._id)
      }
    }

    // Delete user's pets if they're a shelter
    if (user.role === "shelter") {
      const pets = await Pet.find({ shelter: user._id })

      for (const pet of pets) {
        // Delete pet images
        if (pet.images && pet.images.length > 0) {
          for (const image of pet.images) {
            const imagePath = path.join(__dirname, "../public", image)
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath)
            }
          }
        }

        // Delete the pet
        await Pet.findByIdAndDelete(pet._id)
      }
    }

    // Delete user's appointments if they're a vet
    if (user.role === "veterinary") {
      await Appointment.deleteMany({ veterinary: user._id })
    }

    // Delete user's applications if they're a customer
    if (user.role === "customer") {
      await AdoptionApplication.deleteMany({ adopter: user._id })
    }

    // Delete the user
    await User.findByIdAndDelete(user._id)

    req.flash("success", "User deleted successfully")
    res.redirect("/admin/users")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while deleting the user")
    res.redirect("/admin/users")
  }
})

// Pet management
router.get("/pets", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const { status, species } = req.query
    const filter = {}

    if (status) filter.status = status
    if (species) filter.species = species

    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit

    const pets = await Pet.find(filter).populate("shelter", "name").sort({ createdAt: -1 }).skip(skip).limit(limit)

    const total = await Pet.countDocuments(filter)
    const pages = Math.ceil(total / limit)

    res.render("pages/admin/pets", {
      title: "Pet Management",
      pets,
      current: page,
      pages,
      filter: req.query,
      currentPath: req.path,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading pets")
    res.redirect("/dashboard")
  }
})

// Delete pet
router.delete("/pets/:id", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id)

    if (!pet) {
      req.flash("error", "Pet not found")
      return res.redirect("/admin/pets")
    }

    // Delete pet images from filesystem
    if (pet.images && pet.images.length > 0) {
      pet.images.forEach((image) => {
        const imagePath = path.join(__dirname, "../public", image)
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath)
        }
      })
    }

    // Delete related adoption applications
    await AdoptionApplication.deleteMany({ pet: pet._id })

    // Delete the pet
    await Pet.findByIdAndDelete(pet._id)

    req.flash("success", "Pet deleted successfully")
    res.redirect("/admin/pets")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while deleting the pet")
    res.redirect("/admin/pets")
  }
})

// Product management
router.get("/products", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const { category, petType } = req.query
    const filter = {}

    if (category) filter.category = category
    if (petType) filter.petType = petType

    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit

    const products = await Product.find(filter)
      .populate("seller", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Product.countDocuments(filter)
    const pages = Math.ceil(total / limit)

    res.render("pages/admin/products", {
      title: "Product Management",
      products,
      current: page,
      pages,
      filter: req.query,
      currentPath: req.path,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading products")
    res.redirect("/dashboard")
  }
})

// Delete product
router.delete("/products/:id", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      req.flash("error", "Product not found")
      return res.redirect("/admin/products")
    }

    // Delete product images from filesystem
    if (product.images && product.images.length > 0) {
      product.images.forEach((image) => {
        const imagePath = path.join(__dirname, "../public", image)
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath)
        }
      })
    }

    // Delete the product
    await Product.findByIdAndDelete(product._id)

    req.flash("success", "Product deleted successfully")
    res.redirect("/admin/products")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while deleting the product")
    res.redirect("/admin/products")
  }
})

// Application management
router.get("/applications", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const { status } = req.query
    const filter = {}

    if (status) filter.status = status

    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit

    const applications = await AdoptionApplication.find(filter)
      .populate("pet", "name")
      .populate("adopter", "name")
      .populate("shelter", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await AdoptionApplication.countDocuments(filter)
    const pages = Math.ceil(total / limit)

    res.render("pages/admin/applications", {
      title: "Adoption Applications",
      applications,
      current: page,
      pages,
      filter: req.query,
      currentPath: req.path,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading applications")
    res.redirect("/dashboard")
  }
})

// View application details
router.get("/applications/:id", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const application = await AdoptionApplication.findById(req.params.id)
      .populate("pet")
      .populate("adopter")
      .populate("shelter", "name")

    if (!application) {
      req.flash("error", "Application not found")
      return res.redirect("/admin/applications")
    }

    res.render("pages/admin/application-detail", {
      title: "Application Details",
      application,
      currentPath: "/admin/applications",
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading application details")
    res.redirect("/admin/applications")
  }
})

// Mark application as under review
router.post("/applications/:id/mark-under-review", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const application = await AdoptionApplication.findById(req.params.id)

    if (!application) {
      req.flash("error", "Application not found")
      return res.redirect("/admin/applications")
    }

    application.status = "under review"
    await application.save()

    req.flash("success", "Application marked as under review")
    res.redirect(`/admin/applications/${application._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while updating the application")
    res.redirect("/admin/applications")
  }
})

// Approve application
router.post("/applications/:id/approve", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const application = await AdoptionApplication.findById(req.params.id)

    if (!application) {
      req.flash("error", "Application not found")
      return res.redirect("/admin/applications")
    }

    application.status = "approved"
    await application.save()

    // Update pet status to adopted
    const pet = await Pet.findById(application.pet)
    if (pet) {
      pet.status = "adopted"
      await pet.save()
    }

    // Reject other applications for this pet
    await AdoptionApplication.updateMany(
      {
        pet: application.pet,
        _id: { $ne: application._id },
        status: { $in: ["submitted", "under review"] },
      },
      {
        status: "denied",
        denialReason: "Another applicant has been selected for this pet.",
      },
    )

    req.flash("success", "Application approved successfully")
    res.redirect(`/admin/applications/${application._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while approving the application")
    res.redirect("/admin/applications")
  }
})

// Deny application
router.post("/applications/:id/deny", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const { denialReason } = req.body
    const application = await AdoptionApplication.findById(req.params.id)

    if (!application) {
      req.flash("error", "Application not found")
      return res.redirect("/admin/applications")
    }

    application.status = "denied"
    application.denialReason = denialReason
    await application.save()

    // Update pet status back to available if it was pending
    const pet = await Pet.findById(application.pet)
    if (pet && pet.status === "pending") {
      pet.status = "available"
      await pet.save()
    }

    req.flash("success", "Application denied successfully")
    res.redirect(`/admin/applications/${application._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while denying the application")
    res.redirect("/admin/applications")
  }
})

// Delete application
router.delete("/applications/:id", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const application = await AdoptionApplication.findById(req.params.id)

    if (!application) {
      req.flash("error", "Application not found")
      return res.redirect("/admin/applications")
    }

    // If the application was pending and the pet status is pending, set it back to available
    if (application.status === "submitted" || application.status === "under review") {
      const pet = await Pet.findById(application.pet)
      if (pet && pet.status === "pending") {
        pet.status = "available"
        await pet.save()
      }
    }

    await AdoptionApplication.findByIdAndDelete(application._id)

    req.flash("success", "Application deleted successfully")
    res.redirect("/admin/applications")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while deleting the application")
    res.redirect("/admin/applications")
  }
})

// Message management
router.get("/messages", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const { read } = req.query
    const filter = {}

    if (read === "true") filter.isRead = true
    if (read === "false") filter.isRead = false

    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit

    const messages = await Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)

    const total = await Message.countDocuments(filter)
    const pages = Math.ceil(total / limit)

    // Count unread messages for navbar badge
    const unreadCount = await Message.countDocuments({ isRead: false })

    res.render("pages/admin/messages", {
      title: "Messages",
      messages,
      current: page,
      pages,
      filter: req.query,
      unreadCount,
      currentPath: req.path,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading messages")
    res.redirect("/dashboard")
  }
})

// View message
router.get("/messages/:id", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)

    if (!message) {
      req.flash("error", "Message not found")
      return res.redirect("/admin/messages")
    }

    // Mark as read
    if (!message.isRead) {
      message.isRead = true
      await message.save()
    }

    // Count unread messages for navbar badge
    const unreadCount = await Message.countDocuments({ isRead: false })

    res.render("pages/admin/message-detail", {
      title: message.subject,
      message,
      unreadCount,
      currentPath: "/admin/messages",
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading the message")
    res.redirect("/admin/messages")
  }
})

// Mark message as read
router.post("/messages/:id/mark-read", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)

    if (!message) {
      req.flash("error", "Message not found")
      return res.redirect("/admin/messages")
    }

    message.isRead = true
    await message.save()

    req.flash("success", "Message marked as read")
    res.redirect(`/admin/messages/${message._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred")
    res.redirect("/admin/messages")
  }
})

// Mark message as unread
router.post("/messages/:id/mark-unread", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)

    if (!message) {
      req.flash("error", "Message not found")
      return res.redirect("/admin/messages")
    }

    message.isRead = false
    await message.save()

    req.flash("success", "Message marked as unread")
    res.redirect(`/admin/messages/${message._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred")
    res.redirect("/admin/messages")
  }
})

// Reply to message
router.post("/messages/:id/reply", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const { subject, message: replyMessage } = req.body
    const message = await Message.findById(req.params.id)

    if (!message) {
      req.flash("error", "Message not found")
      return res.redirect("/admin/messages")
    }

    // In a real app, you would send an email here
    // For now, we'll just simulate it

    // Create a transporter (in a real app, use actual SMTP settings)
    const transporter = nodemailer.createTransport({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: {
        user: "noreply@example.com",
        pass: "password",
      },
    })

    // Email content
    const mailOptions = {
      from: '"Pet Adoption Platform" <noreply@example.com>',
      to: message.email,
      subject: subject,
      text: replyMessage,
      html: `<p>${replyMessage.replace(/\n/g, "<br>")}</p>`,
    }

    // In a real app, you would uncomment this
    // await transporter.sendMail(mailOptions)

    // Mark message as read
    message.isRead = true
    await message.save()

    req.flash("success", "Reply sent successfully")
    res.redirect("/admin/messages")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while sending reply")
    res.redirect(`/admin/messages/${req.params.id}`)
  }
})

// Delete message
router.delete("/messages/:id", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)

    if (!message) {
      req.flash("error", "Message not found")
      return res.redirect("/admin/messages")
    }

    await Message.findByIdAndDelete(message._id)

    req.flash("success", "Message deleted successfully")
    res.redirect("/admin/messages")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while deleting the message")
    res.redirect("/admin/messages")
  }
})

// Co-Admin management - Only accessible by strict admin
router.get("/co-admins", ensureAuthenticated, isStrictlyAdmin, async (req, res) => {
  try {
    const coAdmins = await User.find({ role: "co-admin" }).populate("createdBy", "name")

    res.render("pages/admin/co-admins", {
      title: "Co-Admin Management",
      coAdmins,
      currentPath: req.path,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading co-admins")
    res.redirect("/dashboard")
  }
})

// Create co-admin - Only accessible by strict admin
router.post("/co-admins", ensureAuthenticated, isStrictlyAdmin, async (req, res) => {
  try {
    const { name, email, password, phone } = req.body

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      req.flash("error", "Email is already registered")
      return res.redirect("/admin/co-admins")
    }

    // Create new co-admin
    const newCoAdmin = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: "co-admin",
      phone,
      createdBy: req.user._id,
    })

    await newCoAdmin.save()

    req.flash("success", "Co-Admin created successfully")
    res.redirect("/admin/co-admins")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while creating co-admin")
    res.redirect("/admin/co-admins")
  }
})

// Update co-admin - Only accessible by strict admin
router.put("/co-admins/:id", ensureAuthenticated, isStrictlyAdmin, async (req, res) => {
  try {
    const { name, email, phone } = req.body
    const coAdmin = await User.findById(req.params.id)

    if (!coAdmin || coAdmin.role !== "co-admin") {
      req.flash("error", "Co-Admin not found")
      return res.redirect("/admin/co-admins")
    }

    // Update co-admin
    coAdmin.name = name
    coAdmin.email = email.toLowerCase()
    coAdmin.phone = phone

    await coAdmin.save()

    req.flash("success", "Co-Admin updated successfully")
    res.redirect("/admin/co-admins")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while updating co-admin")
    res.redirect("/admin/co-admins")
  }
})

// Delete co-admin - Only accessible by strict admin
router.delete("/co-admins/:id", ensureAuthenticated, isStrictlyAdmin, async (req, res) => {
  try {
    const coAdmin = await User.findById(req.params.id)

    if (!coAdmin || coAdmin.role !== "co-admin") {
      req.flash("error", "Co-Admin not found")
      return res.redirect("/admin/co-admins")
    }

    await User.findByIdAndDelete(coAdmin._id)

    req.flash("success", "Co-Admin deleted successfully")
    res.redirect("/admin/co-admins")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while deleting co-admin")
    res.redirect("/admin/co-admins")
  }
})

// Dashboard statistics
router.get("/statistics", ensureAuthenticated, isAdmin, async (req, res) => {
  try {
    console.log("Fetching statistics data...")

    // Get user statistics
    const userCount = await User.countDocuments()
    const customerCount = await User.countDocuments({ role: "customer" })
    const sellerCount = await User.countDocuments({ role: "seller" })
    const vetCount = await User.countDocuments({ role: "veterinary" })

    // Get pet statistics
    const petCount = await Pet.countDocuments()
    const availablePets = await Pet.countDocuments({ status: "available" })
    const pendingPets = await Pet.countDocuments({ status: "pending" })
    const adoptedPets = await Pet.countDocuments({ status: "adopted" })

    // Get product statistics
    const productCount = await Product.countDocuments()
    const inStockProducts = await Product.countDocuments({ stock: { $gt: 0 } })
    const outOfStockProducts = await Product.countDocuments({ stock: 0 })

    // Get application statistics
    const applicationCount = await AdoptionApplication.countDocuments()
    const submittedApplications = await AdoptionApplication.countDocuments({ status: "submitted" })
    const reviewApplications = await AdoptionApplication.countDocuments({ status: "under review" })
    const approvedApplications = await AdoptionApplication.countDocuments({ status: "approved" })

    // Get monthly adoptions data (last 6 months)
    const monthlyAdoptionsData = await getMonthlyAdoptionsData()

    // Get pet types data
    const petTypesData = await getPetTypesData()

    // Get recent users
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5)

    // Get recent orders
    const recentOrders = await Order.find().populate("customer", "name").sort({ createdAt: -1 }).limit(5)

    const stats = {
      userCount,
      customerCount,
      sellerCount,
      vetCount,
      petCount,
      availablePets,
      pendingPets,
      adoptedPets,
      productCount,
      inStockProducts,
      outOfStockProducts,
      applicationCount,
      submittedApplications,
      reviewApplications,
      approvedApplications,
    }

    console.log("Stats:", stats)

    res.render("pages/admin/statistics", {
      title: "Admin Statistics",
      stats,
      monthlyAdoptionsData,
      petTypesData,
      recentUsers,
      recentOrders,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading statistics")
    res.redirect("/admin/dashboard")
  }
})

// Helper function to get monthly adoptions data
async function getMonthlyAdoptionsData() {
  const months = []
  const data = []

  // Get last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monthName = date.toLocaleString("default", { month: "short" })
    const year = date.getFullYear()
    months.push(`${monthName} ${year}`)

    // Get start and end of month
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)

    // Count adoptions in this month
    const count = await AdoptionApplication.countDocuments({
      status: "approved",
      updatedAt: { $gte: startOfMonth, $lte: endOfMonth },
    })

    data.push(count)
  }

  return { labels: months, data }
}

// Helper function to get pet types data
async function getPetTypesData() {
  const petTypes = ["Dog", "Cat", "Bird", "Small Animal", "Other"]
  const data = []

  for (const type of petTypes) {
    let count
    if (type === "Other") {
      count = await Pet.countDocuments({
        species: { $nin: ["Dog", "Cat", "Bird", "Small Animal"] },
      })
    } else {
      count = await Pet.countDocuments({ species: type })
    }
    data.push(count)
  }

  return { labels: petTypes, data }
}

module.exports = router
