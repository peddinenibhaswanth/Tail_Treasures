const express = require("express")
const router = express.Router()
const { ensureAuthenticated } = require("../middleware/auth")
const User = require("../models/User")
const Appointment = require("../models/Appointment")

// Get all appointments page
router.get("/", async (req, res) => {
  try {
    // Get all approved veterinarians
    const vets = await User.find({
      role: "veterinary",
      isApproved: true,
    }).select("name profileImage vetInfo")

    res.render("pages/appointments/index", {
      title: "Veterinary Services",
      vets,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading the page")
    res.redirect("/")
  }
})

// Get appointment booking form
router.get("/book", ensureAuthenticated, async (req, res) => {
  try {
    const { vet: vetId, service: selectedService } = req.query

    // Get all approved veterinarians
    const vets = await User.find({
      role: "veterinary",
      isApproved: true,
    }).select("name profileImage vetInfo")

    // Get selected vet if provided
    let selectedVet = null
    if (vetId) {
      selectedVet = await User.findOne({
        _id: vetId,
        role: "veterinary",
        isApproved: true,
      }).select("name profileImage vetInfo")

      if (!selectedVet) {
        req.flash("error", "Veterinarian not found")
        return res.redirect("/appointments")
      }
    }

    res.render("pages/appointments/book", {
      title: "Book an Appointment",
      vets,
      selectedVet,
      selectedService,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while loading the booking form")
    res.redirect("/appointments")
  }
})

// Get available times for a vet on a specific date
router.get("/available-times", ensureAuthenticated, async (req, res) => {
  try {
    const { vet: vetId, date } = req.query

    if (!vetId || !date) {
      return res.status(400).json({ error: "Vet ID and date are required" })
    }

    // Get vet
    const vet = await User.findOne({
      _id: vetId,
      role: "veterinary",
      isApproved: true,
    })

    if (!vet) {
      return res.status(404).json({ error: "Veterinarian not found" })
    }

    // Check if the selected date is one of the vet's available days
    const selectedDate = new Date(date)
    const dayOfWeek = selectedDate.toLocaleDateString("en-US", { weekday: "long" })

    if (!vet.vetInfo.availableDays.includes(dayOfWeek)) {
      return res.json({ availableTimes: [] })
    }

    // Get vet's working hours
    const startTime = vet.vetInfo.availableHours.start || "09:00"
    const endTime = vet.vetInfo.availableHours.end || "17:00"

    // Generate available time slots (1 hour intervals)
    const availableTimes = []
    let currentTime = startTime
    while (currentTime < endTime) {
      availableTimes.push(currentTime)

      // Add 1 hour
      const [hours, minutes] = currentTime.split(":")
      let newHours = Number.parseInt(hours) + 1
      if (newHours < 10) newHours = `0${newHours}`
      currentTime = `${newHours}:${minutes}`
    }

    // Get existing appointments for this vet on this date
    const existingAppointments = await Appointment.find({
      veterinary: vetId,
      date: {
        $gte: new Date(date),
        $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)),
      },
      status: { $ne: "cancelled" },
    })

    // Remove booked time slots
    const bookedTimes = existingAppointments.map((appointment) => appointment.time)
    const availableTimeSlots = availableTimes.filter((time) => !bookedTimes.includes(time))

    res.json({ availableTimes: availableTimeSlots })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})

// Create new appointment
router.post("/", ensureAuthenticated, async (req, res) => {
  try {
    const { veterinary, petName, petType, date, time, reason, notes } = req.body

    // Check if vet exists
    const vet = await User.findOne({
      _id: veterinary,
      role: "veterinary",
      isApproved: true,
    })

    if (!vet) {
      req.flash("error", "Veterinarian not found")
      return res.redirect("/appointments")
    }

    // Create new appointment
    const newAppointment = new Appointment({
      customer: req.user._id,
      veterinary,
      petName,
      petType,
      date,
      time,
      reason,
      notes,
    })

    await newAppointment.save()

    // Populate veterinary field for confirmation page
    await newAppointment.populate("veterinary", "name")

    req.flash("success", "Appointment booked successfully")
    res.render("pages/appointments/confirmation", {
      title: "Appointment Confirmation",
      appointment: newAppointment,
    })
  } catch (err) {
    console.error(err)
    req.flash("error", "An error occurred while booking your appointment")
    res.redirect("/appointments/book")
  }
})

module.exports = router
