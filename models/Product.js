const mongoose = require("mongoose")

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      enum: ["food", "toys", "accessories", "health", "grooming", "bedding", "clothing", "other"],
      required: true,
    },
    petType: {
      type: String,
      enum: ["dog", "cat", "bird", "rabbit", "hamster", "guinea pig", "fish", "reptile", "other", "all"],
      required: true,
    },
    images: [
      {
        type: String,
      },
    ],
    mainImage: {
      type: String,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    onSale: {
      type: Boolean,
      default: false,
    },
    salePrice: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
)

// Create index for search
ProductSchema.index({
  name: "text",
  description: "text",
  category: "text",
})

module.exports = mongoose.model("Product", ProductSchema)
