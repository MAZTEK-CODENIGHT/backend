import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    plan_id: {
      type: Number,
      required: true,
      unique: true,
    },
    plan_name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["postpaid", "prepaid"],
      required: true,
    },
    quota_gb: {
      type: Number,
      required: true,
      min: 0,
    },
    quota_min: {
      type: Number,
      required: true,
      min: 0,
    },
    quota_sms: {
      type: Number,
      required: true,
      min: 0,
    },
    monthly_price: {
      type: Number,
      required: true,
      min: 0,
    },
    overage_gb: {
      type: Number,
      required: true,
      min: 0,
    },
    overage_min: {
      type: Number,
      required: true,
      min: 0,
    },
    overage_sms: {
      type: Number,
      required: true,
      min: 0,
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
planSchema.index({ plan_id: 1 }, { unique: true });
planSchema.index({ type: 1, is_active: 1 });

// Instance methods
planSchema.methods.calculateOverageCost = function (usage) {
  const dataOverage = Math.max(0, usage.total_gb - this.quota_gb);
  const voiceOverage = Math.max(0, usage.total_minutes - this.quota_min);
  const smsOverage = Math.max(0, usage.total_sms - this.quota_sms);

  return {
    data: dataOverage * this.overage_gb,
    voice: voiceOverage * this.overage_min,
    sms: smsOverage * this.overage_sms,
    total:
      dataOverage * this.overage_gb +
      voiceOverage * this.overage_min +
      smsOverage * this.overage_sms,
  };
};

planSchema.methods.getTotalCostWithUsage = function (usage) {
  const overageCost = this.calculateOverageCost(usage);
  return this.monthly_price + overageCost.total;
};

// Static methods
planSchema.statics.findActivePlans = function () {
  return this.find({ is_active: true }).sort({ monthly_price: 1 });
};

planSchema.statics.findByType = function (type) {
  return this.find({ type, is_active: true }).sort({ monthly_price: 1 });
};

planSchema.statics.findByPlanId = function (planId) {
  return this.findOne({ plan_id: planId, is_active: true });
};

export default mongoose.model("Plan", planSchema);
