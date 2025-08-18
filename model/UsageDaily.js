import mongoose from "mongoose";

const usageDailySchema = new mongoose.Schema(
  {
    user_id: {
      type: Number,
      required: true,
    },
    usage_date: {
      type: Date,
      required: true,
    },
    mb_used: {
      type: Number,
      required: true,
      min: 0,
    },
    minutes_used: {
      type: Number,
      required: true,
      min: 0,
    },
    sms_used: {
      type: Number,
      required: true,
      min: 0,
    },
    roaming_mb: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
usageDailySchema.index({ user_id: 1, usage_date: -1 });
usageDailySchema.index({ user_id: 1, usage_date: 1 }, { unique: true });

// Instance methods
usageDailySchema.methods.getGBUsed = function () {
  return (this.mb_used / 1024).toFixed(2);
};

usageDailySchema.methods.isRoamingDay = function () {
  return this.roaming_mb > 0;
};

// Static methods
usageDailySchema.statics.findUserUsageByPeriod = function (
  userId,
  startDate,
  endDate
) {
  return this.find({
    user_id: userId,
    usage_date: { $gte: startDate, $lte: endDate },
  }).sort({ usage_date: 1 });
};

usageDailySchema.statics.calculateMonthlyUsage = function (
  userId,
  year,
  month
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  return this.aggregate([
    {
      $match: {
        user_id: userId,
        usage_date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        total_mb: { $sum: "$mb_used" },
        total_minutes: { $sum: "$minutes_used" },
        total_sms: { $sum: "$sms_used" },
        total_roaming_mb: { $sum: "$roaming_mb" },
        usage_days: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        total_gb: { $round: [{ $divide: ["$total_mb", 1024] }, 2] },
        total_minutes: 1,
        total_sms: 1,
        total_roaming_gb: {
          $round: [{ $divide: ["$total_roaming_mb", 1024] }, 2],
        },
        usage_days: 1,
        avg_daily_mb: {
          $round: [{ $divide: ["$total_mb", "$usage_days"] }, 0],
        },
      },
    },
  ]);
};

usageDailySchema.statics.findPeakUsageDays = function (
  userId,
  startDate,
  endDate,
  limit = 5
) {
  return this.find({
    user_id: userId,
    usage_date: { $gte: startDate, $lte: endDate },
  })
    .sort({ mb_used: -1 })
    .limit(limit);
};

export default mongoose.model("UsageDaily", usageDailySchema);
