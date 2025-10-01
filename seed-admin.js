const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const dotenv = require("dotenv")

// Load environment variables
dotenv.config()

// Import User model
const User = require("./models/User")

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://bhaswanthpeddineni:bhaswanth@cluster1.z40rudx.mongodb.net/Pet?retryWrites=true&w=majority"

// Admin user details - you can modify these as needed
const adminUser = {
  name: "Admin User",
  email: "admin@example.com",
  password: "admin123", // This will be hashed before saving
  role: "admin",
  isApproved: true,
  phone: "123-456-7890",
  address: {
    street: "123 Admin Street",
    city: "Admin City",
    state: "Admin State",
    zipCode: "12345",
    country: "Admin Country",
  },
  profileImage: "/images/default-profile.jpg",
}

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("Connected to MongoDB")

    try {
      // Check if admin already exists
      const existingAdmin = await User.findOne({ email: adminUser.email })

      if (existingAdmin) {
        console.log("Admin user already exists!")
        console.log(`Email: ${adminUser.email}`)
        console.log(`Password: ${adminUser.password} (not hashed)`)
      } else {
        // Create new admin user
        

        const newAdmin = new User({
          ...adminUser,
          password: adminUser.password,
        })

        await newAdmin.save()

        console.log("Admin user created successfully!")
        console.log(`Email: ${adminUser.email}`)
        console.log(`Password: ${adminUser.password} (not hashed)`)
      }
    } catch (error) {
      console.error("Error creating admin user:", error)
    } finally {
      // Close the database connection
      mongoose.connection.close()
      console.log("Database connection closed")
    }
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err)
  })
