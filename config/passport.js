const LocalStrategy = require("passport-local").Strategy
const bcrypt = require("bcryptjs")
const User = require("../models/User")

module.exports = (passport) => {
  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() })

        if (!user) {
          return done(null, false, { message: "That email is not registered" })
        }

        // Check if seller or vet is approved
        if ((user.role === "seller" || user.role === "veterinary") && !user.isApproved) {
          return done(null, false, { message: "Your account is pending approval by admin" })
        }

        // Match password
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) throw err
          if (isMatch) {
            return done(null, user)
          } else {
            return done(null, false, { message: "Password incorrect" })
          }
        })
      } catch (err) {
        return done(err)
      }
    }),
  )

  passport.serializeUser((user, done) => {
    done(null, user.id)
  })

  passport.deserializeUser((id, done) => {
    User.findById(id)
      .then((user) => {
        done(null, user)
      })
      .catch((err) => {
        done(err, null)
      })
  })
}
