import {
  Bill,
  User,
  Plan,
  VASCatalog,
  PremiumSMSCatalog,
  AddOnPack,
} from "../model/index.js";

/**
 * BillService - Fatura işlemleri için sorumlu servis (Single Responsibility Principle)
 * Sadece fatura ile ilgili işlemlerden sorumludur
 */
class BillService {
  /**
   * Kullanıcının belirli dönemdeki faturasını getirir
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - YYYY-MM formatında dönem
   * @returns {Promise<Object>} Fatura bilgileri
   */
  async getBillByUserAndPeriod(userId, period) {
    try {
      // Period formatını kontrol et
      if (!this.validatePeriodFormat(period)) {
        throw new Error(
          "Geçersiz dönem formatı. YYYY-MM formatında olmalıdır."
        );
      }

      const bill = await Bill.findByUserAndPeriod(userId, period);

      if (!bill) {
        throw new Error(`${period} dönemi için fatura bulunamadı`);
      }

      return {
        bill: {
          bill_id: bill.bill_id,
          user_id: bill.user_id,
          period_start: bill.period_start,
          period_end: bill.period_end,
          issue_date: bill.issue_date,
          total_amount: bill.total_amount,
          subtotal: bill.subtotal,
          taxes: bill.taxes,
          currency: bill.currency,
        },
        items: bill.items,
        summary: {
          subtotal: bill.subtotal,
          taxes: bill.taxes,
          total: bill.total_amount,
          item_count: bill.items.length,
        },
      };
    } catch (error) {
      throw new Error(`Fatura getirme hatası: ${error.message}`);
    }
  }

  /**
   * Bill ID ile fatura getirir
   * @param {string} billId - Fatura ID
   * @returns {Promise<Object>} Fatura bilgileri
   */
  async getBillById(billId) {
    try {
      const bill = await Bill.findByBillId(billId);

      if (!bill) {
        throw new Error("Fatura bulunamadı");
      }

      return bill;
    } catch (error) {
      throw new Error(`Fatura getirme hatası: ${error.message}`);
    }
  }

  /**
   * Kullanıcının fatura geçmişini getirir
   * @param {number} userId - Kullanıcı ID
   * @param {number} months - Geçmiş ay sayısı (varsayılan: 6)
   * @returns {Promise<Array>} Fatura geçmişi
   */
  async getBillHistory(userId, months = 6) {
    try {
      const bills = await Bill.findUserHistory(userId, months);

      return bills.map((bill, index, array) => {
        let changePercent = 0;

        // Önceki fatura ile karşılaştır
        if (index < array.length - 1) {
          const previousBill = array[index + 1];
          changePercent = (
            ((bill.total_amount - previousBill.total_amount) /
              previousBill.total_amount) *
            100
          ).toFixed(1);
        }

        return {
          period: this.formatPeriod(bill.period_start),
          total_amount: bill.total_amount,
          change_percent: parseFloat(changePercent),
          issue_date: bill.issue_date,
          bill_id: bill.bill_id,
        };
      });
    } catch (error) {
      throw new Error(`Fatura geçmişi getirme hatası: ${error.message}`);
    }
  }

  /**
   * Kullanıcının mevcut dönemlerini getirir
   * @param {number} userId - Kullanıcı ID
   * @returns {Promise<Array>} Mevcut dönemler listesi
   */
  async getAvailablePeriods(userId) {
    try {
      const bills = await Bill.findAvailablePeriods(userId);

      if (!bills || bills.length === 0) {
        return [];
      }

      // Dönemleri formatla ve sırala (en yeni önce)
      const periods = bills
        .map(bill => ({
          period: this.formatPeriod(bill.period_start),
          period_start: bill.period_start,
          period_end: bill.period_end,
          issue_date: bill.issue_date,
          total_amount: bill.total_amount,
          bill_id: bill.bill_id,
        }))
        .sort((a, b) => new Date(b.period_start) - new Date(a.period_start));

      return periods;
    } catch (error) {
      throw new Error(`Mevcut dönemler getirme hatası: ${error.message}`);
    }
  }

  /**
   * Faturadaki kategori bazında dağılımı hesaplar
   * @param {Object} bill - Fatura objesi
   * @returns {Object} Kategori bazında dağılım
   */
  getCategoryBreakdown(bill) {
    try {
      const breakdown = {};

      bill.items.forEach((item) => {
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
          subtype: item.subtype,
          created_at: item.created_at,
        });
      });

      // Yüzdeleri hesapla
      Object.keys(breakdown).forEach((category) => {
        breakdown[category].percentage = parseFloat(
          ((breakdown[category].total / bill.total_amount) * 100).toFixed(1)
        );
      });

      return breakdown;
    } catch (error) {
      throw new Error(`Kategori analizi hatası: ${error.message}`);
    }
  }

  /**
   * Fatura için kullanım istatistiklerini hesaplar
   * @param {Object} bill - Fatura objesi
   * @returns {Object} Kullanım istatistikleri
   */
  calculateUsageStats(bill) {
    try {
      const stats = {
        total_gb: 0,
        total_minutes: 0,
        total_sms: 0,
        roaming_mb: 0,
        premium_sms_count: 0,
        vas_count: 0,
      };

      bill.items.forEach((item) => {
        switch (item.category) {
          case "data":
            if (item.subtype === "data_overage") {
              stats.total_gb += item.quantity;
            }
            break;
          case "voice":
            if (item.subtype === "voice_overage") {
              stats.total_minutes += item.quantity;
            }
            break;
          case "sms":
            if (item.subtype === "sms_overage") {
              stats.total_sms += item.quantity;
            }
            break;
          case "roaming":
            stats.roaming_mb += item.quantity || 0;
            break;
          case "premium_sms":
            stats.premium_sms_count += item.quantity;
            break;
          case "vas":
            stats.vas_count += 1;
            break;
        }
      });

      return stats;
    } catch (error) {
      throw new Error(
        `Kullanım istatistikleri hesaplama hatası: ${error.message}`
      );
    }
  }

  /**
   * Fatura için doğal dil özeti oluşturur
   * @param {Object} bill - Fatura objesi
   * @param {Object} breakdown - Kategori dağılımı
   * @param {Object} stats - Kullanım istatistikleri
   * @returns {string} Doğal dil özeti
   */
  generateNaturalLanguageSummary(bill, breakdown, stats) {
    try {
      let summary = `Bu ay toplam ${bill.total_amount} TL fatura oluştu. `;

      // Veri kullanımı
      if (stats.total_gb > 0) {
        summary += `${stats.total_gb}GB veri kullandınız. `;
      }

      // Ses kullanımı
      if (stats.total_minutes > 0) {
        summary += `${stats.total_minutes} dakika konuştunuz. `;
      }

      // En yüksek kategori
      const categories = Object.entries(breakdown)
        .filter(([category]) => category !== "tax")
        .sort(([, a], [, b]) => b.total - a.total);

      if (categories.length > 0) {
        const [topCategory, topData] = categories[0];
        const categoryNames = {
          premium_sms: "Premium SMS",
          data: "veri kullanımı",
          voice: "ses aramaları",
          vas: "değer artışlı servisler",
          roaming: "yurt dışı kullanım",
        };

        if (topData.percentage > 30) {
          summary += `Faturanızın %${topData.percentage}'i ${
            categoryNames[topCategory] || topCategory
          } kaynaklı. `;
        }
      }

      // Anomali uyarıları
      if (stats.premium_sms_count > 10) {
        summary += `Dikkat: ${stats.premium_sms_count} adet Premium SMS gönderildi. `;
      }

      if (stats.roaming_mb > 0) {
        summary += `Yurt dışında ${stats.roaming_mb}MB veri kullanıldı. `;
      }

      return summary.trim();
    } catch (error) {
      throw new Error(`Özet oluşturma hatası: ${error.message}`);
    }
  }

  /**
   * Period formatını doğrular (YYYY-MM)
   * @param {string} period - Kontrol edilecek period
   * @returns {boolean} Geçerli ise true
   */
  validatePeriodFormat(period) {
    const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    return periodRegex.test(period);
  }

  /**
   * Date objesi'ni YYYY-MM formatına çevirir
   * @param {Date} date - Çevrilecek tarih
   * @returns {string} YYYY-MM formatında string
   */
  formatPeriod(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  /**
   * Fatura kalemlerini açıklama metni ile zenginleştirir
   * @param {Array} items - Fatura kalemleri
   * @returns {Promise<Array>} Açıklamalı fatura kalemleri
   */
  async enrichBillItems(items) {
    try {
      const enrichedItems = await Promise.all(
        items.map(async (item) => {
          let enrichedDescription = item.description;
          let providerInfo = null;

          // Premium SMS için sağlayıcı bilgisi ekle
          if (
            item.category === "premium_sms" &&
            item.subtype === "premium_3rdparty"
          ) {
            try {
              // Kısa kod bilgisini description'dan çıkar
              const shortcodeMatch = item.description.match(/(\d{4})/);
              if (shortcodeMatch) {
                const shortcode = shortcodeMatch[1];
                const smsInfo = await PremiumSMSCatalog.findOne({ shortcode });
                if (smsInfo) {
                  providerInfo = smsInfo.provider;
                  enrichedDescription = `${item.description} (${smsInfo.service_name} - ${smsInfo.provider})`;
                }
              }
            } catch (error) {
              console.warn("Premium SMS bilgisi alınamadı:", error.message);
            }
          }

          // VAS için detay bilgisi ekle
          if (item.category === "vas") {
            try {
              const vasInfo = await VASCatalog.findOne({
                monthly_fee: item.unit_price,
              });
              if (vasInfo) {
                enrichedDescription = `${vasInfo.name} (${vasInfo.provider}) - Aylık ücret`;
              }
            } catch (error) {
              console.warn("VAS bilgisi alınamadı:", error.message);
            }
          }

          return {
            ...item.toObject(),
            enriched_description: enrichedDescription,
            provider_info: providerInfo,
          };
        })
      );

      return enrichedItems;
    } catch (error) {
      throw new Error(`Fatura kalemi zenginleştirme hatası: ${error.message}`);
    }
  }
}

export default new BillService();
