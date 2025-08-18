import {
  Bill,
  User,
  Plan,
  VASCatalog,
  PremiumSMSCatalog,
  AddOnPack,
} from "../model/index.js";
import BillService from "./BillService.js";

/**
 * ExplanationService - Fatura açıklama için sorumlu servis (Single Responsibility Principle)
 * Sadece fatura açıklama ve anlaşılabilir hale getirme işlemlerinden sorumludur
 */
class ExplanationService {
  constructor() {
    this.categoryNames = {
      data: "Veri Kullanımı",
      voice: "Ses Aramaları",
      sms: "SMS",
      roaming: "Yurt Dışı Kullanım",
      premium_sms: "Premium SMS",
      vas: "Değer Artırıcı Servisler",
      one_off: "Tek Seferlik Ücretler",
      discount: "İndirimler",
      tax: "Vergiler",
    };

    this.subtypeDescriptions = {
      monthly_allowance: "Aylık paket ücreti",
      data_overage: "Veri aşım ücreti",
      voice_overage: "Dakika aşım ücreti",
      sms_overage: "SMS aşım ücreti",
      premium_3rdparty: "3. parti premium servis",
      vas_monthly: "Aylık VAS ücreti",
      intl_call: "Uluslararası arama",
      roaming_data: "Yurt dışı veri",
      roaming_voice: "Yurt dışı arama",
    };
  }

  /**
   * Faturayı açıklanabilir formatta döndürür
   * @param {string} billId - Fatura ID
   * @param {string} language - Dil (varsayılan: tr)
   * @returns {Promise<Object>} Açıklanabilir fatura verisi
   */
  async explainBill(billId, language = "tr") {
    try {
      // Faturayı getir
      const bill = await BillService.getBillById(billId);
      if (!bill) {
        throw new Error("Fatura bulunamadı");
      }

      // Kategori bazında dağılım
      const breakdown = BillService.getCategoryBreakdown(bill);

      // Kullanım istatistikleri
      const stats = BillService.calculateUsageStats(bill);

      // Fatura kalemlerini zenginleştir
      const enrichedItems = await BillService.enrichBillItems(bill.items);

      // Her kategori için detaylı açıklama oluştur
      const detailedBreakdown = await this.createDetailedBreakdown(
        breakdown,
        enrichedItems
      );

      // Doğal dil özeti
      const naturalLanguageSummary = this.generateEnhancedSummary(
        bill,
        breakdown,
        stats
      );

      // Tasarruf ipucu
      const savingsHint = await this.generateSavingsHint(bill, breakdown);

      return {
        summary: {
          total: bill.total_amount,
          subtotal: bill.subtotal,
          taxes: bill.taxes,
          savings_hint: savingsHint,
          natural_language: naturalLanguageSummary,
          period: this.formatPeriod(bill.period_start, bill.period_end),
          currency: bill.currency,
        },
        breakdown: detailedBreakdown,
        usage_stats: stats,
        metadata: {
          bill_id: bill.bill_id,
          item_count: bill.items.length,
          analysis_date: new Date().toISOString(),
          language: language,
        },
      };
    } catch (error) {
      throw new Error(`Fatura açıklama hatası: ${error.message}`);
    }
  }

  /**
   * Detaylı kategori dağılımı oluşturur
   * @param {Object} breakdown - Kategori dağılımı
   * @param {Array} enrichedItems - Zenginleştirilmiş fatura kalemleri
   * @returns {Promise<Array>} Detaylı kategori açıklamaları
   */
  async createDetailedBreakdown(breakdown, enrichedItems) {
    const detailedBreakdown = [];

    for (const [category, data] of Object.entries(breakdown)) {
      const categoryItems = enrichedItems.filter(
        (item) => item.category === category
      );

      // Her kalem için açıklama oluştur
      const explanationLines = await Promise.all(
        categoryItems.map((item) => this.generateItemExplanation(item))
      );

      detailedBreakdown.push({
        category,
        category_name: this.categoryNames[category] || category,
        total: data.total,
        percentage: data.percentage,
        item_count: categoryItems.length,
        lines: explanationLines,
        summary: this.generateCategorySummary(category, categoryItems),
        impact_level: this.calculateImpactLevel(data.percentage),
        recommendations: this.getCategoryRecommendations(
          category,
          categoryItems
        ),
      });
    }

    // Tutara göre sırala (en yüksekten en düşüğe)
    return detailedBreakdown.sort((a, b) => b.total - a.total);
  }

  /**
   * Fatura kalemi için açıklama oluşturur
   * @param {Object} item - Fatura kalemi
   * @returns {Promise<Object>} Kalem açıklaması
   */
  async generateItemExplanation(item) {
    let explanation = {
      original_description: item.description,
      enhanced_description: item.enriched_description || item.description,
      amount: item.amount,
      breakdown: "",
      details: {},
      tips: [],
    };

    switch (item.category) {
      case "data":
        explanation = await this.explainDataItem(item, explanation);
        break;
      case "voice":
        explanation = await this.explainVoiceItem(item, explanation);
        break;
      case "premium_sms":
        explanation = await this.explainPremiumSMSItem(item, explanation);
        break;
      case "vas":
        explanation = await this.explainVASItem(item, explanation);
        break;
      case "roaming":
        explanation = await this.explainRoamingItem(item, explanation);
        break;
      default:
        explanation.breakdown = `${item.quantity || 1}×${
          item.unit_price
        } TL = ${item.amount} TL`;
    }

    return explanation;
  }

  /**
   * Veri kullanımı kalemini açıklar
   * @param {Object} item - Fatura kalemi
   * @param {Object} explanation - Açıklama objesi
   * @returns {Object} Veri açıklaması
   */
  async explainDataItem(item, explanation) {
    if (item.subtype === "data_overage") {
      explanation.breakdown = `Kotanızı ${item.quantity}GB aştınız → ${item.quantity}GB × ${item.unit_price} TL = ${item.amount} TL`;
      explanation.details = {
        overage_gb: item.quantity,
        overage_rate: item.unit_price,
        overage_date: item.created_at,
      };
      explanation.tips = [
        "Daha yüksek kotası olan bir plana geçmeyi düşünün",
        "Veri kullanımınızı takip edebileceğiniz uygulamalar kullanın",
        "WiFi kullanımını artırın",
      ];
    } else if (item.subtype === "monthly_allowance") {
      explanation.breakdown = `Aylık plan ücreti: ${item.amount} TL`;
      explanation.details = {
        plan_type: "monthly",
        service_type: "data_plan",
      };
    }

    return explanation;
  }

  /**
   * Ses arama kalemini açıklar
   * @param {Object} item - Fatura kalemi
   * @param {Object} explanation - Açıklama objesi
   * @returns {Object} Ses açıklaması
   */
  async explainVoiceItem(item, explanation) {
    if (item.subtype === "voice_overage") {
      explanation.breakdown = `Kotanızı ${item.quantity} dakika aştınız → ${item.quantity}dk × ${item.unit_price} TL = ${item.amount} TL`;
      explanation.details = {
        overage_minutes: item.quantity,
        overage_rate: item.unit_price,
        overage_date: item.created_at,
      };
      explanation.tips = [
        "Daha fazla dakikası olan plan seçeneklerine bakın",
        "Ek dakika paketlerini değerlendirin",
        "WhatsApp Call gibi alternatif iletişim yöntemlerini kullanın",
      ];
    } else if (item.subtype === "intl_call") {
      explanation.breakdown = `Uluslararası arama: ${item.quantity}dk × ${item.unit_price} TL = ${item.amount} TL`;
      explanation.details = {
        international_minutes: item.quantity,
        international_rate: item.unit_price,
      };
      explanation.tips = [
        "Uluslararası arama paketlerini inceleyin",
        "İnternet üzerinden arama uygulamalarını kullanın",
      ];
    }

    return explanation;
  }

  /**
   * Premium SMS kalemini açıklar
   * @param {Object} item - Fatura kalemi
   * @param {Object} explanation - Açıklama objesi
   * @returns {Object} Premium SMS açıklaması
   */
  async explainPremiumSMSItem(item, explanation) {
    if (item.subtype === "premium_3rdparty") {
      // Kısa kod çıkar
      const shortcodeMatch = item.description.match(/(\d{4})/);
      const shortcode = shortcodeMatch ? shortcodeMatch[1] : "bilinmeyen";

      explanation.breakdown = `${shortcode} numarasına ${item.quantity} adet Premium SMS → ${item.quantity}×${item.unit_price} TL = ${item.amount} TL`;
      explanation.details = {
        shortcode: shortcode,
        sms_count: item.quantity,
        unit_price: item.unit_price,
        provider: item.provider_info || "Bilinmeyen sağlayıcı",
        service_date: item.created_at,
      };
      explanation.tips = [
        "Premium SMS servislerini bloke edebilirsiniz",
        "Şüpheli numaralardan gelen mesajlara yanıt vermeyin",
        "Premium servislere abone olmadan önce ücretlendirme bilgilerini kontrol edin",
      ];

      // Eğer çok fazla premium SMS varsa uyarı ekle
      if (item.quantity > 10) {
        explanation.tips.unshift(
          "⚠️ Çok sayıda Premium SMS tespit edildi - acil olarak bu servisleri bloke edin"
        );
      }
    }

    return explanation;
  }

  /**
   * VAS kalemini açıklar
   * @param {Object} item - Fatura kalemi
   * @param {Object} explanation - Açıklama objesi
   * @returns {Object} VAS açıklaması
   */
  async explainVASItem(item, explanation) {
    try {
      const vasInfo = await VASCatalog.findOne({
        monthly_fee: item.unit_price,
      });

      if (vasInfo) {
        explanation.breakdown = `${vasInfo.name} servisi aylık ücret → ${item.unit_price} TL`;
        explanation.details = {
          service_name: vasInfo.name,
          provider: vasInfo.provider,
          category: vasInfo.category,
          monthly_fee: vasInfo.monthly_fee,
        };
        explanation.tips = [
          "Bu servisi kullanmıyorsanız iptal edebilirsiniz",
          "VAS hizmetlerini düzenli olarak gözden geçirin",
          `${vasInfo.provider} müşteri hizmetlerinden detay alabilirsiniz`,
        ];
      } else {
        explanation.breakdown = `VAS hizmeti aylık ücret → ${item.unit_price} TL`;
        explanation.tips = [
          "Bu VAS hizmetinin detayları için müşteri hizmetlerini arayın",
          "Gereksiz VAS hizmetlerini iptal edebilirsiniz",
        ];
      }
    } catch (error) {
      explanation.breakdown = `VAS hizmeti → ${item.amount} TL`;
    }

    return explanation;
  }

  /**
   * Roaming kalemini açıklar
   * @param {Object} item - Fatura kalemi
   * @param {Object} explanation - Açıklama objesi
   * @returns {Object} Roaming açıklaması
   */
  async explainRoamingItem(item, explanation) {
    if (item.subtype === "roaming_data") {
      explanation.breakdown = `Yurt dışında ${item.quantity}MB veri kullanımı → ${item.quantity}MB × ${item.unit_price} TL = ${item.amount} TL`;
      explanation.details = {
        roaming_mb: item.quantity,
        roaming_rate: item.unit_price,
        usage_date: item.created_at,
      };
      explanation.tips = [
        "Yurt dışına çıkmadan önce roaming paketlerini inceleyin",
        "Wifi kullanımını tercih edin",
        "Otomatik güncellemeleri kapatın",
        "Roaming ayarlarınızı kontrol edin",
      ];
    } else if (item.subtype === "roaming_voice") {
      explanation.breakdown = `Yurt dışında ${item.quantity} dakika konuşma → ${item.quantity}dk × ${item.unit_price} TL = ${item.amount} TL`;
      explanation.details = {
        roaming_minutes: item.quantity,
        roaming_rate: item.unit_price,
      };
      explanation.tips = [
        "Yurt dışı konuşma paketlerini değerlendirin",
        "WhatsApp Call gibi alternatif arama yöntemlerini kullanın",
      ];
    }

    return explanation;
  }

  /**
   * Kategori için özet oluşturur
   * @param {string} category - Kategori adı
   * @param {Array} items - Kategori kalemleri
   * @returns {string} Kategori özeti
   */
  generateCategorySummary(category, items) {
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const itemCount = items.length;

    switch (category) {
      case "premium_sms":
        const totalSMS = items.reduce(
          (sum, item) => sum + (item.quantity || 0),
          0
        );
        return `Toplam ${totalSMS} adet Premium SMS gönderildi, ${itemCount} farklı servisten ${totalAmount.toFixed(
          2
        )} TL ücret`;

      case "data":
        const overageItems = items.filter(
          (item) => item.subtype === "data_overage"
        );
        if (overageItems.length > 0) {
          const totalOverage = overageItems.reduce(
            (sum, item) => sum + (item.quantity || 0),
            0
          );
          return `${totalOverage}GB veri aşımı nedeniyle ${totalAmount.toFixed(
            2
          )} TL ek ücret`;
        }
        return `Veri kullanımı toplam ${totalAmount.toFixed(2)} TL`;

      case "voice":
        const voiceOverage = items.filter(
          (item) => item.subtype === "voice_overage"
        );
        if (voiceOverage.length > 0) {
          const totalMinutes = voiceOverage.reduce(
            (sum, item) => sum + (item.quantity || 0),
            0
          );
          return `${totalMinutes} dakika aşım nedeniyle ${totalAmount.toFixed(
            2
          )} TL ek ücret`;
        }
        return `Ses aramaları toplam ${totalAmount.toFixed(2)} TL`;

      case "vas":
        return `${itemCount} adet VAS hizmeti için toplam ${totalAmount.toFixed(
          2
        )} TL aylık ücret`;

      case "roaming":
        return `Yurt dışı kullanım için toplam ${totalAmount.toFixed(
          2
        )} TL ücret`;

      default:
        return `${itemCount} kalem, toplam ${totalAmount.toFixed(2)} TL`;
    }
  }

  /**
   * Gelişmiş doğal dil özeti oluşturur
   * @param {Object} bill - Fatura objesi
   * @param {Object} breakdown - Kategori dağılımı
   * @param {Object} stats - Kullanım istatistikleri
   * @returns {string} Gelişmiş özet
   */
  generateEnhancedSummary(bill, breakdown, stats) {
    let summary = `Bu ay ${bill.total_amount} TL fatura oluştu. `;

    // Kullanım özeti
    const usageParts = [];
    if (stats.total_gb > 0) usageParts.push(`${stats.total_gb}GB veri`);
    if (stats.total_minutes > 0)
      usageParts.push(`${stats.total_minutes}dk konuşma`);
    if (stats.total_sms > 0) usageParts.push(`${stats.total_sms} SMS`);

    if (usageParts.length > 0) {
      summary += `Toplam ${usageParts.join(", ")} kullandınız. `;
    }

    // En yüksek kategori analizi
    const sortedCategories = Object.entries(breakdown)
      .filter(([category]) => category !== "tax")
      .sort(([, a], [, b]) => b.total - a.total);

    if (sortedCategories.length > 0) {
      const [topCategory, topData] = sortedCategories[0];
      if (topData.percentage > 25) {
        summary += `Faturanızın %${topData.percentage}'i ${this.categoryNames[
          topCategory
        ].toLowerCase()} kaynaklı. `;
      }
    }

    // Özel durumlar
    if (stats.premium_sms_count > 5) {
      summary += `⚠️ ${stats.premium_sms_count} adet Premium SMS tespit edildi. `;
    }

    if (stats.roaming_mb > 0) {
      summary += `Yurt dışında ${stats.roaming_mb}MB veri kullanıldı. `;
    }

    // Aşım durumu
    const dataOverage = breakdown["data"]?.items?.find(
      (item) => item.subtype === "data_overage"
    );
    const voiceOverage = breakdown["voice"]?.items?.find(
      (item) => item.subtype === "voice_overage"
    );

    if (dataOverage || voiceOverage) {
      summary += "Plan kotanızı aştığınız için ek ücretler oluştu. ";
    }

    return summary.trim();
  }

  /**
   * Tasarruf ipucu oluşturur
   * @param {Object} bill - Fatura objesi
   * @param {Object} breakdown - Kategori dağılımı
   * @returns {Promise<string>} Tasarruf ipucu
   */
  async generateSavingsHint(bill, breakdown) {
    try {
      const hints = [];

      // Premium SMS kontrolü
      if (breakdown["premium_sms"] && breakdown["premium_sms"].total > 20) {
        hints.push(
          `Premium SMS bloke ederek ${breakdown["premium_sms"].total.toFixed(
            0
          )} TL tasarruf`
        );
      }

      // VAS kontrolü
      if (breakdown["vas"] && breakdown["vas"].total > 30) {
        hints.push(
          `Gereksiz VAS hizmetlerini iptal ederek ${breakdown[
            "vas"
          ].total.toFixed(0)} TL tasarruf`
        );
      }

      // Veri aşımı kontrolü
      if (breakdown["data"]) {
        const overageItem = breakdown["data"].items.find(
          (item) => item.subtype === "data_overage"
        );
        if (overageItem && overageItem.amount > 50) {
          hints.push(
            `Daha yüksek kotası olan plana geçerek aşım ücretlerinden tasarruf`
          );
        }
      }

      // Ses aşımı kontrolü
      if (breakdown["voice"]) {
        const voiceOverage = breakdown["voice"].items.find(
          (item) => item.subtype === "voice_overage"
        );
        if (voiceOverage && voiceOverage.amount > 30) {
          hints.push(`Dakika paketi ekleyerek aşım ücretlerinden tasarruf`);
        }
      }

      if (hints.length > 0) {
        return hints.join(" • ");
      }

      return "Mevcut kullanımınız optimize görünüyor";
    } catch (error) {
      return "Tasarruf analizi yapılamadı";
    }
  }

  /**
   * Etki seviyesini hesaplar
   * @param {number} percentage - Yüzde değeri
   * @returns {string} Etki seviyesi
   */
  calculateImpactLevel(percentage) {
    if (percentage >= 40) return "high";
    if (percentage >= 20) return "medium";
    if (percentage >= 10) return "low";
    return "minimal";
  }

  /**
   * Kategori için öneriler oluşturur
   * @param {string} category - Kategori adı
   * @param {Array} items - Kategori kalemleri
   * @returns {Array} Öneri listesi
   */
  getCategoryRecommendations(category, items) {
    const recommendations = [];
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    switch (category) {
      case "premium_sms":
        recommendations.push("Premium SMS bloğu aktifleştirin");
        if (totalAmount > 50) {
          recommendations.push("Acil olarak müşteri hizmetlerini arayın");
        }
        break;

      case "data":
        if (items.some((item) => item.subtype === "data_overage")) {
          recommendations.push("Daha yüksek kotası olan plana geçin");
          recommendations.push("Veri kullanım uyarılarını aktifleştirin");
        }
        break;

      case "voice":
        if (items.some((item) => item.subtype === "voice_overage")) {
          recommendations.push("Ek dakika paketlerini inceleyin");
          recommendations.push(
            "İnternet tabanlı arama uygulamalarını kullanın"
          );
        }
        break;

      case "vas":
        recommendations.push("Kullanmadığınız VAS hizmetlerini iptal edin");
        recommendations.push("VAS hizmetlerinizi düzenli gözden geçirin");
        break;

      case "roaming":
        recommendations.push(
          "Yurt dışı seyahatleriniz için roaming paketlerini inceleyin"
        );
        recommendations.push("WiFi kullanımını tercih edin");
        break;
    }

    return recommendations;
  }

  /**
   * Dönem formatlar
   * @param {Date} startDate - Başlangıç tarihi
   * @param {Date} endDate - Bitiş tarihi
   * @returns {string} Formatlanmış dönem
   */
  formatPeriod(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const months = [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık",
    ];

    return `${months[start.getMonth()]} ${start.getFullYear()}`;
  }

  /**
   * Belirli bir kategori için kullanım açıklaması döndürür
   * @param {string} billId - Fatura ID
   * @param {string} category - Kategori adı
   * @param {Object} options - Seçenekler (period, language)
   * @returns {Promise<Object>} Kategori açıklaması
   */
  async explainUsageCategory(billId, category, options = {}) {
    try {
      const { period, language = "tr" } = options;

      // Faturayı getir
      const bill = await BillService.getBillById(billId);
      if (!bill) {
        throw new Error(`Fatura bulunamadı: ${billId}`);
      }

      // Belirtilen kategoriye ait öğeleri filtrele
      const categoryItems = bill.items.filter(
        (item) =>
          item.category === category ||
          item.type === category ||
          item.description.toLowerCase().includes(category.toLowerCase())
      );

      if (categoryItems.length === 0) {
        throw new Error(`${category} kategorisinde kullanım bulunamadı`);
      }

      // Kategori totali
      const categoryTotal = categoryItems.reduce(
        (sum, item) => sum + item.amount,
        0
      );

      // Detaylı analiz
      const analysis = {
        category: category,
        category_name: this.categoryNames[category] || category,
        total_amount: categoryTotal,
        item_count: categoryItems.length,
        currency: bill.currency,
        period: bill.period_start.slice(0, 7), // YYYY-MM format
        items: categoryItems.map((item) => ({
          description: item.description,
          amount: item.amount,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || item.amount,
          date: item.date || bill.period_start,
          enhanced_description: this.enhanceDescription(item, language),
        })),
        insights: this.generateCategoryInsights(
          categoryItems,
          category,
          language
        ),
        recommendations: this.generateCategoryRecommendations(
          categoryItems,
          category,
          language
        ),
      };

      return analysis;
    } catch (error) {
      throw new Error(`Kategori açıklama hatası: ${error.message}`);
    }
  }

  /**
   * Maliyet açıklaması döndürür
   * @param {string} billId - Fatura ID
   * @param {Object} options - Seçenekler (focus_area, language)
   * @returns {Promise<Object>} Maliyet açıklaması
   */
  async explainCosts(billId, options = {}) {
    try {
      const { focus_area, language = "tr" } = options;

      // Faturayı getir
      const bill = await BillService.getBillById(billId);
      if (!bill) {
        throw new Error(`Fatura bulunamadı: ${billId}`);
      }

      // Temel maliyet analizi
      const costAnalysis = {
        bill_id: billId,
        total_amount: bill.total_amount,
        subtotal: bill.subtotal,
        taxes: bill.taxes,
        currency: bill.currency,
        period: bill.period_start.slice(0, 7),
        cost_breakdown: this.analyzeCostStructure(bill),
        major_contributors: this.findMajorCostContributors(bill, 3),
        cost_distribution: this.calculateCostDistribution(bill),
        savings_opportunities: this.identifySavingsOpportunities(
          bill,
          language
        ),
        cost_trends: await this.getCostTrends(
          bill.user_id,
          bill.period_start.slice(0, 7)
        ),
        detailed_explanation: this.generateCostExplanation(
          bill,
          focus_area,
          language
        ),
      };

      return costAnalysis;
    } catch (error) {
      throw new Error(`Maliyet açıklama hatası: ${error.message}`);
    }
  }

  /**
   * Kategori için içgörüler üretir
   * @param {Array} items - Kategori öğeleri
   * @param {string} category - Kategori
   * @param {string} language - Dil
   * @returns {Array} İçgörüler listesi
   */
  generateCategoryInsights(items, category, language = "tr") {
    const insights = [];
    const total = items.reduce((sum, item) => sum + item.amount, 0);

    if (category === "data" || category === "veri") {
      const dataItems = items.filter(
        (item) =>
          item.description.includes("MB") || item.description.includes("GB")
      );
      if (dataItems.length > 0) {
        insights.push(
          "Veri kullanımınızın büyük kısmı mobil internet ve uygulamalardan kaynaklanıyor"
        );
      }
    }

    if (category === "voice" || category === "ses") {
      const callItems = items.filter(
        (item) =>
          item.description.includes("dakika") ||
          item.description.includes("arama")
      );
      if (callItems.length > 0) {
        insights.push("Ses aramalarında paket dışı kullanım mevcut");
      }
    }

    if (total > 50) {
      insights.push(
        `${category} kategorisi faturanızda önemli bir paya sahip (${total.toFixed(
          2
        )} TL)`
      );
    }

    return insights;
  }

  /**
   * Kategori için öneriler üretir
   * @param {Array} items - Kategori öğeleri
   * @param {string} category - Kategori
   * @param {string} language - Dil
   * @returns {Array} Öneriler listesi
   */
  generateCategoryRecommendations(items, category, language = "tr") {
    const recommendations = [];
    const total = items.reduce((sum, item) => sum + item.amount, 0);

    if (category === "data" && total > 30) {
      recommendations.push(
        "Daha yüksek kotali bir veri paketi seçmeyi düşünebilirsiniz"
      );
    }

    if (category === "voice" && total > 20) {
      recommendations.push("Sınırsız konuşma paketi avantajlı olabilir");
    }

    if (category === "premium_sms" && total > 0) {
      recommendations.push("Premium SMS servislerini iptal etmeyi düşünün");
    }

    return recommendations;
  }

  /**
   * Maliyet yapısını analiz eder
   * @param {Object} bill - Fatura
   * @returns {Object} Maliyet yapısı
   */
  analyzeCostStructure(bill) {
    const structure = {
      fixed_costs: 0, // Aylık sabit ücretler
      variable_costs: 0, // Kullanıma bağlı ücretler
      one_time_costs: 0, // Tek seferlik ücretler
      taxes: bill.taxes || 0,
    };

    bill.items.forEach((item) => {
      if (
        item.category === "monthly_allowance" ||
        item.subtype === "monthly_allowance"
      ) {
        structure.fixed_costs += item.amount;
      } else if (item.category === "one_off" || item.subtype === "one_off") {
        structure.one_time_costs += item.amount;
      } else {
        structure.variable_costs += item.amount;
      }
    });

    return structure;
  }

  /**
   * En büyük maliyet kalemlerini bulur
   * @param {Object} bill - Fatura
   * @param {number} count - Döndürülecek öğe sayısı
   * @returns {Array} En büyük maliyet kalemleri
   */
  findMajorCostContributors(bill, count = 3) {
    return bill.items
      .sort((a, b) => b.amount - a.amount)
      .slice(0, count)
      .map((item) => ({
        description: item.description,
        amount: item.amount,
        percentage: ((item.amount / bill.subtotal) * 100).toFixed(1),
      }));
  }

  /**
   * Maliyet dağılımını hesaplar
   * @param {Object} bill - Fatura
   * @returns {Object} Maliyet dağılımı
   */
  calculateCostDistribution(bill) {
    const distribution = {};

    bill.items.forEach((item) => {
      const category = item.category || "other";
      if (!distribution[category]) {
        distribution[category] = { amount: 0, percentage: 0 };
      }
      distribution[category].amount += item.amount;
    });

    // Yüzdeleri hesapla
    Object.keys(distribution).forEach((category) => {
      distribution[category].percentage = (
        (distribution[category].amount / bill.subtotal) *
        100
      ).toFixed(1);
    });

    return distribution;
  }

  /**
   * Tasarruf fırsatlarını belirler
   * @param {Object} bill - Fatura
   * @param {string} language - Dil
   * @returns {Array} Tasarruf fırsatları
   */
  identifySavingsOpportunities(bill, language = "tr") {
    const opportunities = [];

    const highCostItems = bill.items.filter((item) => item.amount > 20);
    if (highCostItems.length > 0) {
      opportunities.push({
        type: "plan_optimization",
        description: "Plan optimizasyonu ile tasarruf sağlayabilirsiniz",
        potential_saving: "15-30 TL",
      });
    }

    const premiumSms = bill.items.filter(
      (item) => item.category === "premium_sms"
    );
    if (premiumSms.length > 0) {
      const premiumTotal = premiumSms.reduce(
        (sum, item) => sum + item.amount,
        0
      );
      opportunities.push({
        type: "premium_block",
        description: "Premium SMS'leri bloklatarak tasarruf sağlayabilirsiniz",
        potential_saving: `${premiumTotal.toFixed(2)} TL`,
      });
    }

    return opportunities;
  }

  /**
   * Maliyet trendlerini getirir
   * @param {number} userId - Kullanıcı ID
   * @param {string} currentPeriod - Mevcut dönem
   * @returns {Promise<Object>} Maliyet trendleri
   */
  async getCostTrends(userId, currentPeriod) {
    try {
      const bills = await BillService.getBillHistory(userId, 3);

      if (bills.length < 2) {
        return { message: "Trend analizi için yeterli veri yok" };
      }

      const trends = bills.map((bill) => ({
        period: bill.period_start.slice(0, 7),
        total: bill.total_amount,
        subtotal: bill.subtotal,
      }));

      const latestTotal = trends[0].total;
      const previousTotal = trends[1].total;
      const change = latestTotal - previousTotal;
      const changePercent = ((change / previousTotal) * 100).toFixed(1);

      return {
        trends,
        monthly_change: {
          amount: change.toFixed(2),
          percentage: changePercent,
          direction: change > 0 ? "increase" : "decrease",
        },
      };
    } catch (error) {
      return { message: "Trend verisi alınamadı" };
    }
  }

  /**
   * Detaylı maliyet açıklaması oluşturur
   * @param {Object} bill - Fatura
   * @param {string} focusArea - Odaklanılacak alan
   * @param {string} language - Dil
   * @returns {string} Açıklama metni
   */
  generateCostExplanation(bill, focusArea, language = "tr") {
    let explanation = `${bill.total_amount} TL tutarındaki faturanız `;

    if (bill.subtotal && bill.taxes) {
      explanation += `${bill.subtotal} TL hizmet bedeli ve ${bill.taxes} TL vergi içermektedir. `;
    }

    const majorCosts = this.findMajorCostContributors(bill, 2);
    if (majorCosts.length > 0) {
      explanation += `En büyük kalemler: ${majorCosts
        .map((item) => `${item.description} (${item.amount} TL)`)
        .join(", ")}. `;
    }

    if (focusArea) {
      const focusItems = bill.items.filter(
        (item) =>
          item.category === focusArea ||
          item.description.toLowerCase().includes(focusArea.toLowerCase())
      );

      if (focusItems.length > 0) {
        const focusTotal = focusItems.reduce(
          (sum, item) => sum + item.amount,
          0
        );
        explanation += `${focusArea} kategorisinde toplam ${focusTotal.toFixed(
          2
        )} TL ücret bulunmaktadır.`;
      }
    }

    return explanation;
  }
}

export default new ExplanationService();
