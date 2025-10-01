const User = require("../models/User")
const passport = require("passport")
const bcrypt = require("bcryptjs")
const fs = require("fs")
const path = require("path")

// Get login page
exports.getLogin = (req, res) => {
  res.render("pages/auth/login", {
    title: "Login",
  })
}

// Get register page
exports.getRegister = (req, res) => {
  res.render("pages/auth/register", {
    title: "Register",
  })
}

// Register user
exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      password2,
      role,
      businessName,
      taxId,
      businessAddress,
      website,
      yearsInBusiness,
      description,
      productCategories,
      licenseNumber,
      specialization,
      experience,
      education,
      bio,
      clinicName,
      clinicAddress,
      certifications,
      availableDays,
      startTime,
      endTime,
    } = req.body
    const errors = []

    // Check required fields
    if (!name || !email || !password || !password2 || !role) {
      errors.push({ msg: "Please fill in all fields" })
    }

    // Check passwords match
    if (password !== password2) {
      errors.push({ msg: "Passwords do not match" })
    }

    // Check password length
    if (password.length < 6) {
      errors.push({ msg: "Password should be at least 6 characters" })
    }

    // Check role-specific required fields
    if (role === "seller" && !taxId) {
      errors.push({ msg: "Tax ID / Business License is required for sellers" })
    }
    if (role === "veterinary" && !licenseNumber) {
      errors.push({ msg: "License Number is required for veterinarians" })
    }

    if (errors.length > 0) {
      return res.render("pages/auth/register", {
        title: "Register",
        errors,
        name,
        email,
        role,
        businessName,
        taxId,
        businessAddress,
        website,
        yearsInBusiness,
        description,
        productCategories,
        licenseNumber,
        specialization,
        experience,
        education,
        bio,
        clinicName,
        clinicAddress,
        certifications,
        availableDays,
        startTime,
        endTime,
      })
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      errors.push({ msg: "Email is already registered" })
      return res.render("pages/auth/register", {
        title: "Register",
        errors,
        name,
        email,
        role,
        businessName,
        taxId,
        businessAddress,
        website,
        yearsInBusiness,
        description,
        productCategories,
        licenseNumber,
        specialization,
        experience,
        education,
        bio,
        clinicName,
        clinicAddress,
        certifications,
        availableDays,
        startTime,
        endTime,
      })
    }

    // Create new user
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password,
      role,
    })

    // Handle role-specific info
    if (role === "seller") {
      newUser.sellerInfo = {
        businessName: businessName || "",
        taxId: taxId || "",
        businessAddress: businessAddress || "",
        website: website || "",
        yearsInBusiness: Number(yearsInBusiness) || 0,
        description: description || "",
        productCategories: Array.isArray(productCategories)
          ? productCategories
          : productCategories
          ? [productCategories]
          : [],
      }
    } else if (role === "veterinary") {
      newUser.vetInfo = {
        licenseNumber: licenseNumber || "",
        specialization: specialization || "",
        experience: Number(experience) || 0,
        education: education || "",
        bio: bio || "",
        clinicName: clinicName || "",
        clinicAddress: clinicAddress || "",
        certifications: Array.isArray(certifications)
          ? certifications
          : certifications
          ? certifications.split(",").map((cert) => cert.trim())
          : [],
        availableDays: Array.isArray(availableDays)
          ? availableDays
          : availableDays
          ? [availableDays]
          : [],
        availableHours: {
          start: startTime || "",
          end: endTime || "",
        },
      }
    }

    // Save profile image if uploaded
    if (req.file) {
      newUser.profileImage = `/uploads/users/${req.file.filename}`
    }

    // Save user
    await newUser.save()
    // console.log('Registered user:', newUser);

    // Flash message
    let successMessage = "You are now registered and can log in"
    if (role === "seller" || role === "veterinary") {
      successMessage = "Your account has been created and is pending admin approval"
    }

    req.flash("success", successMessage)
    res.redirect("/auth/login")
  } catch (err) {
    console.error('Error during registration:', err)
    req.flash("error", "An error occurred during registration")
    res.redirect("/auth/register")
  }
}

// Login user
exports.login = (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/auth/login",
    failureFlash: true,
  })(req, res, next)
}

// Logout user
exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err)
    }
    req.flash("success", "You are logged out")
    res.redirect("/")
  })
}

// Get profile page
exports.getProfile = (req, res) => {
  res.render("pages/auth/profile", {
    title: "Profile",
    user: req.user,
  })
}

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, street, city, state, zipCode, country, bio } = req.body

    // Update user
    const user = await User.findById(req.user.id)

    user.name = name
    user.phone = phone
    user.address = {
      street,
      city,
      state,
      zipCode,
      country,
    }

    // Update role-specific info
    if (user.role === "seller") {
      const { businessName, description, website, businessAddress, taxId, yearsInBusiness } = req.body

      // Create sellerInfo object if it doesn't exist
      if (!user.sellerInfo) {
        user.sellerInfo = {}
      }

      user.sellerInfo.businessName = businessName || user.sellerInfo.businessName
      user.sellerInfo.description = description || user.sellerInfo.description
      user.sellerInfo.website = website || user.sellerInfo.website
      user.sellerInfo.businessAddress = businessAddress || user.sellerInfo.businessAddress
      user.sellerInfo.taxId = taxId || user.sellerInfo.taxId
      user.sellerInfo.yearsInBusiness = yearsInBusiness || user.sellerInfo.yearsInBusiness

      // Handle product categories if provided
      if (req.body.productCategories) {
        const categories = Array.isArray(req.body.productCategories)
          ? req.body.productCategories
          : [req.body.productCategories]
        user.sellerInfo.productCategories = categories
      }
    } else if (user.role === "veterinary") {
      const {
        licenseNumber,
        specialization,
        experience,
        education,
        bio,
        clinicName,
        clinicAddress,
        availableDays,
        startTime,
        endTime,
        certifications,
      } = req.body

      // Create vetInfo object if it doesn't exist
      if (!user.vetInfo) {
        user.vetInfo = {}
      }

      // Process available days (convert checkbox values to array)
      const days = []
      if (availableDays) {
        if (Array.isArray(availableDays)) {
          days.push(...availableDays)
        } else {
          days.push(availableDays)
        }
      }

      // Process certifications if provided
      let certArray = []
      if (certifications) {
        if (typeof certifications === "string") {
          // Split by commas if it's a comma-separated string
          certArray = certifications.split(",").map((cert) => cert.trim())
        } else if (Array.isArray(certifications)) {
          certArray = certifications
        }
      }

      user.vetInfo.licenseNumber = licenseNumber || user.vetInfo.licenseNumber
      user.vetInfo.specialization = specialization || user.vetInfo.specialization
      user.vetInfo.experience = experience || user.vetInfo.experience
      user.vetInfo.education = education || user.vetInfo.education
      user.vetInfo.bio = bio || user.vetInfo.bio
      user.vetInfo.clinicName = clinicName || user.vetInfo.clinicName
      user.vetInfo.clinicAddress = clinicAddress || user.vetInfo.clinicAddress
      user.vetInfo.certifications = certArray.length > 0 ? certArray : user.vetInfo.certifications
      user.vetInfo.availableDays = days.length > 0 ? days : user.vetInfo.availableDays
      user.vetInfo.availableHours = {
        start: startTime || (user.vetInfo.availableHours ? user.vetInfo.availableHours.start : ""),
        end: endTime || (user.vetInfo.availableHours ? user.vetInfo.availableHours.end : ""),
      }
    }

    // Save profile image if uploaded
    if (req.file) {
      // Delete old profile image if it exists and is not the default
      if (user.profileImage && user.profileImage !== "/images/default-profile.jpg") {
        const oldImagePath = path.join(__dirname, "../public", user.profileImage)
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath)
        }
      }

      user.profileImage = `/uploads/users/${req.file.filename}`
    }

    await user.save()

    req.flash("success", "Profile updated successfully")
    res.redirect("/auth/profile")
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while updating your profile")
    res.redirect("/auth/profile")
  }
}

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body
    const errors = []

    // Check passwords match
    if (newPassword !== confirmPassword) {
      errors.push({ msg: "New passwords do not match" })
    }

    // Check password length
    if (newPassword.length < 6) {
      errors.push({ msg: "Password should be at least 6 characters" })
    }

    if (errors.length > 0) {
      req.flash("error", errors[0].msg)
      return res.redirect("/auth/profile")
    }

    // Get user
    const user = await User.findById(req.user.id)

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (isMatch) {
      // Hash new password
      const salt = await bcrypt.genSalt(10)
      user.password = await bcrypt.hash(newPassword, salt)

      await user.save()

      req.flash("success", "Password changed successfully")
      res.redirect("/auth/profile")
    } else {
      req.flash("error", "Current password is incorrect")
      res.redirect("/auth/profile")
    }
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while changing your password")
    res.redirect("/auth/profile")
  }
}