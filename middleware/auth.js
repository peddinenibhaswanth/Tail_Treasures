module.exports = {
  // Ensure user is authenticated
  ensureAuthenticated: (req, res, next) => {
    if (req.isAuthenticated()) {
      return next()
    }
    req.flash("error", "Please log in to view this resource")
    res.redirect("/auth/login")
  },

  // Forward authenticated users
  forwardAuthenticated: (req, res, next) => {
    if (!req.isAuthenticated()) {
      return next()
    }
    res.redirect("/dashboard")
  },

  // Check if user is admin or co-admin
  isAdmin: (req, res, next) => {
    if (req.isAuthenticated() && (req.user.role === "admin" || req.user.role === "co-admin")) {
      return next()
    }
    req.flash("error", "Access denied. Admin privileges required.")
    res.redirect("/dashboard")
  },

  // Check if user is strictly admin (not co-admin)
  isStrictlyAdmin: (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === "admin") {
      return next()
    }
    req.flash("error", "Access denied. Admin privileges required.")
    res.redirect("/dashboard")
  },

  // Check if user is seller (approved only)
  isSeller: (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === "seller" && req.user.isApproved) {
      return next()
    }
    req.flash("error", "Access denied. Approved seller privileges required.")
    res.redirect("/dashboard")
  },

  // Check if user is seller, admin, or co-admin (from first code)
  isSellerOrAdmin: (req, res, next) => {
    if (
      req.isAuthenticated() &&
      (req.user.role === "seller" || req.user.role === "admin" || req.user.role === "co-admin")
    ) {
      return next()
    }
    req.flash("error", "You do not have permission to view this resource")
    res.redirect("/dashboard")
  },

  // Check if user is veterinary (approved only)
  isVeterinary: (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === "veterinary" && req.user.isApproved) {
      return next()
    }
    req.flash("error", "Access denied. Approved veterinary privileges required.")
    res.redirect("/dashboard")
  },

  // Check if user is veterinary, admin, or co-admin (from first code)
  isVet: (req, res, next) => {
    if (
      req.isAuthenticated() &&
      (req.user.role === "veterinary" || req.user.role === "admin" || req.user.role === "co-admin")
    ) {
      return next()
    }
    req.flash("error", "You do not have permission to view this resource")
    res.redirect("/dashboard")
  },

  // Check if user is customer
  isCustomer: (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === "customer") {
      return next()
    }
    req.flash("error", "Access denied. Customer privileges required.")
    res.redirect("/dashboard")
  },

  // Check if user is admin, co-admin, or approved seller
  isAdminCoAdminOrSeller: (req, res, next) => {
    if (
      req.isAuthenticated() &&
      (req.user.role === "admin" || req.user.role === "co-admin" || (req.user.role === "seller" && req.user.isApproved))
    ) {
      return next()
    }

    if (req.user && req.user.role === "seller" && !req.user.isApproved) {
      req.flash("error", "Your seller account is pending approval.")
    } else {
      req.flash("error", "Access denied. You don't have the required permissions.")
    }

    res.redirect("/dashboard")
  },
}