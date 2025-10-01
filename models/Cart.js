const mongoose = require("mongoose")

const CartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
  },
})

const CartSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [CartItemSchema],
    subtotal: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    shipping: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

// Calculate cart totals
CartSchema.methods.calculateTotals = function () {
  // Calculate subtotal
  this.subtotal = this.items.reduce((total, item) => {
    return total + item.price * item.quantity
  }, 0)

  // Calculate shipping (free if subtotal >= 50)
  this.shipping = this.subtotal >= 50 ? 0 : 5.99

  // Calculate tax (8.5%)
  this.tax = Number.parseFloat((this.subtotal * 0.085).toFixed(2))

  // Calculate total
  this.total = Number.parseFloat((this.subtotal + this.shipping + this.tax).toFixed(2))

  return this
}

module.exports = mongoose.model("Cart", CartSchema)
