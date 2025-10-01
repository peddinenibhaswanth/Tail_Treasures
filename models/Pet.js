const mongoose = require("mongoose")

const PetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    species: {
      type: String,
      required: true,
      enum: ["dog", "cat", "bird", "rabbit", "hamster", "guinea pig", "fish", "reptile", "other"],
      lowercase: true,
    },
    breed: {
      type: String,
      trim: true,
    },
    age: {
      value: {
        type: Number,
        required: true,
      },
      unit: {
        type: String,
        enum: ["days", "weeks", "months", "years"],
        default: "years",
      },
    },
    size: {
      type: String,
      enum: ["small", "medium", "large", "extra large"],
      default: "medium",
    },
    gender: {
      type: String,
      enum: ["male", "female", "unknown"],
      default: "unknown",
    },
    color: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
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
    status: {
      type: String,
      enum: ["available", "pending", "adopted"],
      default: "available",
    },
    goodWith: {
      children: {
        type: Boolean,
        default: false,
      },
      dogs: {
        type: Boolean,
        default: false,
      },
      cats: {
        type: Boolean,
        default: false,
      },
      otherAnimals: {
        type: Boolean,
        default: false,
      },
    },
    healthInfo: {
      vaccinated: {
        type: Boolean,
        default: false,
      },
      neutered: {
        type: Boolean,
        default: false,
      },
      microchipped: {
        type: Boolean,
        default: false,
      },
      specialNeeds: {
        type: Boolean,
        default: false,
      },
      specialNeedsDescription: {
        type: String,
      },
    },
    behavior: {
      energyLevel: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      trainingLevel: {
        type: String,
        enum: ["none", "basic", "well trained"],
        default: "none",
      },
      socialness: {
        type: String,
        enum: ["shy", "moderate", "social"],
        default: "moderate",
      },
    },
    adoptionFee: {
      type: Number,
      default: 0,
    },
    shelter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Create index for search
PetSchema.index({
  name: "text",
  breed: "text",
  description: "text",
  species: "text",
  color: "text",
})

module.exports = mongoose.model("Pet", PetSchema)
