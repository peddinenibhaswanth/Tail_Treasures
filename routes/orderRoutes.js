const express = require("express")
const router = express.Router()
const { ensureAuthenticated, isSeller } = require("../middleware/auth")
const orderController = require("../controllers/orderController")
const Product = require("../models/Product")
const Order = require("../models/Order")
const Cart = require("../models/Cart")

// Order success page
router.get("/success/:id", ensureAuthenticated, orderController.getOrderSuccess)

// Process checkout
router.post("/checkout", ensureAuthenticated, orderController.processCheckout)

// Get all orders for a user
router.get("/", ensureAuthenticated, orderController.getUserOrders)

// Get order details
router.get("/:id", ensureAuthenticated, orderController.getOrderDetails)

// Cancel order
router.post("/:id/cancel", ensureAuthenticated, orderController.cancelOrder)

// Update order status
router.post("/:id/status", ensureAuthenticated, orderController.updateOrderStatus)

// Get seller orders
router.get("/seller/sales", ensureAuthenticated, isSeller, orderController.getSellerOrders)

// Get seller order details
router.get("/seller/:id", ensureAuthenticated, isSeller, orderController.getSellerOrderDetails)

// Get seller statistics
router.get("/seller/statistics", ensureAuthenticated, isSeller, orderController.getSellerStatistics)

// Cart page
router.get("/cart", (req, res) => {
  // Get cart from session
  const cart = req.session.cart || { items: [], subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 }

  res.render("pages/cart/index", {
    title: "Shopping Cart",
    cart,
  })
})

// Add to cart
router.post("/cart/add", ensureAuthenticated, async (req, res) => {
  try {
    const { productId, quantity } = req.body
    const quantityNum = Number.parseInt(quantity) || 1

    // Get product
    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" })
    }

    // Check if product is in stock
    if (product.stock < quantityNum) {
      return res.status(400).json({ success: false, message: "Not enough stock available" })
    }

    // Initialize cart if it doesn't exist
    if (!req.session.cart) {
      req.session.cart = {
        items: [],
        subtotal: 0,
        discount: 0,
        shipping: 0,
        tax: 0,
        total: 0,
      }
    }

    // Check if product is already in cart
    const existingItemIndex = req.session.cart.items.findIndex((item) => item.product._id.toString() === productId)

    if (existingItemIndex > -1) {
      // Update quantity
      req.session.cart.items[existingItemIndex].quantity += quantityNum
    } else {
      // Add new item
      req.session.cart.items.push({
        product,
        quantity: quantityNum,
      })
    }

    // Calculate cart totals
    calculateCartTotals(req.session.cart)

    // Save cart to session
    req.session.save()

    // Return success
    return res.status(200).json({
      success: true,
      message: "Product added to cart",
      cartCount: req.session.cart.items.length,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ success: false, message: "Server error" })
  }
})

// Update cart item
router.post("/cart/update", ensureAuthenticated, async (req, res) => {
  try {
    const { productId, quantity } = req.body
    const quantityNum = Number.parseInt(quantity) || 1

    // Check if cart exists
    if (!req.session.cart) {
      req.flash("error", "Your cart is empty")
      return res.redirect("/cart")
    }

    // Find item in cart
    const itemIndex = req.session.cart.items.findIndex((item) => item.product._id.toString() === productId)

    if (itemIndex === -1) {
      req.flash("error", "Product not found in cart")
      return res.redirect("/cart")
    }

    // Update quantity
    req.session.cart.items[itemIndex].quantity = quantityNum

    // Calculate cart totals
    calculateCartTotals(req.session.cart)

    // Save cart to session
    req.session.save()

    req.flash("success", "Cart updated")
    res.redirect("/cart")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while updating your cart")
    res.redirect("/cart")
  }
})

// Remove from cart
router.post("/cart/remove", ensureAuthenticated, (req, res) => {
  try {
    const { productId } = req.body

    // Check if cart exists
    if (!req.session.cart) {
      req.flash("error", "Your cart is empty")
      return res.redirect("/cart")
    }

    // Remove item from cart
    req.session.cart.items = req.session.cart.items.filter((item) => item.product._id.toString() !== productId)

    // Calculate cart totals
    calculateCartTotals(req.session.cart)

    // Save cart to session
    req.session.save()

    req.flash("success", "Item removed from cart")
    res.redirect("/cart")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while removing the item from your cart")
    res.redirect("/cart")
  }
})

// Clear cart
router.post("/cart/clear", ensureAuthenticated, (req, res) => {
  // Clear cart
  req.session.cart = {
    items: [],
    subtotal: 0,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: 0,
  }

  // Save session
  req.session.save()

  req.flash("success", "Cart cleared")
  res.redirect("/cart")
})

// Apply promo code
router.post("/cart/apply-promo", ensureAuthenticated, (req, res) => {
  try {
    const { promoCode } = req.body

    // Check if cart exists
    if (!req.session.cart) {
      req.flash("error", "Your cart is empty")
      return res.redirect("/cart")
    }

    // Simple promo code logic (in a real app, you'd check against a database)
    if (promoCode === "WELCOME10") {
      // 10% discount
      req.session.cart.discount = req.session.cart.subtotal * 0.1
      calculateCartTotals(req.session.cart)
      req.session.save()
      req.flash("success", "Promo code applied: 10% discount")
    } else if (promoCode === "FREESHIP") {
      // Free shipping
      req.session.cart.shipping = 0
      calculateCartTotals(req.session.cart)
      req.session.save()
      req.flash("success", "Promo code applied: Free shipping")
    } else {
      req.flash("error", "Invalid promo code")
    }

    res.redirect("/cart")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while applying the promo code")
    res.redirect("/cart")
  }
})

// Checkout page
router.get("/checkout", ensureAuthenticated, (req, res) => {
  // Check if cart exists and has items
  if (!req.session.cart || req.session.cart.items.length === 0) {
    req.flash("error", "Your cart is empty")
    return res.redirect("/cart")
  }

  res.render("pages/checkout/index", {
    title: "Checkout",
    cart: req.session.cart,
  })
})

// Helper function to calculate cart totals
function calculateCartTotals(cart) {
  // Calculate subtotal
  cart.subtotal = cart.items.reduce((total, item) => {
    const price = item.product.onSale ? item.product.salePrice : item.product.price
    return total + price * item.quantity
  }, 0)

  // Calculate shipping (free for orders over $50)
  cart.shipping = cart.subtotal >= 50 ? 0 : 5.99

  // Apply discount (if any)
  if (!cart.discount) {
    cart.discount = 0
  }

  // Calculate tax (8%)
  cart.tax = (cart.subtotal - cart.discount) * 0.08

  // Calculate total
  cart.total = cart.subtotal - cart.discount + cart.shipping + cart.tax
}

module.exports = router
