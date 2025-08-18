import mongoose from "mongoose";

const premiumSmsCatalogSchema = new mongoose.Schema(
  {
    shortcode: {
      type: String,
      required: true,
      unique: true,
      match: /^[0-9]{4,5}$/,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    unit_price: {
      type: Number,
      required: true,
      min: 0,
    },
    service_name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["game", "entertainment", "news", "lifestyle", "subscription"],
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
premiumSmsCatalogSchema.index({ shortcode: 1 }, { unique: true });
premiumSmsCatalogSchema.index({ category: 1, is_active: 1 });
premiumSmsCatalogSchema.index({ provider: 1 });

// Instance methods
premiumSmsCatalogSchema.methods.calculateCostForUsage = function (quantity) {
  return this.unit_price * quantity;
};

premiumSmsCatalogSchema.methods.isHighCost = function (threshold = 3) {
  return this.unit_price > threshold;
};

premiumSmsCatalogSchema.methods.getRiskLevel = function () {
  if (this.unit_price >= 5) return "high";
  if (this.unit_price >= 3) return "medium";
  return "low";
};

// Static methods
premiumSmsCatalogSchema.statics.findByShortcode = function (shortcode) {
  return this.findOne({ shortcode, is_active: true });
};

premiumSmsCatalogSchema.statics.findByCategory = function (category) {
  return this.find({ category, is_active: true }).sort({ unit_price: 1 });
};

premiumSmsCatalogSchema.statics.findHighRiskServices = function (
  threshold = 3
) {
  return this.find({
    unit_price: { $gte: threshold },
    is_active: true,
  }).sort({ unit_price: -1 });
};

premiumSmsCatalogSchema.statics.findByProvider = function (provider) {
  return this.find({ provider, is_active: true }).sort({ unit_price: 1 });
};

premiumSmsCatalogSchema.statics.getProviderStats = function () {
  return this.aggregate([
    { $match: { is_active: true } },
    {
      $group: {
        _id: "$provider",
        service_count: { $sum: 1 },
        avg_price: { $avg: "$unit_price" },
        max_price: { $max: "$unit_price" },
        min_price: { $min: "$unit_price" },
      },
    },
    { $sort: { service_count: -1 } },
  ]);
};

export default mongoose.model("PremiumSMSCatalog", premiumSmsCatalogSchema);
