import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: Number,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    msisdn: {
      type: String,
      required: true,
      unique: true,
      match: /^[0-9]{10}$/,
    },
    current_plan_id: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["postpaid", "prepaid"],
      required: true,
    },
    active_vas: [
      {
        type: String,
      },
    ],
    active_addons: [
      {
        type: Number,
      },
    ],
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
userSchema.index({ user_id: 1 }, { unique: true });
userSchema.index({ msisdn: 1 }, { unique: true });

// Instance methods
userSchema.methods.getCurrentPlan = function () {
  return mongoose.model("Plan").findOne({ plan_id: this.current_plan_id });
};

userSchema.methods.getActiveVAS = function () {
  return mongoose
    .model("VASCatalog")
    .find({ vas_id: { $in: this.active_vas } });
};

userSchema.methods.getActiveAddons = function () {
  return mongoose
    .model("AddOnPack")
    .find({ addon_id: { $in: this.active_addons } });
};

// Static methods
userSchema.statics.findByMsisdn = function (msisdn) {
  return this.findOne({ msisdn });
};

userSchema.statics.findByUserId = function (userId) {
  return this.findOne({ user_id: userId });
};

export default mongoose.model("User", userSchema);
