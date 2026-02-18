const mongoose = require("mongoose");

async function connectDB(uri) {
  mongoose.set("strictQuery", true);

  if (!uri) {
    throw new Error("❌ MONGO_URI is missing in server/.env");
  }

  console.log("👉 USING MONGO URI:", uri);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 20000, // wait 20 sec before fail
      socketTimeoutMS: 45000,
      family: 4, // ✅ force IPv4 (important for Windows/corp network)
    });

    console.log("✅ MongoDB connected successfully 🚀");

  } catch (error) {
    console.error("❌ MongoDB connection failed:");
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
