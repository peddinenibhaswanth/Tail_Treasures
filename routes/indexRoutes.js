const express = require("express")
const router = express.Router()
const Pet = require("../models/Pet")
const Product = require("../models/Product")
const { ensureAuthenticated } = require("../middleware/auth")

// Home page
router.get("/", async (req, res) => {
  try {
    // Get featured pets (limit to 4)
    const featuredPets = await Pet.find({ status: "available" })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("shelter", "name")

    // Get featured products (limit to 4)
    const featuredProducts = await Product.find({ featured: true }).limit(4).populate("seller", "name")

    res.render("pages/index", {
      title: "Pet Adoption Platform",
      featuredPets,
      featuredProducts,
    })
  } catch (err) {
    console.error(err)
    res.render("pages/index", {
      title: "Pet Adoption Platform",
      featuredPets: [],
      featuredProducts: [],
    })
  }
})

// About page
router.get("/about", (req, res) => {
  res.render("pages/about", {
    title: "About Us",
  })
})

// Contact page
router.get("/contact", (req, res) => {
  res.render("pages/contact", {
    title: "Contact Us",
  })
})

// Contact form submission
router.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body

    // Create new message
    const Message = require("../models/Message")
    const newMessage = new Message({
      name,
      email,
      subject,
      message,
    })

    await newMessage.save()

    req.flash("success", "Your message has been sent. We'll get back to you soon!")
    res.redirect("/contact")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while sending your message")
    res.redirect("/contact")
  }
})

module.exports = router
