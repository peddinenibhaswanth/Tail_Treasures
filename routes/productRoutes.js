const express = require("express")
const router = express.Router()
const { ensureAuthenticated, isAdmin, isSeller, isAdminCoAdminOrSeller } = require("../middleware/auth")
const Product = require("../models/Product")
const Review = require("../models/Review")
const { productUpload } = require("../middleware/upload")
const fs = require("fs")
const path = require("path")

// Get all products
router.get("/", async (req, res) => {
  try {
    const { category, petType, minPrice, maxPrice, sort } = req.query
    const filter = {}

    // Apply filters
    if (category) filter.category = category
    if (petType) filter.petType = petType
    if (minPrice) filter.price = { $gte: Number.parseFloat(minPrice) }
    if (maxPrice) {
      if (filter.price) {
        filter.price.$lte = Number.parseFloat(maxPrice)
      } else {
        filter.price = { $lte: Number.parseFloat(maxPrice) }
      }
    }

    // Pagination
    const page = Number.parseInt(req.query.page) || 1
    const limit = 12
    const skip = (page - 1) * limit

    // Sorting
    let sortOption = { createdAt: -1 } // Default: newest first
    if (sort === "price-asc") sortOption = { price: 1 }
    if (sort === "price-desc") sortOption = { price: -1 }
    if (sort === "name-asc") sortOption = { name: 1 }
    if (sort === "name-desc") sortOption = { name: -1 }

    // Get products
    const products = await Product.find(filter).populate("seller", "name").sort(sortOption).skip(skip).limit(limit)

    // Get total count for pagination
    const total = await Product.countDocuments(filter)
    const pages = Math.ceil(total / limit)

    // Get categories and pet types for filter sidebar
    const categories = await Product.distinct("category")
    const petTypes = await Product.distinct("petType")

    res.render("pages/products/index", {
      title: "Pet Products",
      products,
      current: page,
      pages,
      filter: req.query,
      categories,
      petTypes,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading products")
    res.redirect("/")
  }
})

// Search products
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query

    if (!query) {
      return res.redirect("/products")
    }

    // Search products
    const products = await Product.find({ $text: { $search: query } }, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } })
      .populate("seller", "name")

    res.render("pages/products/search", {
      title: "Search Results",
      products,
      query,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while searching for products")
    res.redirect("/products")
  }
})

// Get product create form
router.get("/new", ensureAuthenticated, isAdminCoAdminOrSeller, (req, res) => {
  res.render("pages/products/new", {
    title: "Add New Product",
    product: {},
    currentUser: req.user,
  })
})

// Create new product
router.post("/", ensureAuthenticated, isAdminCoAdminOrSeller, productUpload.array("images", 5), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      salePrice,
      onSale,
      category,
      petType,
      brand,
      stock,
      weight,
      dimensions,
      featured,
      freeShipping,
    } = req.body

    // Create new product
    const newProduct = new Product({
      name,
      description,
      price: Number.parseFloat(price),
      salePrice: salePrice ? Number.parseFloat(salePrice) : 0,
      onSale: onSale === "on",
      category,
      petType,
      brand,
      stock: Number.parseInt(stock),
      weight,
      dimensions,
      featured: featured === "on",
      freeShipping: freeShipping === "on",
      seller: req.user._id,
    })

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      newProduct.images = req.files.map((file) => `/uploads/products/${file.filename}`)
      newProduct.mainImage = `/uploads/products/${req.files[0].filename}`
    }

    await newProduct.save()

    req.flash("success", "Product added successfully")
    res.redirect(`/products/${newProduct._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while adding the product")
    res.redirect("/products/new")
  }
})

// Get product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("seller", "name")

    if (!product) {
      req.flash("error", "Product not found")
      return res.redirect("/products")
    }

    // Get reviews
    const reviews = await Review.find({ product: product._id }).populate("customer", "name profileImage")

    // Calculate average rating
    let averageRating = 0
    if (reviews.length > 0) {
      averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    }

    // Get related products
    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      $or: [{ category: product.category }, { petType: product.petType }],
    }).limit(4)

    res.render("pages/products/show", {
      title: product.name,
      product,
      reviews,
      averageRating,
      relatedProducts,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading product details")
    res.redirect("/products")
  }
})

// Get product edit form
router.get("/:id/edit", ensureAuthenticated, isAdminCoAdminOrSeller, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      req.flash("error", "Product not found")
      return res.redirect("/products")
    }

    // Check if user is authorized to edit this product
    if (
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      req.flash("error", "You are not authorized to edit this product")
      return res.redirect("/products")
    }

    res.render("pages/products/edit", {
      title: `Edit ${product.name}`,
      product,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading product details")
    res.redirect("/products")
  }
})

// Update product
router.put("/:id", ensureAuthenticated, isAdminCoAdminOrSeller, productUpload.array("images", 10), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      salePrice,
      onSale,
      category,
      petType,
      brand,
      stock,
      weight,
      dimensions,
      featured,
      freeShipping,
    } = req.body

    const product = await Product.findById(req.params.id)

    if (!product) {
      req.flash("error", "Product not found")
      return res.redirect("/products")
    }

    // Check if user is authorized to edit this product
    if (
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      req.flash("error", "You are not authorized to edit this product")
      return res.redirect("/products")
    }

    // Update product
    product.name = name
    product.description = description
    product.price = Number.parseFloat(price)
    product.salePrice = salePrice ? Number.parseFloat(salePrice) : 0
    product.onSale = onSale === "on"
    product.category = category
    product.petType = petType
    product.brand = brand
    product.stock = Number.parseInt(stock)
    product.weight = weight
    product.dimensions = dimensions
    product.featured = featured === "on"
    product.freeShipping = freeShipping === "on"

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      // Add new images
      const newImages = req.files.map((file) => `/uploads/products/${file.filename}`)
      product.images = [...product.images, ...newImages]

      // Set main image if none exists
      if (!product.mainImage) {
        product.mainImage = `/uploads/products/${req.files[0].filename}`
      }
    }

    await product.save()

    req.flash("success", "Product updated successfully")
    res.redirect(`/products/${product._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while updating the product")
    res.redirect(`/products/${req.params.id}/edit`)
  }
})

// Delete product
router.delete("/:id", ensureAuthenticated, isAdminCoAdminOrSeller, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      req.flash("error", "Product not found")
      return res.redirect("/products")
    }

    // Check if user is authorized to delete this product
    if (
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      req.flash("error", "You are not authorized to delete this product")
      return res.redirect("/products")
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

    // Delete product
    await Product.findByIdAndDelete(product._id)

    req.flash("success", "Product deleted successfully")

    // Redirect based on where the request came from
    if (req.headers.referer && req.headers.referer.includes("/admin/products")) {
      return res.redirect("/admin/products")
    }
    return res.redirect("/dashboard")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while deleting the product")
    res.redirect("/products")
  }
})

// Add review
router.post("/:id/reviews", ensureAuthenticated, async (req, res) => {
  try {
    const { rating, comment } = req.body
    const product = await Product.findById(req.params.id)

    if (!product) {
      req.flash("error", "Product not found")
      return res.redirect("/products")
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      product: product._id,
      customer: req.user._id,
    })

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating
      existingReview.comment = comment
      await existingReview.save()
      req.flash("success", "Your review has been updated")
    } else {
      // Create new review
      const newReview = new Review({
        product: product._id,
        customer: req.user._id,
        rating,
        comment,
      })
      await newReview.save()
      req.flash("success", "Your review has been added")
    }

    res.redirect(`/products/${product._id}`)
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while submitting your review")
    res.redirect(`/products/${req.params.id}`)
  }
})

module.exports = router
