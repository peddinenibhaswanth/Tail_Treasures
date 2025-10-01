const Order = require("../models/Order")
const Product = require("../models/Product")
const Cart = require("../models/Cart")
const User = require("../models/User")

// Get all orders for a user
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .populate("items.product")
      .populate("items.seller", "name sellerInfo.taxId")

    // console.log('User orders:', orders);

    res.render("pages/orders/index", {
      title: "My Orders",
      orders,
    })
  } catch (err) {
    console.error('Error fetching user orders:', err)
    req.flash("error", "An error occurred while fetching your orders")
    res.redirect("/dashboard")
  }
}

// Get order details
exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product")
      .populate("items.seller", "name email sellerInfo.taxId")
      .populate("customer", "name email phone")

    if (!order) {
      req.flash("error", "Order not found")
      return res.redirect("/dashboard/orders")
    }

    // Check if user is authorized to view this order
    const isSellerInOrder = order.items.some(
      (item) => item.seller && item.seller._id.toString() === req.user._id.toString()
    )
    if (
      order.customer._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      !isSellerInOrder
    ) {
      req.flash("error", "You are not authorized to view this order")
      return res.redirect("/dashboard/orders")
    }

    // console.log('Order details:', order);

    res.render("pages/orders/show", {
      title: `Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order,
    })
  } catch (err) {
    console.error('Error fetching order details:', err)
    req.flash("error", "An error occurred while fetching order details")
    res.redirect("/dashboard/orders")
  }
}

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body
    const order = await Order.findById(req.params.id)

    if (!order) {
      req.flash("error", "Order not found")
      return res.redirect("/dashboard/orders")
    }

    // Check if user is authorized to update this order
    const isSellerInOrder = order.items.some(
      (item) => item.seller && item.seller.toString() === req.user._id.toString()
    )
    if (
      req.user.role !== "admin" &&
      req.user.role !== "co-admin" &&
      !isSellerInOrder
    ) {
      req.flash("error", "You are not authorized to update this order")
      return res.redirect("/dashboard/orders")
    }

    // Validate status
    const validStatuses = ["placed", "processing", "shipped", "delivered", "cancelled"]
    if (!validStatuses.includes(status)) {
      req.flash("error", "Invalid order status")
      return res.redirect(`/dashboard/orders/${order._id}`)
    }

    // If order is cancelled, restore product stock
    if (status === "cancelled" && order.status !== "cancelled") {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity },
        })
      }
      order.paymentStatus = "refunded"
    }

    // Update order status
    order.status = status
    await order.save()

    // console.log('Updated order status:', { orderId: order._id, status });

    req.flash("success", "Order status updated successfully")
    res.redirect(`/dashboard/orders/${order._id}`)
  } catch (err) {
    console.error('Error updating order status:', err)
    req.flash("error", "An error occurred while updating order status")
    res.redirect("/dashboard/orders")
  }
}

// Process checkout
exports.processCheckout = async (req, res) => {
  try {
    // Check if cart exists and has items
    let cart
    if (req.isAuthenticated()) {
      cart = await Cart.findOne({ customer: req.user._id }).populate("items.product")
      if (!cart || cart.items.length === 0) {
        req.flash("error", "Your cart is empty")
        return res.redirect("/cart")
      }
    } else {
      if (!req.session.cart || req.session.cart.items.length === 0) {
        req.flash("error", "Your cart is empty")
        return res.redirect("/cart")
      }
      cart = req.session.cart
    }

    const { name, email, phone, street, city, state, zipCode, country, paymentMethod, notes } = req.body

    // Validate input
    const errors = []
    if (!name || !email || !street || !city || !state || !zipCode || !country || !phone) {
      errors.push("All shipping address fields and phone are required")
    }
    if (!paymentMethod || !["credit_card", "paypal", "bank_transfer"].includes(paymentMethod)) {
      errors.push("Valid payment method is required")
    }
    if (errors.length > 0) {
      req.flash("error", errors.join("; "))
      return res.redirect("/checkout")
    }

    // Create new order
    const newOrder = new Order({
      customer: req.isAuthenticated() ? req.user._id : null,
      items: [],
      subtotal: 0,
      tax: 0,
      shipping: 0,
      discount: cart.discount || 0,
      totalAmount: 0,
      shippingAddress: {
        name,
        street,
        city,
        state,
        zipCode,
        country,
        phone,
      },
      status: "placed",
      paymentMethod,
      paymentStatus: "completed", // Simplified: assume immediate payment
      notes: notes || "",
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    })

    // Add items to order and update product stock
    let subtotal = 0
    const items = req.isAuthenticated() ? cart.items : cart.items
    for (const item of items) {
      const product = req.isAuthenticated()
        ? item.product
        : await Product.findById(item.product)

      if (!product) {
        continue // Skip if product not found
      }

      // Check if enough stock
      if (product.stock < item.quantity) {
        req.flash("error", `Not enough stock for ${product.name}. Only ${product.stock} available.`)
        return res.redirect("/cart")
      }

      // Add item to order
      newOrder.items.push({
        product: product._id,
        quantity: item.quantity,
        price: item.price,
        name: product.name,
        image: product.mainImage,
        seller: product.seller,
      })

      // Update subtotal
      subtotal += item.price * item.quantity

      // Update product stock
      product.stock -= item.quantity
      await product.save()
    }

    // Calculate totals
    newOrder.subtotal = subtotal
    newOrder.shipping = subtotal >= 50 ? 0 : 5.99
    newOrder.tax = Number((subtotal * 0.085).toFixed(2))
    newOrder.totalAmount = Number((subtotal + newOrder.shipping + newOrder.tax - newOrder.discount).toFixed(2))

    // Save order
    await newOrder.save()
    // console.log('New order created:', newOrder);

    // Clear cart
    if (req.isAuthenticated()) {
      await Cart.findOneAndUpdate(
        { customer: req.user._id },
        { $set: { items: [], subtotal: 0, tax: 0, shipping: 0, total: 0, discount: 0 } }
      )
    } else {
      req.session.cart = {
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
        discount: 0,
      }
      req.session.save()
    }

    req.flash("success", "Order placed successfully! Payment completed.")
    res.redirect(`/orders/success/${newOrder._id}`)
  } catch (err) {
    console.error('Error processing checkout:', err)
    req.flash("error", "An error occurred while processing your order")
    res.redirect("/checkout")
  }
}

// Order success page
exports.getOrderSuccess = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product")
      .populate("items.seller", "name sellerInfo.taxId")
      .populate("customer", "name email phone")

    if (!order) {
      req.flash("error", "Order not found")
      return res.redirect("/dashboard/orders")
    }

    // Check if user is authorized to view this order
    if (
      order.customer &&
      order.customer._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "co-admin"
    ) {
      req.flash("error", "You are not authorized to view this order")
      return res.redirect("/dashboard/orders")
    }

    // console.log('Order success details:', order);

    res.render("pages/checkout/success", {
      title: "Order Successful",
      order,
    })
  } catch (err) {
    console.error('Error loading order success page:', err)
    req.flash("error", "An error occurred while loading the order details")
    res.redirect("/dashboard")
  }
}

// Cancel order
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      req.flash("error", "Order not found")
      return res.redirect("/dashboard/orders")
    }

    // Check if user is authorized to cancel this order
    if (
      order.customer &&
      order.customer.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "co-admin"
    ) {
      req.flash("error", "You are not authorized to cancel this order")
      return res.redirect("/dashboard/orders")
    }

    // Only allow cancellation if order is not shipped or delivered
    if (order.status === "shipped" || order.status === "delivered") {
      req.flash("error", "Cannot cancel an order that has been shipped or delivered")
      return res.redirect(`/dashboard/orders/${order._id}`)
    }

    // Update order status
    order.status = "cancelled"
    order.paymentStatus = "refunded"

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      })
    }

    await order.save()
    // console.log('Order cancelled:', order);

    req.flash("success", "Order cancelled successfully")
    res.redirect(`/dashboard/orders/${order._id}`)
  } catch (err) {
    console.error('Error cancelling order:', err)
    req.flash("error", "An error occurred while cancelling the order")
    res.redirect("/dashboard/orders")
  }
}

// Get seller orders
exports.getSellerOrders = async (req, res) => {
  try {
    // Find orders where this seller has products
    const orders = await Order.find({ "items.seller": req.user._id })
      .sort({ createdAt: -1 })
      .populate("items.product")
      .populate("customer", "name email")

    // Filter items in each order to only show this seller's items
    const sellerOrders = orders.map((order) => {
      const sellerItems = order.items.filter(
        (item) => item.seller && item.seller.toString() === req.user._id.toString()
      )

      // Calculate seller's portion of the order
      const sellerTotal = sellerItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      )

      return {
        _id: order._id,
        customer: order.customer,
        items: sellerItems,
        totalAmount: sellerTotal,
        status: order.status,
        createdAt: order.createdAt,
        shippingAddress: order.shippingAddress,
      }
    })

    // console.log('Seller orders:', sellerOrders);

    res.render("pages/orders/seller-orders", {
      title: "My Sales",
      orders: sellerOrders,
    })
  } catch (err) {
    console.error('Error fetching seller orders:', err)
    req.flash("error", "An error occurred while fetching your sales")
    res.redirect("/dashboard")
  }
}

// Get seller order details
exports.getSellerOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product")
      .populate("customer", "name email phone")

    if (!order) {
      req.flash("error", "Order not found")
      return res.redirect("/dashboard/sales")
    }

    // Check if seller has items in this order
    const sellerItems = order.items.filter(
      (item) => item.seller && item.seller.toString() === req.user._id.toString()
    )

    if (sellerItems.length === 0 && req.user.role !== "admin" && req.user.role !== "co-admin") {
      req.flash("error", "You don't have any items in this order")
      return res.redirect("/dashboard/sales")
    }

    // Calculate seller's portion of the order
    const sellerTotal = sellerItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    )

    // console.log('Seller order details:', { orderId: order._id, sellerItems });

    res.render("pages/orders/seller-order-detail", {
      title: `Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order,
      sellerItems,
      sellerTotal,
    })
  } catch (err) {
    console.error('Error fetching seller order details:', err)
    req.flash("error", "An error occurred while fetching order details")
    res.redirect("/dashboard/sales")
  }
}

// Get seller statistics
exports.getSellerStatistics = async (req, res) => {
  try {
    // Find all orders with this seller's products
    const orders = await Order.find({
      "items.seller": req.user._id,
      status: { $ne: "cancelled" },
    })

    // Calculate total sales
    let totalSales = 0
    let totalItems = 0
    const productsSold = {}

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.seller && item.seller.toString() === req.user._id.toString()) {
          totalSales += item.price * item.quantity
          totalItems += item.quantity

          // Count products sold
          if (productsSold[item.product]) {
            productsSold[item.product] += item.quantity
          } else {
            productsSold[item.product] = item.quantity
          }
        }
      })
    })

    // Get top selling products
    const productIds = Object.keys(productsSold)
    const products = await Product.find({
      _id: { $in: productIds },
      seller: req.user._id,
    })

    const topProducts = products
      .map((product) => ({
        _id: product._id,
        name: product.name,
        image: product.mainImage,
        sold: productsSold[product._id.toString()],
        revenue: productsSold[product._id.toString()] * (product.onSale ? product.salePrice : product.price),
      }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5)

    // Get monthly sales data (last 6 months)
    const monthlySales = await getMonthlySellerSales(req.user._id)

    // Get current inventory stats
    const inventory = await Product.find({ seller: req.user._id })
    const inStock = inventory.filter((p) => p.stock > 0).length
    const outOfStock = inventory.filter((p) => p.stock === 0).length
    const lowStock = inventory.filter((p) => p.stock > 0 && p.stock <= 5).length

    // Get recent orders
    const recentOrders = await Order.find({
      "items.seller": req.user._id,
      status: { $ne: "cancelled" },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("customer", "name")

    const stats = {
      totalSales,
      totalItems,
      totalOrders: orders.length,
      topProducts,
      monthlySales,
      inventory: {
        total: inventory.length,
        inStock,
        outOfStock,
        lowStock,
      },
      recentOrders,
    }

    // console.log('Seller statistics:', stats);

    res.render("pages/dashboard/seller-statistics", {
      title: "Sales Statistics",
      stats,
    })
  } catch (err) {
    console.error('Error loading seller statistics:', err)
    req.flash("error", "An error occurred while loading statistics")
    res.redirect("/dashboard")
  }
}

// Get all orders for admin
exports.getAdminOrders = async (req, res) => {
  try {
    // Check if user is admin or co-admin
    if (req.user.role !== "admin" && req.user.role !== "co-admin") {
      req.flash("error", "You are not authorized to view all orders")
      return res.redirect("/dashboard")
    }

    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .populate("items.product")
      .populate("items.seller", "name sellerInfo.taxId")
      .populate("customer", "name email")

    // console.log('Admin orders:', orders);

    res.render("pages/orders/admin-orders", {
      title: "All Orders",
      orders,
    })
  } catch (err) {
    console.error('Error fetching admin orders:', err)
    req.flash("error", "An error occurred while fetching orders")
    res.redirect("/dashboard")
  }
}

// Helper function to get monthly sales data for a seller
async function getMonthlySellerSales(sellerId) {
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

    // Find orders in this month with this seller's products
    const orders = await Order.find({
      "items.seller": sellerId,
      status: { $ne: "cancelled" },
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    })

    // Calculate total sales for this month
    let monthlySales = 0
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.seller && item.seller.toString() === sellerId.toString()) {
          monthlySales += item.price * item.quantity
        }
      })
    })

    data.push(monthlySales)
  }

  return { labels: months, data }
}