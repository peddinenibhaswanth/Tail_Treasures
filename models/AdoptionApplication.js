const mongoose = require("mongoose")

const AdoptionApplicationSchema = new mongoose.Schema(
  {
    adopter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },
    shelter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["submitted", "under review", "approved", "denied"],
      default: "submitted",
    },
    homeType: {
      type: String,
      enum: ["house", "apartment", "condo", "other"],
      required: true,
    },
    hasYard: {
      type: Boolean,
      default: false,
    },
    hasChildren: {
      type: Boolean,
      default: false,
    },
    childrenAges: {
      type: String,
    },
    hasOtherPets: {
      type: Boolean,
      default: false,
    },
    otherPetsDescription: {
      type: String,
    },
    workSchedule: {
      type: String,
      required: true,
    },
    experience: {
      type: String,
      required: true,
    },
    reasonForAdopting: {
      type: String,
      required: true,
    },
    additionalInfo: {
      type: String,
    },
    denialReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("AdoptionApplication", AdoptionApplicationSchema)
