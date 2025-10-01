const express = require("express")
const mongoose = require("mongoose")
const path = require("path")
const session = require("express-session")
const flash = require("connect-flash")
const passport = require("passport")
const methodOverride = require("method-override")
const dotenv = require("dotenv")
const expressLayouts = require("express-ejs-layouts")

// Load environment variables
dotenv.config()

// Import routes
const indexRoutes = require("./routes/indexRoutes")
const authRoutes = require("./routes/authRoutes")
const petRoutes = require("./routes/petRoutes")
const productRoutes = require("./routes/productRoutes")
const appointmentRoutes = require("./routes/appointmentRoutes")
const orderRoutes = require("./routes/orderRoutes")
const adminRoutes = require("./routes/adminRoutes")
const dashboardRoutes = require("./routes/dashboardRoutes")
const cartRoutes = require("./routes/cartRoutes")
const checkoutRoutes = require('./routes/checkout');

// Passport config
require("./config/passport")(passport)

// Initialize app
const app = express()

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Connection Error: " + err))

// EJS setup
app.use(expressLayouts)
app.set("layout", "layouts/main")
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))

// Middleware
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(methodOverride("_method"))
app.use(express.static(path.join(__dirname, "public")))

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
  }),
)

// Passport middleware
app.use(passport.initialize())
app.use(passport.session())

// Flash messages
app.use(flash())

// Global variables
app.use((req, res, next) => {
  res.locals.currentUser = req.user
  res.locals.success = req.flash("success")
  res.locals.error = req.flash("error")
  res.locals.warning = req.flash("warning")
  res.locals.currentPath = req.path
  next()
})

// Routes
app.use("/", indexRoutes)
app.use("/auth", authRoutes)
app.use("/pets", petRoutes)
app.use("/products", productRoutes)
app.use("/appointments", appointmentRoutes)
app.use("/orders", orderRoutes)
app.use("/admin", adminRoutes)
app.use("/dashboard", dashboardRoutes)

app.use('/cart', require('./routes/cartRoutes'));
app.use('/checkout', require('./routes/checkout'));
// Error handling
app.use((req, res) => {
  res.status(404).render("pages/error", {
    title: "404 Not Found",
    message: "The page you are looking for does not exist.",
  })
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).render("pages/error", {
    title: "Server Error",
    message: "Something went wrong on our end.",
  })
})

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
