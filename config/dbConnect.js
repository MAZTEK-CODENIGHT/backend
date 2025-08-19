import mongoose from "mongoose";

mongoose.set("strictQuery", true);

export const dbConnect = async () => {
  try {
    // MongoDB Atlas connection with explicit database name
    let mongoUri = process.env.MONGO_URI;

    // URI'yi kontrol et ve database adını ekle
    if (mongoUri.includes("?")) {
      // ? parametreleri varsa, database adını ? öncesine ekle
      mongoUri = mongoUri.replace(
        "mongodb.net/",
        "mongodb.net/fatura_asistani"
      );
    } else {
      // Parametre yoksa direkt ekle
      mongoUri = mongoUri + "/fatura_asistani";
    }

    console.log(`🔗 Connecting to database: fatura_asistani`);

    // Deprecated seçenekleri kaldır
    const conn = await mongoose.connect(mongoUri);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`🗄️  Database: ${conn.connection.name}`);

    // List collections for verification
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    // Collection sayılarını kontrol et
    if (collections.length > 0) {
      for (const collection of collections) {
        try {
          const count = await mongoose.connection.db
            .collection(collection.name)
            .countDocuments();
        } catch (err) {
          console.log(`   📋 ${collection.name}: count error`);
        }
      }
    } else {
      console.log(
        "⚠️  No collections found! Make sure you've run the MongoDB setup script."
      );
    }
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};
