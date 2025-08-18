import mongoose from "mongoose";

const vasCatalogSchema = new mongoose.Schema(
  {
    vas_id: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    monthly_fee: {
      type: Number,
      required: true,
      min: 0,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["entertainment", "communication", "utility", "news", "lifestyle"],
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
vasCatalogSchema.index({ vas_id: 1 }, { unique: true });
vasCatalogSchema.index({ category: 1, is_active: 1 });

// Instance methods
vasCatalogSchema.methods.calculateYearlyCost = function () {
  return this.monthly_fee * 12;
};

vasCatalogSchema.methods.isExpensive = function (threshold = 15) {
  return this.monthly_fee > threshold;
};

// Static methods
vasCatalogSchema.statics.findActiveServices = function () {
  return this.find({ is_active: true }).sort({ category: 1, monthly_fee: 1 });
};

vasCatalogSchema.statics.findByCategory = function (category) {
  return this.find({ category, is_active: true }).sort({ monthly_fee: 1 });
};

vasCatalogSchema.statics.findByVasIds = function (vasIds) {
  return this.find({ vas_id: { $in: vasIds }, is_active: true });
};

vasCatalogSchema.statics.findCheapAlternatives = function (
  currentVasId,
  maxPrice
) {
  return this.find({
    vas_id: { $ne: currentVasId },
    monthly_fee: { $lte: maxPrice },
    is_active: true,
  }).sort({ monthly_fee: 1 });
};

export default mongoose.model("VASCatalog", vasCatalogSchema);
