const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["customer", "seller", "veterinary", "admin", "co-admin"],
      default: "customer",
    },
    phone: {
      type: String,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    profileImage: {
      type: String,
      default: "/images/default-profile.jpg",
    },
    isApproved: {
      type: Boolean,
      default: function () {
        return this.role === "customer" || this.role === "admin" || this.role === "co-admin"
      },
    },
    sellerInfo: {
      businessName: String,
      description: String,
      website: String,
      businessAddress: String,
      taxId: String,
      yearsInBusiness: Number,
      productCategories: [String],
    },
    vetInfo: {
      licenseNumber: String,
      specialization: String,
      experience: Number,
      education: String,
      bio: String,
      clinicName: String,
      clinicAddress: String,
      certifications: [String],
      availableDays: [String],
      availableHours: {
        start: String,
        end: String,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pet",
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (err) {
    next(err)
  }
})

// Method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

module.exports = mongoose.model("User", UserSchema)
