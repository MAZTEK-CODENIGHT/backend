import { User, Plan } from "../model/index.js";

/**
 * UserController - Kullanıcı işlemleri için controller (Interface Segregation Principle)
 * Sadece kullanıcı ile ilgili API endpoint'lerden sorumludur
 */
class UserController {
  /**
   * Tüm kullanıcıları listeler
   * GET /api/users
   */
  async getAllUsers(req, res, next) {
    try {
      const { type, limit = 50 } = req.query;

      // Query oluştur
      const query = {};
      if (type && ["postpaid", "prepaid"].includes(type)) {
        query.type = type;
      }

      const users = await User.find(query)
        .limit(parseInt(limit))
        .sort({ created_at: -1 });

      // Her kullanıcı için plan bilgisini ekle
      const usersWithPlans = await Promise.all(
        users.map(async (user) => {
          try {
            const plan = await Plan.findByPlanId(user.current_plan_id);
            return {
              user_id: user.user_id,
              name: user.name,
              msisdn: user.msisdn,
              type: user.type,
              current_plan: plan
                ? {
                    plan_id: plan.plan_id,
                    plan_name: plan.plan_name,
                    monthly_price: plan.monthly_price,
                    quota_gb: plan.quota_gb,
                  }
                : null,
              active_vas_count: user.active_vas ? user.active_vas.length : 0,
              active_addons_count: user.active_addons
                ? user.active_addons.length
                : 0,
            };
          } catch (error) {
            console.warn(
              `Plan bilgisi alınamadı (User: ${user.user_id}):`,
              error.message
            );
            return {
              user_id: user.user_id,
              name: user.name,
              msisdn: user.msisdn,
              type: user.type,
              current_plan: null,
            };
          }
        })
      );

      res.status(200).json({
        success: true,
        data: usersWithPlans,
        metadata: {
          total_users: usersWithPlans.length,
          filter_applied: type || "none",
          limit_applied: parseInt(limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Belirli kullanıcı bilgilerini getirir
   * GET /api/users/:userId
   */
  async getUserById(req, res, next) {
    try {
      const { userId } = req.params;

      // Validasyon
      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_USER_ID",
            message: "Geçerli bir kullanıcı ID gereklidir",
          },
        });
      }

      const user = await User.findByUserId(parseInt(userId));

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "Kullanıcı bulunamadı",
            details: { user_id: userId },
          },
        });
      }

      // Plan bilgisini getir
      const plan = await Plan.findByPlanId(user.current_plan_id);

      // VAS ve Addon bilgilerini getir
      const [vasServices, addons] = await Promise.all([
        user.getActiveVAS(),
        user.getActiveAddons(),
      ]);

      const userDetails = {
        user_id: user.user_id,
        name: user.name,
        msisdn: user.msisdn,
        type: user.type,
        current_plan: plan
          ? {
              plan_id: plan.plan_id,
              plan_name: plan.plan_name,
              quota_gb: plan.quota_gb,
              quota_min: plan.quota_min,
              quota_sms: plan.quota_sms,
              monthly_price: plan.monthly_price,
              overage_gb: plan.overage_gb,
              overage_min: plan.overage_min,
              overage_sms: plan.overage_sms,
            }
          : null,
        active_vas: vasServices.map((vas) => ({
          vas_id: vas.vas_id,
          name: vas.name,
          monthly_fee: vas.monthly_fee,
          provider: vas.provider,
          category: vas.category,
        })),
        active_addons: addons.map((addon) => ({
          addon_id: addon.addon_id,
          name: addon.name,
          type: addon.type,
          price: addon.price,
          extra_gb: addon.extra_gb,
          extra_min: addon.extra_min,
          extra_sms: addon.extra_sms,
        })),
        account_summary: {
          total_monthly_cost: UserController.calculateTotalMonthlyCost(
            plan,
            vasServices,
            addons
          ),
          services_count: vasServices.length + addons.length + 1, // +1 for plan
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      };

      res.status(200).json({
        success: true,
        data: userDetails,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * MSISDN ile kullanıcı bilgilerini getirir
   * GET /api/users/by-msisdn/:msisdn
   */
  async getUserByMsisdn(req, res, next) {
    try {
      const { msisdn } = req.params;

      // MSISDN formatı kontrolü (10 haneli numara)
      if (!msisdn || !/^\d{10}$/.test(msisdn)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_MSISDN",
            message: "MSISDN 10 haneli sayı formatında olmalıdır",
          },
        });
      }

      const user = await User.findByMsisdn(msisdn);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "Belirtilen MSISDN ile kullanıcı bulunamadı",
            details: { msisdn },
          },
        });
      }

      // User ID ile detayları getir
      req.params.userId = user.user_id.toString();
      return this.getUserById(req, res, next);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Kullanıcı profil özeti
   * GET /api/users/:userId/profile
   */
  async getUserProfile(req, res, next) {
    try {
      const { userId } = req.params;

      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_USER_ID",
            message: "Geçerli bir kullanıcı ID gereklidir",
          },
        });
      }

      const user = await User.findByUserId(parseInt(userId));

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "Kullanıcı bulunamadı",
          },
        });
      }

      const plan = await Plan.findByPlanId(user.current_plan_id);

      // Basit profil özeti
      const profile = {
        user_info: {
          user_id: user.user_id,
          name: user.name,
          msisdn: user.msisdn,
          account_type: user.type,
        },
        current_plan: plan
          ? {
              name: plan.plan_name,
              monthly_price: plan.monthly_price,
              quotas: {
                data_gb: plan.quota_gb,
                voice_min: plan.quota_min,
                sms_count: plan.quota_sms,
              },
            }
          : null,
        services: {
          vas_count: user.active_vas ? user.active_vas.length : 0,
          addon_count: user.active_addons ? user.active_addons.length : 0,
        },
        membership: {
          member_since: user.created_at,
          last_updated: user.updated_at,
        },
      };

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Kullanıcı istatistikleri
   * GET /api/users/stats
   */
  async getUserStats(req, res, next) {
    try {
      // Genel kullanıcı istatistikleri
      const [
        totalUsers,
        postpaidUsers,
        prepaidUsers,
        activeVasUsers,
        activeAddonUsers,
      ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ type: "postpaid" }),
        User.countDocuments({ type: "prepaid" }),
        User.countDocuments({
          active_vas: { $exists: true, $not: { $size: 0 } },
        }),
        User.countDocuments({
          active_addons: { $exists: true, $not: { $size: 0 } },
        }),
      ]);

      const stats = {
        total_users: totalUsers,
        user_types: {
          postpaid: postpaidUsers,
          postpaid_percentage: ((postpaidUsers / totalUsers) * 100).toFixed(1),
          prepaid: prepaidUsers,
          prepaid_percentage: ((prepaidUsers / totalUsers) * 100).toFixed(1),
        },
        service_adoption: {
          vas_users: activeVasUsers,
          vas_adoption_rate: ((activeVasUsers / totalUsers) * 100).toFixed(1),
          addon_users: activeAddonUsers,
          addon_adoption_rate: ((activeAddonUsers / totalUsers) * 100).toFixed(
            1
          ),
        },
        analysis_date: new Date().toISOString(),
      };

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  // Yardımcı metodlar

  /**
   * Toplam aylık maliyeti hesaplar
   * @param {Object} plan - Plan objesi
   * @param {Array} vasServices - VAS servisleri
   * @param {Array} addons - Ek paketler
   * @returns {number} Toplam aylık maliyet
   */
  static calculateTotalMonthlyCost(plan, vasServices = [], addons = []) {
    let total = 0;

    // Plan ücreti
    if (plan) {
      total += plan.monthly_price;
    }

    // VAS ücretleri
    vasServices.forEach((vas) => {
      total += vas.monthly_fee || 0;
    });

    // Addon ücretleri
    addons.forEach((addon) => {
      total += addon.price || 0;
    });

    return parseFloat(total.toFixed(2));
  }

  /**
   * Kullanıcı doğrulama
   * @param {number} userId - Kullanıcı ID
   * @returns {Object} Doğrulama sonucu
   */
  async validateUser(userId) {
    try {
      const user = await User.findByUserId(userId);
      return {
        valid: !!user,
        user: user,
        message: user ? "Kullanıcı geçerli" : "Kullanıcı bulunamadı",
      };
    } catch (error) {
      return {
        valid: false,
        user: null,
        message: "Kullanıcı doğrulama hatası",
      };
    }
  }
}

export default new UserController();
