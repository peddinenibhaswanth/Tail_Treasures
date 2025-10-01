const express = require("express")
const router = express.Router()
const { ensureAuthenticated, isAdmin, isSeller, isVet } = require("../middleware/auth")
const User = require("../models/User")
const Pet = require("../models/Pet")
const Product = require("../models/Product")
const Order = require("../models/Order")
const AdoptionApplication = require("../models/AdoptionApplication")
const Appointment = require("../models/Appointment")
const Message = require("../models/Message")
const Cart = require("../models/Cart")
const Review = require("../models/Review")
const orderController = require("../controllers/orderController")

// Dashboard home
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    console.log("User accessing dashboard:", req.user.email, req.user.role)
    const userData = { user: req.user }

    if (req.user.role === "admin" || req.user.role === "co-admin") {
      console.log("Fetching admin dashboard data...")
      const stats = {
        userCount: await User.countDocuments(),
        petCount: await Pet.countDocuments(),
        productCount: await Product.countDocuments(),
        applicationCount: await AdoptionApplication.countDocuments(),
      }
      console.log("Stats:", stats)
      const recentPets = await Pet.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("shelter", "name")
      console.log("Recent Pets:", recentPets)
      const recentApplications = await AdoptionApplication.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("pet", "name")
        .populate("adopter", "name")
      console.log("Recent Applications:", recentApplications)
      const pendingUsers = await User.find({
        isApproved: false,
        role: { $in: ["seller", "veterinary"] },
      }).sort({ createdAt: -1 })
      console.log("Pending Users:", pendingUsers)
      const recentMessages = await Message.find()
        .sort({ createdAt: -1 })
        .limit(5)
      console.log("Recent Messages:", recentMessages)
      const unreadCount = await Message.countDocuments({ isRead: false })
      console.log("Unread Count:", unreadCount)

      userData.stats = stats
      userData.recentPets = recentPets
      userData.recentApplications = recentApplications
      userData.pendingUsers = pendingUsers
      userData.recentMessages = recentMessages
      userData.unreadCount = unreadCount
    } else if (req.user.role === "customer") {
      try {
        userData.applications = await AdoptionApplication.find({ adopter: req.user._id })
          .populate("pet", "name status mainImage")
          .sort({ createdAt: -1 })

        // Fetch customer orders and filter out invalid ones
        const customerOrders = await Order.find({ customer: req.user._id })
          .populate("items.product")
          .sort({ createdAt: -1 })
        userData.orders = customerOrders.filter(order => {
          if (!order.totalAmount) {
            console.warn(`Invalid order for customer ${req.user.email}: Order ID ${order._id} missing totalAmount`)
            return false
          }
          return true
        })

        userData.appointments = await Appointment.find({ customer: req.user._id })
          .populate("veterinary", "name")
          .sort({ date: 1 })

        if (req.user.favorites && req.user.favorites.length > 0) {
          userData.favorites = await Pet.find({ _id: { $in: req.user.favorites } })
        } else {
          userData.favorites = []
        }
      } catch (err) {
        console.error("Error loading customer dashboard data:", err)
        userData.applications = []
        userData.orders = []
        userData.appointments = []
        userData.favorites = []
        req.flash("warning", "Some dashboard data could not be loaded")
      }
    } else if (req.user.role === "seller") {
      try {
        userData.products = await Product.find({ seller: req.user._id }).sort({ createdAt: -1 })

        const productIds = userData.products.map((product) => product._id)
        // Fetch seller orders and filter out invalid ones
        const sellerOrders = await Order.find({ "items.product": { $in: productIds } })
          .populate("customer", "name")
          .populate("items.seller", "name sellerInfo.taxId")
          .populate("items.product")
          .sort({ createdAt: -1 })
        
        userData.orders = sellerOrders.filter(order => {
          if (!order.totalAmount) {
            console.warn(`Invalid order for seller ${req.user.email}: Order ID ${order._id} missing totalAmount`)
            return false
          }
          return true
        })

        userData.totalSales = userData.orders.reduce((total, order) => {
          return (
            total +
            order.items.reduce((itemTotal, item) => {
              if (productIds.some((id) => id.equals(item.product._id))) {
                return itemTotal + item.price * item.quantity;
              }
              return itemTotal;
            }, 0)
          );
        }, 0);

        userData.productsSold = userData.orders.reduce((total, order) => {
          return (
            total +
            order.items.reduce((itemTotal, item) => {
              if (productIds.some((id) => id.equals(item.product))) {
                return itemTotal + item.quantity
              }
              return itemTotal
            }, 0)
          )
        }, 0)

        userData.pendingOrders = userData.orders.filter(
          (order) => order.status === "placed" || order.status === "processing"
        ).length

        const reviews = await Review.find({ product: { $in: productIds } })
        if (reviews.length > 0) {
          userData.averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        } else {
          userData.averageRating = 0
        }
      } catch (err) {
        console.error("Error loading seller dashboard data:", err)
        userData.products = []
        userData.orders = []
        userData.totalSales = 0
        userData.productsSold = 0
        userData.pendingOrders = 0
        userData.averageRating = 0
        req.flash("warning", "Some dashboard data could not be loaded")
      }
    } else if (req.user.role === "veterinary") {
      try {
        userData.appointments = await Appointment.find({ veterinary: req.user._id })
          .populate("customer", "name")
          .sort({ date: 1, time: 1 })

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        userData.totalAppointments = await Appointment.countDocuments({ veterinary: req.user._id })
        userData.completedAppointments = await Appointment.countDocuments({
          veterinary: req.user._id,
          status: "completed",
        })
        userData.upcomingAppointments = await Appointment.countDocuments({
          veterinary: req.user._id,
          status: "scheduled",
          date: { $gte: today },
        })
        userData.cancelledAppointments = await Appointment.countDocuments({
          veterinary: req.user._id,
          status: "cancelled",
        })
      } catch (err) {
        console.error("Error loading veterinary dashboard data:", err)
        userData.appointments = []
        userData.totalAppointments = 0
        userData.completedAppointments = 0
        userData.upcomingAppointments = 0
        userData.cancelledAppointments = 0
        req.flash("warning", "Some dashboard data could not be loaded")
      }
    }

    res.render("pages/dashboard/index", {
      title: "Dashboard",
      currentPath: "/dashboard",
      currentUser: req.user,
      ...userData,
    })
  } catch (err) {
    console.error("Dashboard error:", err)
    req.flash("error", "Failed to load dashboard")
    res.redirect("/")
  }
})

// List all orders for customers
router.get("/orders", ensureAuthenticated, orderController.getUserOrders)

// List all orders for admins
router.get("/admin/orders", ensureAuthenticated, isAdmin, orderController.getAdminOrders)

// View order
router.get("/orders/:id", ensureAuthenticated, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name email phone address")
      .populate("items.product")
      .populate("items.seller", "name sellerInfo.taxId")

    if (!order) {
      req.flash("error", "Order not found")
      return res.redirect("/dashboard")
    }

    if (
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      order.customer._id.toString() !== req.user._id.toString() &&
      !order.items.some(
        (item) => item.seller && item.seller._id.toString() === req.user._id.toString()
      )
    ) {
      req.flash("error", "You are not authorized to view this order")
      return res.redirect("/dashboard")
    }

    res.render("pages/orders/show", {
      title: "Order Details",
      order,
      currentUser: req.user,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading the order")
    res.redirect("/dashboard")
  }
})

// Update order status
router.post("/orders/:id/status", ensureAuthenticated, async (req, res) => {
  try {
    const { status } = req.body
    const order = await Order.findById(req.params.id)

    if (!order) {
      req.flash("error", "Order not found")
      return res.redirect("/dashboard")
    }

    const isSellerOfAnyItem = order.items.some(
      (item) => item.seller && item.seller._id.toString() === req.user._id.toString()
    )

    if (
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      !isSellerOfAnyItem
    ) {
      req.flash("error", "You are not authorized to update this order")
      return res.redirect("/dashboard")
    }

    order.status = status
    await order.save()

    req.flash("success", "Order status updated")
    res.redirect(`/dashboard/orders/${order._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while updating the order")
    res.redirect("/dashboard")
  }
})

// Cancel order
router.post("/orders/:id/cancel", ensureAuthenticated, orderController.cancelOrder)

// Seller sales
router.get("/sales", ensureAuthenticated, isSeller, orderController.getSellerOrders)

// Seller order details
router.get("/sales/:id", ensureAuthenticated, isSeller, orderController.getSellerOrderDetails)

// Seller statistics
router.get("/statistics", ensureAuthenticated, isSeller, orderController.getSellerStatistics)

// View adoption application
router.get("/applications/:id", ensureAuthenticated, async (req, res) => {
  try {
    const application = await AdoptionApplication.findById(req.params.id)
      .populate("pet")
      .populate("shelter", "name email phone")
      .populate("adopter", "name email phone")

    if (!application) {
      req.flash("error", "Application not found")
      return res.redirect("/dashboard")
    }

    if (
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      application.adopter._id.toString() !== req.user._id.toString() &&
      application.shelter &&
      application.shelter._id.toString() !== req.user._id.toString()
    ) {
      req.flash("error", "You are not authorized to view this application")
      return res.redirect("/dashboard")
    }

    res.render("pages/applications/show", {
      title: "Adoption Application",
      application,
      currentUser: req.user,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading the application")
    res.redirect("/dashboard")
  }
})

// Update adoption application status
router.post("/applications/:id/status", ensureAuthenticated, async (req, res) => {
  try {
    const { status, denialReason } = req.body
    const application = await AdoptionApplication.findById(req.params.id)

    if (!application) {
      req.flash("error", "Application not found")
      return res.redirect("/dashboard")
    }

    if (
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      application.shelter &&
      application.shelter.toString() !== req.user._id.toString()
    ) {
      req.flash("error", "You are not authorized to update this application")
      return res.redirect("/dashboard")
    }

    application.status = status
    if (status === "denied" && denialReason) {
      application.denialReason = denialReason
    }
    await application.save()

    if (status === "approved") {
      await Pet.findByIdAndUpdate(application.pet, { status: "adopted" })
    } else if (status === "denied") {
      await Pet.findByIdAndUpdate(application.pet, { status: "available" })
    }

    req.flash("success", "Application status updated")
    res.redirect(`/dashboard/applications/${application._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while updating the application")
    res.redirect("/dashboard")
  }
})

// View appointment
router.get("/appointments/:id", ensureAuthenticated, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("customer", "name email phone")
      .populate("veterinary", "name email phone vetInfo")

    if (!appointment) {
      req.flash("error", "Appointment not found")
      return res.redirect("/dashboard")
    }

    if (
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      appointment.customer._id.toString() !== req.user._id.toString() &&
      appointment.veterinary._id.toString() !== req.user._id.toString()
    ) {
      req.flash("error", "You are not authorized to view this appointment")
      return res.redirect("/dashboard")
    }

    res.render("pages/appointments/show", {
      title: "Appointment Details",
      appointment,
      currentUser: req.user,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading the appointment")
    res.redirect("/dashboard")
  }
})

// Update appointment status
router.get("/appointments/:id/:action", ensureAuthenticated, async (req, res) => {
  try {
    const { id, action } = req.params
    const appointment = await Appointment.findById(id)

    if (!appointment) {
      req.flash("error", "Appointment not found")
      return res.redirect("/dashboard")
    }

    if (
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      appointment.veterinary.toString() !== req.user._id.toString() &&
      (action !== "cancel" || appointment.customer.toString() !== req.user._id.toString())
    ) {
      req.flash("error", "You are not authorized to update this appointment")
      return res.redirect("/dashboard")
    }

    if (action === "confirm") {
      appointment.status = "confirmed"
    } else if (action === "complete") {
      appointment.status = "completed"
    } else if (action === "cancel") {
      appointment.status = "cancelled"
    } else {
      req.flash("error", "Invalid action")
      return res.redirect(`/dashboard/appointments/${id}`)
    }

    await appointment.save()

    req.flash("success", `Appointment ${action}ed successfully`)
    res.redirect(`/dashboard/appointments/${id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while updating the appointment")
    res.redirect("/dashboard")
  }
})

module.exports = router