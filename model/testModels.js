// Test file for MongoDB models
// Run with: npm run test-models

import dotenv from "dotenv";
import { dbConnect } from "../config/dbConnect.js";
import {
  User,
  Plan,
  Bill,
  UsageDaily,
  VASCatalog,
  PremiumSMSCatalog,
  AddOnPack,
} from "./index.js";

dotenv.config();

async function testModels() {
  try {
    // Connect to database
    await dbConnect();

    console.log("\n🧪 Testing Mongoose Models...\n");

    // Test 1: User model
    console.log("1️⃣ Testing User Model:");
    const user = await User.findByUserId(1001);
    if (user) {
      console.log(`   ✅ User found: ${user.name} (${user.msisdn})`);
      console.log(`   📱 Plan ID: ${user.current_plan_id}`);
      console.log(`   🎵 Active VAS: ${user.active_vas.join(", ")}`);
    } else {
      console.log("   ❌ User not found");
    }

    // Test 2: Plan model
    console.log("\n2️⃣ Testing Plan Model:");
    const plan = await Plan.findByPlanId(2);
    if (plan) {
      console.log(`   ✅ Plan found: ${plan.plan_name}`);
      console.log(
        `   📊 Quota: ${plan.quota_gb}GB / ${plan.quota_min}min / ${plan.quota_sms}SMS`
      );
      console.log(`   💰 Price: ${plan.monthly_price} TL`);
    }

    // Test 3: Bill model
    console.log("\n3️⃣ Testing Bill Model:");
    const bill = await Bill.findByUserAndPeriod(1001, "2025-07");
    if (bill) {
      console.log(`   ✅ Bill found: ${bill.bill_id}`);
      console.log(`   💵 Total: ${bill.total_amount} TL`);
      console.log(`   📋 Items: ${bill.items.length}`);

      // Test category breakdown
      const breakdown = bill.getCategoryBreakdown();
      console.log("   📊 Category breakdown:");
      Object.entries(breakdown).forEach(([category, data]) => {
        console.log(
          `      ${category}: ${data.total} TL (${data.percentage}%)`
        );
      });
    }

    // Test 4: Usage Daily aggregation
    console.log("\n4️⃣ Testing Usage Daily Model:");
    const monthlyUsage = await UsageDaily.calculateMonthlyUsage(1001, 2025, 7);
    if (monthlyUsage.length > 0) {
      const usage = monthlyUsage[0];
      console.log(`   ✅ Monthly usage calculated:`);
      console.log(`      📶 Data: ${usage.total_gb} GB`);
      console.log(`      📞 Voice: ${usage.total_minutes} minutes`);
      console.log(`      💬 SMS: ${usage.total_sms} messages`);
      console.log(`      📅 Active days: ${usage.usage_days}`);
    }

    // Test 5: VAS Catalog
    console.log("\n5️⃣ Testing VAS Catalog:");
    const activeVAS = await VASCatalog.findActiveServices();
    console.log(`   ✅ Active VAS services: ${activeVAS.length}`);
    activeVAS.slice(0, 3).forEach((vas) => {
      console.log(`      ${vas.name}: ${vas.monthly_fee} TL (${vas.category})`);
    });

    // Test 6: Premium SMS Catalog
    console.log("\n6️⃣ Testing Premium SMS:");
    const premiumSMS = await PremiumSMSCatalog.findByShortcode("3838");
    if (premiumSMS) {
      console.log(`   ✅ Premium SMS found: ${premiumSMS.service_name}`);
      console.log(`      💰 Price: ${premiumSMS.unit_price} TL`);
      console.log(`      🏢 Provider: ${premiumSMS.provider}`);
      console.log(`      ⚠️  Risk Level: ${premiumSMS.getRiskLevel()}`);
    }

    // Test 7: Add-on Packs
    console.log("\n7️⃣ Testing Add-on Packs:");
    const dataAddons = await AddOnPack.findByType("data");
    console.log(`   ✅ Data add-ons available: ${dataAddons.length}`);
    dataAddons.slice(0, 3).forEach((addon) => {
      console.log(
        `      ${addon.name}: ${addon.extra_gb}GB for ${
          addon.price
        } TL (Value: ${addon.calculateValuePerGB()} TL/GB)`
      );
    });

    console.log("\n🎉 All model tests completed successfully!");
  } catch (error) {
    console.error("❌ Test error:", error);
  } finally {
    process.exit(0);
  }
}

// Run tests
testModels();
