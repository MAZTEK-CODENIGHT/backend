import { Bill, UsageDaily } from "../model/index.js";

/**
 * AnomalyDetectionService - Anomali tespiti için sorumlu servis (Single Responsibility Principle)
 * Sadece anomali tespit etme işlemlerinden sorumludur
 */
class AnomalyDetectionService {
  constructor() {
    this.defaultThreshold = 0.8; // %80 artış eşiği
    this.zScoreThreshold = 2; // Z-score eşiği
    this.minimumHistoryMonths = 3; // Minimum geçmiş ay sayısı
  }

  /**
   * Kullanıcının faturasındaki anomalileri tespit eder
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - YYYY-MM formatında dönem
   * @param {number} threshold - Anomali eşiği (varsayılan: 0.8)
   * @returns {Promise<Object>} Anomali analiz sonuçları
   */
  async detectAnomalies(userId, period, threshold = this.defaultThreshold) {
    try {
      // Mevcut dönemi ve geçmiş faturaları al
      const currentBill = await Bill.findByUserAndPeriod(userId, period);
      if (!currentBill) {
        throw new Error("Mevcut dönem faturası bulunamadı");
      }

      const historicalBills = await this.getHistoricalBills(userId, period);

      // Kategori bazında anomali analizi
      const categoryAnomalies = await this.detectCategoryAnomalies(
        currentBill,
        historicalBills,
        threshold
      );

      // Yeni kalem anomalileri
      const newItemAnomalies = this.detectNewItemAnomalies(
        currentBill,
        historicalBills
      );

      // Roaming anomalileri
      const roamingAnomalies = await this.detectRoamingAnomalies(
        userId,
        period
      );

      // Kullanım pattern anomalileri
      const usageAnomalies = await this.detectUsagePatternAnomalies(
        userId,
        period
      );

      const allAnomalies = [
        ...categoryAnomalies,
        ...newItemAnomalies,
        ...roamingAnomalies,
        ...usageAnomalies,
      ];

      // Risk skoru hesapla
      const riskScore = this.calculateRiskScore(
        allAnomalies,
        currentBill.total_amount
      );

      return {
        anomalies: allAnomalies,
        total_anomalies: allAnomalies.length,
        risk_score: riskScore,
        analysis_period: period,
        comparison_months: historicalBills.length,
        threshold_used: threshold,
      };
    } catch (error) {
      throw new Error(`Anomali tespiti hatası: ${error.message}`);
    }
  }

  /**
   * Kategori bazında anomali tespiti yapar
   * @param {Object} currentBill - Mevcut fatura
   * @param {Array} historicalBills - Geçmiş faturalar
   * @param {number} threshold - Anomali eşiği
   * @returns {Array} Kategori anomalileri
   */
  async detectCategoryAnomalies(currentBill, historicalBills, threshold) {
    const anomalies = [];
    const categories = [
      "data",
      "voice",
      "sms",
      "premium_sms",
      "vas",
      "roaming",
      "monthly_fee",
      "data_overage",
      "voice_overage",
      "plan",
      "one_off",
      "discount",
    ];

    for (const category of categories) {
      try {
        const currentAmount = this.calculateCategoryTotal(
          currentBill,
          category
        );
        const historicalAmounts = historicalBills.map((bill) =>
          this.calculateCategoryTotal(bill, category)
        );

        if (historicalAmounts.length === 0) continue;

        const analysis = this.performStatisticalAnalysis(
          currentAmount,
          historicalAmounts
        );

        // Sadece bir anomali tipi ekle - önceliği Z-score'a ver
        let anomalyDetected = false;

        // Z-score anomalisi (daha güvenilir)
        if (Math.abs(analysis.zScore) > this.zScoreThreshold) {
          anomalies.push({
            type: "statistical",
            category,
            current_amount: currentAmount,
            historical_average: analysis.mean,
            delta: `${
              analysis.percentageChange > 0 ? "+" : ""
            }${analysis.percentageChange.toFixed(0)}%`,
            z_score: analysis.zScore.toFixed(2),
            severity: this.getSeverity(Math.abs(analysis.zScore)),
            reason: `Son ${
              historicalAmounts.length
            } ay ortalaması ${analysis.mean.toFixed(
              2
            )} TL iken bu ay ${currentAmount.toFixed(2)} TL`,
            suggested_action: this.getSuggestedAction(
              category,
              analysis.percentageChange
            ),
            first_occurrence: false,
          });
          anomalyDetected = true;
        }
        // Sadece Z-score anomalisi yoksa yüzde değişim kontrolü yap
        else if (analysis.percentageChange > threshold * 100) {
          anomalies.push({
            type: "percentage_increase",
            category,
            current_amount: currentAmount,
            historical_average: analysis.mean,
            delta: `+${analysis.percentageChange.toFixed(0)}%`,
            severity: this.getSeverityByPercentage(analysis.percentageChange),
            reason: `Önceki ortalama ${analysis.mean.toFixed(
              2
            )} TL iken bu ay ${currentAmount.toFixed(2)} TL`,
            suggested_action: this.getSuggestedAction(
              category,
              analysis.percentageChange
            ),
            first_occurrence: false,
          });
        }
      } catch (error) {
        console.warn(`${category} kategorisi analiz edilemedi:`, error.message);
      }
    }

    return anomalies;
  }

  /**
   * Yeni kalem anomalilerini tespit eder
   * @param {Object} currentBill - Mevcut fatura
   * @param {Array} historicalBills - Geçmiş faturalar
   * @returns {Array} Yeni kalem anomalileri
   */
  detectNewItemAnomalies(currentBill, historicalBills) {
    const anomalies = [];
    const categories = [
      "data",
      "voice",
      "sms",
      "premium_sms",
      "vas",
      "roaming",
    ];

    categories.forEach((category) => {
      const currentAmount = this.calculateCategoryTotal(currentBill, category);
      const historicalAmounts = historicalBills.map((bill) =>
        this.calculateCategoryTotal(bill, category)
      );

      // Eğer geçmişte hiç bu kategori yoksa ve şimdi varsa
      const hasHistoricalUsage = historicalAmounts.some((amount) => amount > 0);

      if (!hasHistoricalUsage && currentAmount > 0) {
        anomalies.push({
          type: "new_item",
          category,
          current_amount: currentAmount,
          historical_average: 0,
          delta: "YENİ",
          severity: currentAmount > 50 ? "high" : "medium",
          reason: "İlk kez görülen ücret kalemi",
          suggested_action: this.getSuggestedAction(category, "new"),
          first_occurrence: true,
        });
      }
    });

    return anomalies;
  }

  /**
   * Roaming anomalilerini tespit eder
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem
   * @returns {Promise<Array>} Roaming anomalileri
   */
  async detectRoamingAnomalies(userId, period) {
    const anomalies = [];

    try {
      // Bu ay roaming kullanımı
      const currentUsage = await this.getCurrentMonthRoamingUsage(
        userId,
        period
      );

      // Geçen ay roaming kullanımı
      const previousUsage = await this.getPreviousMonthRoamingUsage(
        userId,
        period
      );

      // Yeni roaming kullanımı kontrolü
      if (currentUsage.roaming_mb > 0 && previousUsage.roaming_mb === 0) {
        anomalies.push({
          type: "roaming_new",
          category: "roaming",
          current_amount: currentUsage.roaming_cost || 0,
          historical_average: 0,
          delta: "YENİ ROAMING",
          severity: "high",
          reason: "Yurt dışı kullanım tespit edildi",
          suggested_action: "Roaming paketlerini değerlendirin",
          first_occurrence: true,
          usage_details: {
            roaming_mb: currentUsage.roaming_mb,
            roaming_days: currentUsage.roaming_days,
          },
        });
      }

      // Aşırı roaming kullanımı
      if (currentUsage.roaming_mb > 1000) {
        // 1GB üzeri
        anomalies.push({
          type: "roaming_excessive",
          category: "roaming",
          current_amount: currentUsage.roaming_cost || 0,
          delta: `${currentUsage.roaming_mb}MB`,
          severity: "high",
          reason: `Yoğun yurt dışı veri kullanımı: ${currentUsage.roaming_mb}MB`,
          suggested_action: "Yurt dışı paketlerini inceleyin",
          first_occurrence: false,
        });
      }
    } catch (error) {
      console.warn("Roaming anomali analizi hatası:", error.message);
    }

    return anomalies;
  }

  /**
   * Kullanım pattern anomalilerini tespit eder
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem
   * @returns {Promise<Array>} Kullanım pattern anomalileri
   */
  async detectUsagePatternAnomalies(userId, period) {
    const anomalies = [];

    try {
      const dailyUsage = await this.getDailyUsageForPeriod(userId, period);

      if (dailyUsage.length === 0) return anomalies;

      // Günlük ortalama hesapla
      const avgDailyMB =
        dailyUsage.reduce((sum, day) => sum + day.mb_used, 0) /
        dailyUsage.length;

      // Aşırı günlük kullanım tespiti
      const highUsageDays = dailyUsage.filter(
        (day) => day.mb_used > avgDailyMB * 3
      );

      if (highUsageDays.length > 0) {
        const maxUsageDay = highUsageDays.reduce((max, day) =>
          day.mb_used > max.mb_used ? day : max
        );

        anomalies.push({
          type: "usage_spike",
          category: "data",
          delta: `${maxUsageDay.mb_used}MB`,
          severity: "medium",
          reason: `${new Date(maxUsageDay.usage_date).toLocaleDateString(
            "tr-TR"
          )} tarihinde normalin 3 katı veri kullanımı`,
          suggested_action: "Veri kullanım alışkanlıklarınızı gözden geçirin",
          first_occurrence: false,
          usage_details: {
            max_usage_mb: maxUsageDay.mb_used,
            average_mb: avgDailyMB.toFixed(0),
            spike_date: maxUsageDay.usage_date,
          },
        });
      }
    } catch (error) {
      console.warn("Kullanım pattern analizi hatası:", error.message);
    }

    return anomalies;
  }

  /**
   * İstatistiksel analiz yapar
   * @param {number} currentValue - Mevcut değer
   * @param {Array} historicalValues - Geçmiş değerler
   * @returns {Object} İstatistiksel analiz sonuçları
   */
  performStatisticalAnalysis(currentValue, historicalValues) {
    const mean =
      historicalValues.reduce((sum, val) => sum + val, 0) /
      historicalValues.length;
    const variance =
      historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      historicalValues.length;
    const stdDev = Math.sqrt(variance);

    const zScore = stdDev > 0 ? (currentValue - mean) / stdDev : 0;
    const percentageChange =
      mean > 0 ? ((currentValue - mean) / mean) * 100 : 0;

    return {
      mean,
      stdDev,
      zScore,
      percentageChange,
      variance,
    };
  }

  /**
   * Belirli kategorideki toplam tutarı hesaplar
   * @param {Object} bill - Fatura objesi
   * @param {string} category - Kategori adı
   * @returns {number} Kategori toplamı
   */
  calculateCategoryTotal(bill, category) {
    return bill.items
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + item.amount, 0);
  }

  /**
   * Geçmiş faturaları getirir
   * @param {number} userId - Kullanıcı ID
   * @param {string} currentPeriod - Mevcut dönem
   * @returns {Promise<Array>} Geçmiş faturalar
   */
  async getHistoricalBills(userId, currentPeriod) {
    try {
      const currentDate = new Date(currentPeriod + "-01");
      const startDate = new Date(currentDate);
      startDate.setMonth(startDate.getMonth() - this.minimumHistoryMonths);

      const bills = await Bill.find({
        user_id: userId,
        period_start: {
          $gte: startDate,
          $lt: currentDate,
        },
      }).sort({ period_start: -1 });

      return bills;
    } catch (error) {
      throw new Error(`Geçmiş fatura getirme hatası: ${error.message}`);
    }
  }

  /**
   * Mevcut ayın roaming kullanımını getirir
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem
   * @returns {Promise<Object>} Roaming kullanım bilgisi
   */
  async getCurrentMonthRoamingUsage(userId, period) {
    try {
      const startDate = new Date(period + "-01");
      const endDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        0
      );

      const usage = await UsageDaily.find({
        user_id: userId,
        usage_date: { $gte: startDate, $lte: endDate },
      });

      const totalRoamingMB = usage.reduce(
        (sum, day) => sum + (day.roaming_mb || 0),
        0
      );
      const roamingDays = usage.filter((day) => day.roaming_mb > 0).length;

      return {
        roaming_mb: totalRoamingMB,
        roaming_days: roamingDays,
        roaming_cost: totalRoamingMB * 0.5, // Örnek roaming ücreti
      };
    } catch (error) {
      return { roaming_mb: 0, roaming_days: 0, roaming_cost: 0 };
    }
  }

  /**
   * Önceki ayın roaming kullanımını getirir
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem
   * @returns {Promise<Object>} Önceki ay roaming kullanım bilgisi
   */
  async getPreviousMonthRoamingUsage(userId, period) {
    try {
      const currentDate = new Date(period + "-01");
      const previousDate = new Date(currentDate);
      previousDate.setMonth(previousDate.getMonth() - 1);

      const previousPeriod = `${previousDate.getFullYear()}-${String(
        previousDate.getMonth() + 1
      ).padStart(2, "0")}`;

      return await this.getCurrentMonthRoamingUsage(userId, previousPeriod);
    } catch (error) {
      return { roaming_mb: 0, roaming_days: 0, roaming_cost: 0 };
    }
  }

  /**
   * Belirli dönemdeki günlük kullanımları getirir
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem
   * @returns {Promise<Array>} Günlük kullanım verileri
   */
  async getDailyUsageForPeriod(userId, period) {
    try {
      const startDate = new Date(period + "-01");
      const endDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        0
      );

      const usage = await UsageDaily.find({
        user_id: userId,
        usage_date: { $gte: startDate, $lte: endDate },
      }).sort({ usage_date: 1 });

      return usage;
    } catch (error) {
      return [];
    }
  }

  /**
   * Z-score'a göre önem derecesi belirler
   * @param {number} zScore - Z-score değeri
   * @returns {string} Önem derecesi
   */
  getSeverity(zScore) {
    if (zScore >= 3) return "high";
    if (zScore >= 2) return "medium";
    return "low";
  }

  /**
   * Yüzde değişime göre önem derecesi belirler
   * @param {number} percentage - Yüzde değişim
   * @returns {string} Önem derecesi
   */
  getSeverityByPercentage(percentage) {
    if (percentage >= 200) return "high";
    if (percentage >= 100) return "medium";
    return "low";
  }

  /**
   * Kategoriye göre önerilen aksiyon belirler
   * @param {string} category - Kategori adı
   * @param {number|string} change - Değişim miktarı
   * @returns {string} Önerilen aksiyon
   */
  getSuggestedAction(category, change) {
    const actions = {
      premium_sms: "Premium SMS bloklamasını düşünün",
      vas: "VAS hizmetlerini gözden geçirin",
      roaming: "Roaming paketlerini değerlendirin",
      data: "Veri kullanım alışkanlıklarınızı inceleyin",
      voice: "Ses paketi seçeneklerini değerlendirin",
      sms: "SMS paketi eklemeyi düşünün",
    };

    if (change === "new") {
      return `Yeni ${category} ücreti için müşteri hizmetlerini arayın`;
    }

    return actions[category] || "Detaylı inceleme önerilir";
  }

  /**
   * Genel risk skoru hesaplar
   * @param {Array} anomalies - Anomali listesi
   * @param {number} totalAmount - Toplam fatura tutarı
   * @returns {number} Risk skoru (0-10 arası)
   */
  calculateRiskScore(anomalies, totalAmount) {
    if (anomalies.length === 0) return 0;

    let score = 0;

    anomalies.forEach((anomaly) => {
      // Önem derecesine göre puan
      switch (anomaly.severity) {
        case "high":
          score += 3;
          break;
        case "medium":
          score += 2;
          break;
        case "low":
          score += 1;
          break;
      }

      // Yeni kalem bonus puanı
      if (anomaly.first_occurrence) {
        score += 1;
      }

      // Kritik kategoriler için bonus puan
      if (["premium_sms", "roaming"].includes(anomaly.category)) {
        score += 1;
      }
    });

    // Fatura tutarına göre normalize et
    if (totalAmount > 500) score += 1;
    if (totalAmount > 1000) score += 2;

    return Math.min(10, score); // Maximum 10
  }

  /**
   * Detaylı anomali analizi döndürür
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem (YYYY-MM)
   * @param {Object} options - Analiz seçenekleri
   * @returns {Promise<Object>} Detaylı analiz sonucu
   */
  async getDetailedAnalysis(userId, period, options = {}) {
    try {
      const { include_explanations = true, include_recommendations = true } =
        options;

      // Temel anomali tespiti
      const basicAnomalies = await this.detectAnomalies(userId, period);

      // Detaylı analiz
      const analysis = {
        ...basicAnomalies,
        detailed_insights: include_explanations
          ? await this.generateDetailedInsights(
              basicAnomalies.anomalies,
              userId,
              period
            )
          : null,
        actionable_recommendations: include_recommendations
          ? await this.generateActionableRecommendations(
              basicAnomalies.anomalies,
              userId
            )
          : null,
        trend_analysis: await this.analyzeTrends(userId, period),
        cost_impact_analysis: this.analyzeCostImpact(basicAnomalies.anomalies),
        prevention_strategies: this.generatePreventionStrategies(
          basicAnomalies.anomalies
        ),
        risk_assessment: {
          overall_risk: basicAnomalies.risk_score,
          financial_risk: this.calculateFinancialRisk(basicAnomalies.anomalies),
          usage_pattern_risk: this.assessUsagePatternRisk(
            basicAnomalies.anomalies
          ),
          trend_risk: await this.assessTrendRisk(userId, period),
        },
      };

      return analysis;
    } catch (error) {
      throw new Error(`Detaylı analiz hatası: ${error.message}`);
    }
  }

  /**
   * Kullanıcının anomali geçmişini döndürür
   * @param {number} userId - Kullanıcı ID
   * @param {number} months - Kaç aylık geçmiş
   * @returns {Promise<Array>} Anomali geçmişi
   */
  async getAnomalyHistory(userId, months = 6) {
    try {
      const history = [];
      const currentDate = new Date();

      for (let i = 0; i < months; i++) {
        const targetDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - i,
          1
        );
        const period = `${targetDate.getFullYear()}-${String(
          targetDate.getMonth() + 1
        ).padStart(2, "0")}`;

        try {
          const anomalies = await this.detectAnomalies(userId, period, 0.7); // Daha düşük threshold

          history.push({
            period,
            anomaly_count: anomalies.total_anomalies,
            risk_score: anomalies.risk_score,
            major_anomalies: anomalies.anomalies.filter(
              (a) => a.severity === "high"
            ),
            summary: this.generatePeriodSummary(anomalies.anomalies, period),
          });
        } catch (error) {
          // Veri yoksa boş kayıt ekle
          history.push({
            period,
            anomaly_count: 0,
            risk_score: 0,
            major_anomalies: [],
            summary: "Veri bulunamadı",
          });
        }
      }

      return history.filter(
        (h) => h.anomaly_count > 0 || h.summary !== "Veri bulunamadı"
      );
    } catch (error) {
      throw new Error(`Anomali geçmişi hatası: ${error.message}`);
    }
  }

  /**
   * Detaylı içgörüler üretir
   * @param {Array} anomalies - Anomali listesi
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem
   * @returns {Promise<Array>} Detaylı içgörüler
   */
  async generateDetailedInsights(anomalies, userId, period) {
    const insights = [];

    // Kategori bazlı gruplandırma
    const categoryGroups = {};
    anomalies.forEach((anomaly) => {
      if (!categoryGroups[anomaly.category]) {
        categoryGroups[anomaly.category] = [];
      }
      categoryGroups[anomaly.category].push(anomaly);
    });

    // Her kategori için içgörü
    for (const [category, categoryAnomalies] of Object.entries(
      categoryGroups
    )) {
      const totalDelta = categoryAnomalies.reduce(
        (sum, a) => sum + Math.abs(a.delta),
        0
      );

      insights.push({
        category,
        insight_type: "category_analysis",
        message: `${category} kategorisinde ${categoryAnomalies.length} anomali tespit edildi`,
        details: {
          total_deviation: totalDelta.toFixed(2),
          anomaly_count: categoryAnomalies.length,
          severity_distribution:
            this.getSeverityDistribution(categoryAnomalies),
        },
      });
    }

    // Trend içgörüleri
    const trendInsight = await this.analyzeTrendInsights(userId, period);
    if (trendInsight) {
      insights.push(trendInsight);
    }

    return insights;
  }

  /**
   * Uygulanabilir öneriler üretir
   * @param {Array} anomalies - Anomali listesi
   * @param {number} userId - Kullanıcı ID
   * @returns {Promise<Array>} Öneriler
   */
  async generateActionableRecommendations(anomalies, userId) {
    const recommendations = [];

    // Yüksek öncelikli anomaliler için öneriler
    const highSeverityAnomalies = anomalies.filter(
      (a) => a.severity === "high"
    );

    for (const anomaly of highSeverityAnomalies) {
      recommendations.push({
        priority: "high",
        category: anomaly.category,
        action: anomaly.suggested_action,
        expected_impact: `${Math.abs(anomaly.delta).toFixed(2)} TL tasarruf`,
        implementation: this.getImplementationSteps(anomaly.category),
        timeline: "Bu ay içinde",
      });
    }

    // Genel öneriler
    if (anomalies.length > 3) {
      recommendations.push({
        priority: "medium",
        category: "general",
        action: "Tüm hizmetleri gözden geçirin",
        expected_impact: "Genel maliyet optimizasyonu",
        implementation: [
          "Müşteri hizmetlerini arayın",
          "Plan seçeneklerini inceleyin",
        ],
        timeline: "2-4 hafta",
      });
    }

    return recommendations;
  }

  /**
   * Trend analizi yapar
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem
   * @returns {Promise<Object>} Trend analizi
   */
  async analyzeTrends(userId, period) {
    try {
      // Son 3 ayın anomali verilerini al
      const history = await this.getAnomalyHistory(userId, 3);

      if (history.length < 2) {
        return { message: "Trend analizi için yeterli veri yok" };
      }

      const riskScores = history.map((h) => h.risk_score);
      const anomalyCounts = history.map((h) => h.anomaly_count);

      return {
        risk_trend: this.calculateTrend(riskScores),
        anomaly_count_trend: this.calculateTrend(anomalyCounts),
        patterns: this.identifyPatterns(history),
        prediction: this.predictNextPeriod(history),
      };
    } catch (error) {
      return { message: "Trend analizi yapılamadı" };
    }
  }

  /**
   * Maliyet etkisi analizi
   * @param {Array} anomalies - Anomali listesi
   * @returns {Object} Maliyet etkisi
   */
  analyzeCostImpact(anomalies) {
    const totalImpact = anomalies.reduce(
      (sum, a) => sum + Math.abs(a.delta),
      0
    );
    const positiveImpact = anomalies
      .filter((a) => a.delta > 0)
      .reduce((sum, a) => sum + a.delta, 0);
    const negativeImpact = anomalies
      .filter((a) => a.delta < 0)
      .reduce((sum, a) => sum + Math.abs(a.delta), 0);

    return {
      total_impact: totalImpact.toFixed(2),
      cost_increase: positiveImpact.toFixed(2),
      cost_decrease: negativeImpact.toFixed(2),
      net_impact: (positiveImpact - negativeImpact).toFixed(2),
      impact_categories: this.categorizeImpacts(anomalies),
    };
  }

  /**
   * Önleme stratejileri üretir
   * @param {Array} anomalies - Anomali listesi
   * @returns {Array} Önleme stratejileri
   */
  generatePreventionStrategies(anomalies) {
    const strategies = [];

    const categories = [...new Set(anomalies.map((a) => a.category))];

    categories.forEach((category) => {
      switch (category) {
        case "data":
          strategies.push({
            category,
            strategy: "Veri kullanım uyarıları ayarlayın",
            implementation: "Cihaz ayarlarından veri limitlerini aktifleştirin",
          });
          break;
        case "premium_sms":
          strategies.push({
            category,
            strategy: "Premium SMS bloğu aktifleştirin",
            implementation: "Operatörü arayarak premium servisleri bloklatın",
          });
          break;
        case "roaming":
          strategies.push({
            category,
            strategy: "Yurt dışı paketlerini önceden alın",
            implementation: "Seyahat öncesi roaming paketlerini aktifleştirin",
          });
          break;
        default:
          strategies.push({
            category,
            strategy: "Düzenli kullanım takibi yapın",
            implementation: "Aylık kullanım raporlarını inceleyin",
          });
      }
    });

    return strategies;
  }

  /**
   * Finansal risk hesaplar
   * @param {Array} anomalies - Anomali listesi
   * @returns {Object} Finansal risk
   */
  calculateFinancialRisk(anomalies) {
    const highRiskAnomalies = anomalies.filter((a) => a.severity === "high");
    const potentialCost = highRiskAnomalies.reduce(
      (sum, a) => sum + Math.abs(a.delta),
      0
    );

    return {
      level:
        potentialCost > 100 ? "high" : potentialCost > 50 ? "medium" : "low",
      potential_monthly_cost: potentialCost.toFixed(2),
      risk_factors: highRiskAnomalies.map((a) => a.category),
    };
  }

  /**
   * Kullanım pattern riski değerlendirir
   * @param {Array} anomalies - Anomali listesi
   * @returns {Object} Pattern riski
   */
  assessUsagePatternRisk(anomalies) {
    const newUsages = anomalies.filter((a) => a.first_occurrence);
    const recurringAnomalies = anomalies.filter((a) => !a.first_occurrence);

    return {
      new_usage_risk:
        newUsages.length > 2 ? "high" : newUsages.length > 0 ? "medium" : "low",
      recurring_pattern_risk:
        recurringAnomalies.length > 3
          ? "high"
          : recurringAnomalies.length > 1
          ? "medium"
          : "low",
      pattern_insights: this.analyzeUsagePatterns(anomalies),
    };
  }

  /**
   * Trend riski değerlendirir
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem
   * @returns {Promise<Object>} Trend riski
   */
  async assessTrendRisk(userId, period) {
    try {
      const trends = await this.analyzeTrends(userId, period);

      if (trends.message) {
        return { level: "unknown", reason: trends.message };
      }

      const riskLevel =
        trends.risk_trend === "increasing"
          ? "high"
          : trends.risk_trend === "stable"
          ? "medium"
          : "low";

      return {
        level: riskLevel,
        trend_direction: trends.risk_trend,
        prediction: trends.prediction,
      };
    } catch (error) {
      return { level: "unknown", reason: "Trend analizi yapılamadı" };
    }
  }

  // Yardımcı metodlar

  generatePeriodSummary(anomalies, period) {
    if (anomalies.length === 0) return "Anomali tespit edilmedi";

    const highSeverity = anomalies.filter((a) => a.severity === "high").length;
    if (highSeverity > 0) {
      return `${highSeverity} yüksek riskli anomali tespit edildi`;
    }

    return `${anomalies.length} anomali tespit edildi`;
  }

  getSeverityDistribution(anomalies) {
    const distribution = { high: 0, medium: 0, low: 0 };
    anomalies.forEach((a) => distribution[a.severity]++);
    return distribution;
  }

  getImplementationSteps(category) {
    const steps = {
      premium_sms: [
        "Operatörü arayın",
        "Premium SMS bloğu isteyin",
        "Onay SMS'ini bekleyin",
      ],
      data: [
        "Veri kullanım ayarlarını açın",
        "Günlük limitler ayarlayın",
        "Uyarıları aktifleştirin",
      ],
      roaming: [
        "Yurt dışı paketlerini inceleyin",
        "Uygun paketi seçin",
        "Seyahat öncesi aktifleştirin",
      ],
    };
    return (
      steps[category] || [
        "Müşteri hizmetlerini arayın",
        "Seçenekleri değerlendirin",
      ]
    );
  }

  calculateTrend(values) {
    if (values.length < 2) return "insufficient_data";

    const recent = values[0];
    const previous = values[1];

    if (recent > previous * 1.1) return "increasing";
    if (recent < previous * 0.9) return "decreasing";
    return "stable";
  }

  identifyPatterns(history) {
    // Basit pattern tanıma
    const patterns = [];

    const highRiskPeriods = history.filter((h) => h.risk_score > 6).length;
    if (highRiskPeriods > history.length * 0.5) {
      patterns.push("Sürekli yüksek risk");
    }

    const increasingTrend = history.every(
      (h, i) => i === 0 || h.risk_score >= history[i - 1].risk_score
    );
    if (increasingTrend) {
      patterns.push("Artan risk trendi");
    }

    return patterns;
  }

  predictNextPeriod(history) {
    const avgRisk =
      history.reduce((sum, h) => sum + h.risk_score, 0) / history.length;
    const recentRisk = history[0].risk_score;

    if (recentRisk > avgRisk * 1.2) {
      return { risk_level: "high", confidence: "medium" };
    } else if (recentRisk < avgRisk * 0.8) {
      return { risk_level: "low", confidence: "medium" };
    }

    return { risk_level: "medium", confidence: "low" };
  }

  categorizeImpacts(anomalies) {
    const categories = {};

    anomalies.forEach((anomaly) => {
      if (!categories[anomaly.category]) {
        categories[anomaly.category] = { count: 0, total_impact: 0 };
      }
      categories[anomaly.category].count++;
      categories[anomaly.category].total_impact += Math.abs(anomaly.delta);
    });

    return categories;
  }

  analyzeTrendInsights(userId, period) {
    // Bu metod gerçek implementasyonda daha karmaşık olacak
    return {
      insight_type: "trend_analysis",
      message: "Trend analizi tamamlandı",
      details: "Detaylı trend verisi",
    };
  }

  analyzeUsagePatterns(anomalies) {
    const patterns = [];

    const categories = [...new Set(anomalies.map((a) => a.category))];
    if (categories.includes("premium_sms") && categories.includes("vas")) {
      patterns.push("Premium hizmet kullanım eğilimi");
    }

    return patterns;
  }
}

export default new AnomalyDetectionService();
