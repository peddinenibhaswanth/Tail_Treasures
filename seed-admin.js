const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import User model
const User = require("./models/User");

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;

// Admin user details from .env
const adminUser = {
  name: process.env.ADMIN_NAME || "Admin User",
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD, // will be hashed before saving
  role: "admin",
  isApproved: true,
  phone: process.env.ADMIN_PHONE || "000-000-0000",
  address: {
    city: process.env.ADMIN_CITY || "Default City",
  },
  profileImage: "/images/default-profile.jpg",
};

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("Connected to MongoDB");

    try {
      const existingAdmin = await User.findOne({ email: adminUser.email });

      if (existingAdmin) {
        console.log("Admin user already exists!");
        console.log(`Email: ${adminUser.email}`);
      } else {
        // Hash password before saving
        const hashedPassword = await bcrypt.hash(adminUser.password, 10);

        const newAdmin = new User({
          ...adminUser,
          password: hashedPassword,
        });

        await newAdmin.save();

        console.log("✅ Admin user created successfully!");
        console.log(`Email: ${adminUser.email}`);
        console.log(`Password: (use the one in .env)`); // don't log raw password
      }
    } catch (error) {
      console.error("Error creating admin user:", error);
    } finally {
      mongoose.connection.close();
      console.log("Database connection closed");
    }
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
