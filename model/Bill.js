import mongoose from "mongoose";

const billItemSchema = new mongoose.Schema({
  item_id: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: [
      "data",
      "voice",
      "sms",
      "roaming",
      "premium_sms",
      "vas",
      "one_off",
      "discount",
      "tax",
    ],
    required: true,
  },
  subtype: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  unit_price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  tax_rate: {
    type: Number,
    default: 0.2,
    min: 0,
    max: 1,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const billSchema = new mongoose.Schema(
  {
    bill_id: {
      type: String,
      required: true,
      unique: true,
    },
    user_id: {
      type: Number,
      required: true,
    },
    period_start: {
      type: Date,
      required: true,
    },
    period_end: {
      type: Date,
      required: true,
    },
    issue_date: {
      type: Date,
      required: true,
    },
    total_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxes: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "TRY",
      enum: ["TRY", "USD", "EUR"],
    },
    items: [billItemSchema],
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
billSchema.index({ bill_id: 1 }, { unique: true });
billSchema.index({ user_id: 1, period_start: -1 });
billSchema.index({ user_id: 1, issue_date: -1 });

// Instance methods
billSchema.methods.getCategoryBreakdown = function () {
  const breakdown = {};

  this.items.forEach((item) => {
    if (!breakdown[item.category]) {
      breakdown[item.category] = {
        total: 0,
        items: [],
        percentage: 0,
      };
    }

    breakdown[item.category].total += item.amount;
    breakdown[item.category].items.push({
      description: item.description,
      amount: item.amount,
      quantity: item.quantity,
      unit_price: item.unit_price,
    });
  });

  // Calculate percentages
  Object.keys(breakdown).forEach((category) => {
    breakdown[category].percentage = (
      (breakdown[category].total / this.total_amount) *
      100
    ).toFixed(1);
  });

  return breakdown;
};

billSchema.methods.getAnomalousItems = function (threshold = 0.8) {
  // Bu method anomali tespiti için kategorilere göre analiz yapar
  const categoryTotals = {};

  this.items.forEach((item) => {
    if (!categoryTotals[item.category]) {
      categoryTotals[item.category] = 0;
    }
    categoryTotals[item.category] += item.amount;
  });

  return categoryTotals;
};

billSchema.methods.calculateSavings = function (scenarios) {
  // What-if senaryoları için tasarruf hesaplama
  const currentTotal = this.total_amount;

  return scenarios.map((scenario) => ({
    ...scenario,
    saving: currentTotal - scenario.newTotal,
    savingPercentage: (
      ((currentTotal - scenario.newTotal) / currentTotal) *
      100
    ).toFixed(1),
  }));
};

// Static methods
billSchema.statics.findByUserAndPeriod = function (userId, period) {
  // period: "2025-07" string'ini tarih aralığına çevir
  const [year, month] = period.split("-");
  const startDate = new Date(parseInt(year), parseInt(month) - 1, 1); // month 0-indexed
  const endDate = new Date(parseInt(year), parseInt(month), 1); // next month start

  return this.findOne({
    user_id: parseInt(userId),
    period_start: {
      $gte: startDate,
      $lt: endDate,
    },
  });
};

billSchema.statics.findUserHistory = function (userId, months = 6) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  return this.find({
    user_id: userId,
    period_start: { $gte: startDate, $lte: endDate },
  }).sort({ period_start: -1 });
};

billSchema.statics.findByBillId = function (billId) {
  return this.findOne({ bill_id: billId });
};

export default mongoose.model("Bill", billSchema);
