# 🚀 Turkcell Fatura Asistanı - Backend API

**Hackathon:** Codenight Case - 7 saatlik geliştirme süreci  
**Platform:** Node.js + Express + MongoDB  
**Deployment:** Local Development (localhost:2020)

> **🚀 Tamamlanmış Versiyon:** Bu projenin bitirilmiş versiyonu [feat branch'inde](https://github.com/MAZTEK-CODENIGHT/backend/tree/feat) bulunmaktadır. **Bu versiyon [Muhammet Aydın](https://github.com/muhammetaydinn) tarafından geliştirilmiştir.**

> **Şeffaf Fatura Açıklayıcı, Anomali Avcısı ve What-If Simülatörü**

## 📋 Proje Özeti

Turkcell müşterilerinin aylık faturasını **kalem kalem açıklayan**, beklenmedik ücretleri **tespit eden** ve **"başka paket/seçenekle olsaydı ne olurdu?"** sorusuna yanıt veren akıllı fatura analiz sistemi.

### 🎯 Ana Özellikler

- ✅ **Açıklanabilir Fatura:** Fatura kalemlerini kategori bazlı açıklama
- ✅ **Anomali Tespiti:** İstatistiksel analiz ile beklenmedik ücret tespiti
- ✅ **What-If Simülatörü:** Alternatif plan/paket senaryolarında maliyet hesaplama
- ✅ **Tasarruf Önerileri:** En uygun maliyetli seçenekleri sıralama
- ✅ **Mock Checkout:** Değişiklikleri uygulama simülasyonu

### 🚀 Demo Senaryosu

```
1. Kullanıcı faturasını açar → Anomali görür ⚠️
2. "Premium SMS 225% arttı" bilgisini inceler 📊
3. What-If ile farklı planları karşılaştırır 🔄
4. En iyi seçeneği uygular → 87 TL tasarruf! 💰
```

---

## 🏗️ Mimari ve Teknoloji Stack

### Backend Stack

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js
- **Database:** MongoDB + Mongoose ODM
- **Development:** Nodemon (hot reload)
- **CORS:** Cross-origin resource sharing enabled

### Proje Yapısı

```
backend/
├── app/app.js              # Express app konfigürasyonu
├── server.js               # Server entry point
├── config/dbConnect.js     # MongoDB bağlantısı
├── model/                  # Mongoose şemaları
│   ├── User.js
│   ├── Bill.js
│   ├── Plan.js
│   └── ...
├── controller/             # Business logic
│   ├── BillController.js
│   ├── AnomalyController.js
│   ├── WhatIfController.js
│   └── ...
├── services/               # Core algorithms
│   ├── AnomalyDetectionService.js
│   ├── ExplanationService.js
│   ├── WhatIfService.js
│   └── ...
├── routes/                 # API endpoints
│   ├── billRoutes.js
│   ├── anomalyRoutes.js
│   ├── whatIfRoutes.js
│   └── ...
└── middlewares/            # Error handling & logging
```

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler

- Node.js (v18+)
- MongoDB (local/cloud)
- npm/yarn

### Hızlı Başlangıç

```bash
# Repository clone
git clone <repo-url>
cd backend

# Dependencies install
npm install

# Development server başlat
npm start
```

Server: `http://localhost:2020`

### Environment Variables (.env)

```env
PORT=2020
MONGO_URI=mongodb://localhost:27017/fatura_asistani
NODE_ENV=development
```

---

## 📊 Veri Modeli ve MongoDB Schema

### Core Collections

#### Users

```javascript
{
  user_id: Number,        // Unique ID
  name: String,          // "Ahmet Yılmaz"
  msisdn: String,        // "5551234567"
  current_plan_id: Number,
  type: String,          // "postpaid"
  active_vas: [String],  // ["VAS001"]
  active_addons: [Number] // [101, 102]
}
```

#### Bills

```javascript
{
  bill_id: String,       // "BILL_1001_202507"
  user_id: Number,
  period_start: Date,    // "2025-07-01"
  period_end: Date,      // "2025-07-31"
  total_amount: Number,  // 189.50
  items: [{
    category: String,    // "premium_sms", "data", "voice"
    subtype: String,     // "premium_3rdparty", "data_overage"
    description: String, // "3838 numarasına Premium SMS"
    amount: Number,      // 59.85
    quantity: Number,    // 15
    unit_price: Number   // 3.99
  }]
}
```

#### Plans

```javascript
{
  plan_id: Number,       // 2
  plan_name: String,     // "Süper Online 20GB"
  quota_gb: Number,      // 20
  quota_min: Number,     // 1000
  monthly_price: Number, // 129.00
  overage_gb: Number     // 8.50
}
```

### Sample Mock Data

Projede 3 kullanıcı, 6+ plan, anomali içeren faturalar ve gerçekçi kullanım verileri bulunmaktadır.

---

## 🔗 API Endpoints ve Kullanım

### Base URL: `http://localhost:2020/api`

### 👤 Kullanıcı Yönetimi

```http
GET /api/users                    # Tüm kullanıcıları listele
GET /api/users/{user_id}          # Kullanıcı detayı
```

### 📄 Fatura İşlemleri

```http
GET /api/bills/{user_id}?period=2025-07    # Dönemlik fatura
GET /api/bills/{user_id}/history           # Fatura geçmişi
```

### 💡 Fatura Açıklama (Explainability)

```http
POST /api/explain
Content-Type: application/json
{
  "bill_id": "BILL_1001_202507"
}

Response:
{
  "summary": {
    "total": 189.50,
    "savings_hint": "Alternatif planla 87 TL tasarruf mümkün"
  },
  "breakdown": [
    {
      "category": "premium_sms",
      "total": 59.85,
      "lines": ["3838 numarasına 15×Premium SMS → 15×3.99 TL"]
    }
  ]
}
```

### ⚠️ Anomali Tespiti

```http
POST /api/anomalies
{
  "user_id": 1001,
  "period": "2025-07"
}

Response:
{
  "anomalies": [
    {
      "category": "premium_sms",
      "delta": "+225%",
      "reason": "Son 3 ay ortalaması 18.42 TL iken bu ay 59.85 TL",
      "suggested_action": "Premium SMS bloklama önerilir"
    }
  ],
  "risk_score": 7.8
}
```

### 🔄 What-If Simülatörü

```http
POST /api/whatif
{
  "user_id": 1001,
  "period": "2025-07",
  "scenario": {
    "plan_id": 3,
    "addons": [101],
    "disable_vas": true,
    "block_premium_sms": true
  }
}

Response:
{
  "current_total": 189.50,
  "new_total": 102.45,
  "saving": 87.05,
  "saving_percent": 45.9,
  "details": [
    "Plan değişikliği: Premium 30GB → +179.00 TL",
    "Premium SMS bloke → -59.85 TL",
    "VAS iptali → -9.90 TL"
  ]
}
```

### 🛒 Mock Checkout

```http
POST /api/checkout
{
  "user_id": 1001,
  "actions": [
    {"type": "change_plan", "payload": {"plan_id": 3}},
    {"type": "block_premium_sms", "payload": {"enable": true}}
  ]
}

Response:
{
  "order_id": "MOCK-FT-20250818-001",
  "total_saving": 87.05,
  "next_bill_estimate": 102.45
}
```

### 📖 Katalog

```http
GET /api/catalog                  # Plans, Add-ons, VAS listesi
GET /api/health                   # API health check
GET /api/info                     # API bilgileri
```

---

## 🧮 Core Algorithms

### 1. Anomali Tespit Algoritması

```javascript
// Z-score + Percentage change hybrid approach
const detectAnomalies = (current, historical) => {
  const mean = historical.reduce((sum, val) => sum + val) / historical.length;
  const stdDev = calculateStdDev(historical, mean);
  const zScore = (current - mean) / stdDev;
  const percentageChange = ((current - mean) / mean) * 100;

  // Anomali kriterler:
  // 1. Z-score > 2 (istatistiksel sapma)
  // 2. % değişim > 80% (eşik değer)
  // 3. İlk kez görülen kalem (historical mean = 0)

  return {
    isAnomaly: zScore > 2 || percentageChange > 80,
    severity: percentageChange > 150 ? 'high' : 'medium',
    delta: `+${percentageChange.toFixed(0)}%`,
  };
};
```

### 2. What-If Hesaplama Motoru

```javascript
const calculateWhatIf = (usage, newPlan, addons, options) => {
  let newTotal = newPlan.monthly_price;

  // Veri aşımı hesabı
  const effectiveQuota =
    newPlan.quota_gb + addons.reduce((sum, addon) => sum + addon.extra_gb, 0);
  const dataOverage = Math.max(0, usage.total_gb - effectiveQuota);
  newTotal += dataOverage * newPlan.overage_gb;

  // Premium SMS bloke
  if (options.block_premium_sms) {
    newTotal -= getCurrentPremiumSMSCost(usage);
  }

  // VAS iptal
  if (options.disable_vas) {
    newTotal -= getCurrentVASCost(usage);
  }

  return {
    newTotal: newTotal * 1.2, // KDV dahil
    saving: currentTotal - newTotal,
  };
};
```

### 3. Fatura Açıklama Sistemi

```javascript
const explainBill = billItems => {
  // Kategori bazlı gruplama
  const breakdown = billItems.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || { total: 0, lines: [] };
    acc[item.category].total += item.amount;
    acc[item.category].lines.push(generateExplanation(item));
    return acc;
  }, {});

  // Doğal dil açıklaması
  const naturalLanguage = generateNaturalLanguageExplanation(breakdown);

  return { breakdown, naturalLanguage };
};
```

---

## 🧪 Test ve Validation

### Manuel Test Komutları

```bash
# Health check
curl http://localhost:2020/api/health

# Kullanıcı listesi
curl http://localhost:2020/api/users

# Fatura getir
curl "http://localhost:2020/api/bills/1001?period=2025-07"

# Anomali tespit et
curl -X POST http://localhost:2020/api/anomalies \
  -H "Content-Type: application/json" \
  -d '{"user_id":1001,"period":"2025-07"}'

# What-if simülasyonu
curl -X POST http://localhost:2020/api/whatif \
  -H "Content-Type: application/json" \
  -d '{"user_id":1001,"period":"2025-07","scenario":{"plan_id":3,"disable_vas":true}}'
```

### Mock Veri Testi

```bash
npm run test-models  # Model validasyonları ve sample data
```

---

## 🏆 Hackathon Case Uyumluluğu

### ✅ Case Gereksinimleri Karşılanması

1. **✅ Profil & Fatura Seçimi:** User selection + period filtering
2. **✅ Açıklanabilir Fatura:** Category breakdown + natural language
3. **✅ Anomali Tespiti:** Statistical analysis + rules-based detection
4. **✅ What-If Simülatörü:** Multi-scenario cost calculation
5. **✅ Mock Akışlar:** Checkout simulation with order ID
6. **✅ 3 dakikalık demo:** API ready for frontend integration

### 📊 Demo Data Set

- **3 kullanıcı** (farklı plan türleri)
- **Anomali içeren Temmuz 2025 faturası** (Premium SMS +225% artış)
- **6 farklı plan** + 5 ek paket + 4 VAS + Premium SMS katalog
- **What-If senaryoları:** Plan değişimi, ek paket, VAS iptal kombinasyonları

### 🎯 Jüri Değerlendirme Kriterleri

- **Teknical Excellence:** Clean architecture, SOLID principles
- **Innovation:** Hybrid anomaly detection, multi-scenario simulation
- **Business Impact:** Real cost saving calculations (87 TL örnek)
- **Demo Readiness:** Full API documentation + test endpoints

---

## 🛠️ Development Notes

### Code Quality

- **ES Modules** kullanımı (modern JavaScript)
- **SOLID Principles** uygulaması (controller, service, model separation)
- **RESTful API** tasarımı
- **Error handling** middleware
- **Request logging** for debugging

### Performance Considerations

- **MongoDB indexing** (user_id, period optimized queries)
- **Efficient aggregation** pipelines for statistical calculations
- **Memory optimization** for large bill datasets

### Scalability Notes

- **Modular architecture** - easy to extend with new features
- **Service layer separation** - business logic isolated
- **Database abstraction** - easy to switch to different DB

---

## 📞 Support & İletişim

**Hackathon:** Codenight Case  
**Geliştirme Süresi:** 10 saat  
**Platform:** Node.js + Express + MongoDB

### Quick Start Command

```bash
git clone <repo> && cd backend && npm install && npm start
```

**Server:** http://localhost:2020  
**API Documentation:** http://localhost:2020/api/info  
**Health Check:** http://localhost:2020/api/health

---

_Bu proje Turkcell müşteri deneyimini iyileştirmek ve fatura şeffaflığını artırmak amacıyla geliştirilmiştir. 7 saatlik hackathon sürecinde MVP odaklı yaklaşımla tamamlanmıştır._
