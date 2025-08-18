import mongoose from "mongoose";

const addOnPackSchema = new mongoose.Schema(
  {
    addon_id: {
      type: Number,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["data", "voice", "sms", "combo"],
      required: true,
    },
    extra_gb: {
      type: Number,
      default: 0,
      min: 0,
    },
    extra_min: {
      type: Number,
      default: 0,
      min: 0,
    },
    extra_sms: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compatible_plans: [
      {
        type: Number,
        required: true,
      },
    ],
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
addOnPackSchema.index({ addon_id: 1 }, { unique: true });
addOnPackSchema.index({ type: 1, is_active: 1 });
addOnPackSchema.index({ price: 1 });

// Instance methods
addOnPackSchema.methods.isCompatibleWithPlan = function (planId) {
  return this.compatible_plans.includes(planId);
};

addOnPackSchema.methods.calculateValuePerGB = function () {
  if (this.extra_gb === 0) return null;
  return (this.price / this.extra_gb).toFixed(2);
};

addOnPackSchema.methods.calculateValuePerMinute = function () {
  if (this.extra_min === 0) return null;
  return (this.price / this.extra_min).toFixed(4);
};

addOnPackSchema.methods.getValueScore = function () {
  // Combo value için toplam değer hesaplama
  let totalValue = 0;
  if (this.extra_gb > 0) totalValue += this.extra_gb * 8; // GB başına 8 TL değer varsayımı
  if (this.extra_min > 0) totalValue += this.extra_min * 0.8; // Dakika başına 0.8 TL
  if (this.extra_sms > 0) totalValue += this.extra_sms * 0.3; // SMS başına 0.3 TL

  return totalValue > 0 ? (totalValue / this.price).toFixed(2) : 0;
};

addOnPackSchema.methods.getTotalCapacity = function () {
  return {
    data_gb: this.extra_gb,
    voice_min: this.extra_min,
    sms_count: this.extra_sms,
    type: this.type,
  };
};

// Static methods
addOnPackSchema.statics.findCompatibleWithPlan = function (planId) {
  return this.find({
    compatible_plans: planId,
    is_active: true,
  }).sort({ price: 1 });
};

addOnPackSchema.statics.findByType = function (type) {
  return this.find({ type, is_active: true }).sort({ price: 1 });
};

addOnPackSchema.statics.findDataAddons = function (minGB = 0) {
  return this.find({
    type: { $in: ["data", "combo"] },
    extra_gb: { $gte: minGB },
    is_active: true,
  }).sort({ extra_gb: 1, price: 1 });
};

addOnPackSchema.statics.findVoiceAddons = function (minMinutes = 0) {
  return this.find({
    type: { $in: ["voice", "combo"] },
    extra_min: { $gte: minMinutes },
    is_active: true,
  }).sort({ extra_min: 1, price: 1 });
};

addOnPackSchema.statics.findBestValueAddons = function (type = null) {
  const query = { is_active: true };
  if (type) query.type = type;

  return this.find(query).sort({ price: 1 }).limit(5);
};

addOnPackSchema.statics.findByAddonIds = function (addonIds) {
  return this.find({
    addon_id: { $in: addonIds },
    is_active: true,
  });
};

addOnPackSchema.statics.recommendForUsage = function (usage, currentPlan) {
  // Kullanım bazında öneri algoritması
  const recommendations = [];

  // Data aşımı varsa data addon'ları öner
  if (usage.total_gb > currentPlan.quota_gb) {
    const overageGB = usage.total_gb - currentPlan.quota_gb;
    recommendations.push({
      type: "data_overage",
      needed_gb: overageGB,
      filter: { type: "data", extra_gb: { $gte: overageGB } },
    });
  }

  return recommendations;
};

export default mongoose.model("AddOnPack", addOnPackSchema);
