const Pet = require("../models/Pet");
const AdoptionApplication = require("../models/AdoptionApplication");
const fs = require("fs");
const path = require("path");

// Get all pets
exports.getAllPets = async (req, res) => {
  try {
    const { species, breed, age, size, gender, status } = req.query;
    const filter = {};
    if (species) filter.species = species;
    if (breed) filter.breed = breed;
    if (size) filter.size = size;
    if (gender) filter.gender = gender;
    if (status) filter.status = status;
    if (age) {
      const [min, max] = age.split("-");
      if (min && max) {
        filter["age.value"] = { $gte: Number.parseInt(min), $lte: Number.parseInt(max) };
        filter["age.unit"] = "years";
      }
    }
    const page = Number.parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;
    const pets = await Pet.find(filter)
      .populate("shelter", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Pet.countDocuments(filter);
    const pages = Math.ceil(total / limit);
    res.render("pages/pets/index", {
      title: "Available Pets",
      pets,
      current: page,
      pages,
      filter: req.query,
    });
  } catch (err) {
    console.error("Get all pets error:", err);
    req.flash("error", "An error occurred while fetching pets");
    res.redirect("/");
  }
};

// Get pet by ID
exports.getPetById = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id).populate("shelter", "name address phone email");
    if (!pet) {
      req.flash("error", "Pet not found");
      return res.redirect("/pets");
    }
    let hasApplied = false;
    if (req.user) {
      const application = await AdoptionApplication.findOne({
        adopter: req.user._id,
        pet: pet._id,
      });
      if (application) hasApplied = true;
    }
    const similarPets = await Pet.find({
      _id: { $ne: pet._id },
      species: pet.species,
      status: "available",
    }).limit(4);
    res.render("pages/pets/show", {
      title: pet.name,
      pet,
      hasApplied,
      similarPets,
    });
  } catch (err) {
    console.error("Get pet by ID error:", err);
    req.flash("error", "An error occurred while fetching pet details");
    res.redirect("/pets");
  }
};

// Get pet create form
exports.getCreatePetForm = (req, res) => {
  res.render("pages/pets/new", {
    title: "Add New Pet",
    pet: {},
    currentUser: req.user,
    errors: [],
    formData: {},
  });
};

// Create new pet
exports.createPet = async (req, res) => {
  try {
    const {
      name,
      species,
      breed,
      ageValue,
      ageUnit,
      size,
      gender,
      color,
      description,
      goodWithChildren,
      goodWithDogs,
      goodWithCats,
      goodWithOtherAnimals,
      vaccinated,
      neutered,
      microchipped,
      specialNeeds,
      specialNeedsDescription,
      energyLevel,
      trainingLevel,
      socialness,
      adoptionFee,
      status,
    } = req.body;

    // Validate required fields
    const errors = [];
    if (!name) errors.push("Pet name is required");
    if (!species) errors.push("Species is required");
    if (!ageValue || isNaN(ageValue) || ageValue < 0) errors.push("Age value must be a positive number");
    if (!ageUnit) errors.push("Age unit is required");
    if (!description) errors.push("Description is required");
    if (!status) errors.push("Adoption status is required");
    if (!req.files || req.files.length === 0) errors.push("At least one image is required");

    // Validate enums
    const validSpecies = ["dog", "cat", "bird", "rabbit", "hamster", "guinea pig", "fish", "reptile", "other"];
    if (species && !validSpecies.includes(species)) errors.push("Invalid species");
    const validAgeUnits = ["days", "weeks", "months", "years"];
    if (ageUnit && !validAgeUnits.includes(ageUnit)) errors.push("Invalid age unit");
    const validSizes = ["small", "medium", "large", "extra large"];
    if (size && !validSizes.includes(size)) errors.push("Invalid size");
    const validGenders = ["male", "female", "unknown"];
    if (gender && !validGenders.includes(gender)) errors.push("Invalid gender");
    const validStatuses = ["available", "pending", "adopted"];
    if (status && !validStatuses.includes(status)) errors.push("Invalid status");
    const validEnergyLevels = ["low", "medium", "high"];
    if (energyLevel && !validEnergyLevels.includes(energyLevel)) errors.push("Invalid energy level");
    const validTrainingLevels = ["none", "basic", "well trained"];
    if (trainingLevel && !validTrainingLevels.includes(trainingLevel)) errors.push("Invalid training level");
    const validSocialness = ["shy", "moderate", "social"];
    if (socialness && !validSocialness.includes(socialness)) errors.push("Invalid socialness");

    if (errors.length > 0) {
      // Delete uploaded files if validation fails
      if (req.files) {
        req.files.forEach((file) => {
          const filePath = path.join(__dirname, "../public/uploads/pets", file.filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
      }
      return res.status(400).json({ success: false, errors });
    }

    // Create new pet object
    const newPet = new Pet({
      name,
      species,
      breed,
      age: {
        value: Number(ageValue),
        unit: ageUnit,
      },
      size,
      gender,
      color,
      description,
      goodWith: {
        children: goodWithChildren === "on",
        dogs: goodWithDogs === "on",
        cats: goodWithCats === "on",
        otherAnimals: goodWithOtherAnimals === "on",
      },
      healthInfo: {
        vaccinated: vaccinated === "on",
        neutered: neutered === "on",
        microchipped: microchipped === "on",
        specialNeeds: specialNeeds === "on",
        specialNeedsDescription: specialNeeds === "on" ? specialNeedsDescription : undefined,
      },
      behavior: {
        energyLevel,
        trainingLevel,
        socialness,
      },
      adoptionFee: adoptionFee ? Number(adoptionFee) : 0,
      status,
      shelter: req.user._id,
    });

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      newPet.images = req.files.map((file) => `/uploads/pets/${file.filename}`);
      newPet.mainImage = `/uploads/pets/${req.files[0].filename}`;
    }

    await newPet.save();
    res.status(201).json({ success: true, petId: newPet._id });
  } catch (err) {
    console.error("Create pet error:", err);
    // Delete uploaded files if error occurs
    if (req.files) {
      req.files.forEach((file) => {
        const filePath = path.join(__dirname, "../public/uploads/pets", file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    }
    res.status(500).json({ success: false, errors: [err.message] });
  }
};

// Get pet edit form
exports.getEditPetForm = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      req.flash("error", "Pet not found");
      return res.redirect("/pets");
    }
    if (pet.shelter.toString() !== req.user._id.toString()) {
      req.flash("error", "You are not authorized to edit this pet");
      return res.redirect("/pets");
    }
    res.render("pages/pets/edit", {
      title: `Edit ${pet.name}`,
      pet,
    });
  } catch (err) {
    console.error("Get edit pet form error:", err);
    req.flash("error", "An error occurred while fetching pet details");
    res.redirect("/pets");
  }
};

// Update pet
exports.updatePet = async (req, res) => {
  try {
    const {
      name,
      species,
      breed,
      ageValue,
      ageUnit,
      size,
      gender,
      color,
      description,
      goodWithChildren,
      goodWithDogs,
      goodWithCats,
      goodWithOtherAnimals,
      vaccinated,
      neutered,
      microchipped,
      specialNeeds,
      specialNeedsDescription,
      energyLevel,
      trainingLevel,
      socialness,
      adoptionFee,
      status,
    } = req.body;

    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      req.flash("error", "Pet not found");
      return res.redirect("/pets");
    }
    if (pet.shelter.toString() !== req.user._id.toString()) {
      req.flash("error", "You are not authorized to edit this pet");
      return res.redirect("/pets");
    }

    pet.name = name;
    pet.species = species;
    pet.breed = breed;
    pet.age = { value: Number(ageValue), unit: ageUnit };
    pet.size = size;
    pet.gender = gender;
    pet.color = color;
    pet.description = description;
    pet.goodWith = {
      children: goodWithChildren === "on",
      dogs: goodWithDogs === "on",
      cats: goodWithCats === "on",
      otherAnimals: goodWithOtherAnimals === "on",
    };
    pet.healthInfo = {
      vaccinated: vaccinated === "on",
      neutered: neutered === "on",
      microchipped: microchipped === "on",
      specialNeeds: specialNeeds === "on",
      specialNeedsDescription: specialNeeds === "on" ? specialNeedsDescription : undefined,
    };
    pet.behavior = { energyLevel, trainingLevel, socialness };
    pet.adoptionFee = adoptionFee ? Number(adoptionFee) : 0;
    pet.status = status;

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => `/uploads/pets/${file.filename}`);
      pet.images = [...pet.images, ...newImages];
      if (!pet.mainImage) pet.mainImage = `/uploads/pets/${req.files[0].filename}`;
    }

    await pet.save();
    req.flash("success", "Pet updated successfully");
    res.redirect(`/pets/${pet._id}`);
  } catch (err) {
    console.error("Update pet error:", err);
    req.flash("error", "An error occurred while updating the pet");
    res.redirect(`/pets/${req.params.id}/edit`);
  }
};

// Delete pet
exports.deletePet = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      req.flash("error", "Pet not found");
      return res.redirect("/pets");
    }
    if (
      pet.shelter.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "co-admin"
    ) {
      req.flash("error", "You are not authorized to delete this pet");
      return res.redirect("/pets");
    }
    if (pet.images && pet.images.length > 0) {
      pet.images.forEach((image) => {
        const imagePath = path.join(__dirname, "../public", image);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      });
    }
    await Pet.findByIdAndDelete(pet._id);
    req.flash("success", "Pet deleted successfully");
    if (req.headers.referer && req.headers.referer.includes("/admin/pets")) {
      return res.redirect("/admin/pets");
    }
    return res.redirect("/dashboard");
  } catch (err) {
    console.error("Delete pet error:", err);
    req.flash("error", "An error occurred while deleting the pet");
    res.redirect("/pets");
  }
};

// Search pets
exports.searchPets = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.redirect("/pets");
    const pets = await Pet.find({ $text: { $search: query } }, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } })
      .populate("shelter", "name");
    res.render("pages/pets/search", {
      title: "Search Results",
      pets,
      query,
    });
  } catch (err) {
    console.error("Search pets error:", err);
    req.flash("error", "An error occurred while searching for pets");
    res.redirect("/pets");
  }
};

// Get adoption application form
exports.getAdoptionForm = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId).populate("shelter", "name");
    if (!pet) {
      req.flash("error", "Pet not found");
      return res.redirect("/pets");
    }
    if (pet.status !== "available") {
      req.flash("error", "This pet is not available for adoption");
      return res.redirect(`/pets/${pet._id}`);
    }
    const existingApplication = await AdoptionApplication.findOne({
      adopter: req.user._id,
      pet: pet._id,
    });
    if (existingApplication) {
      req.flash("error", "You have already applied for this pet");
      return res.redirect(`/pets/${pet._id}`);
    }
    res.render("pages/applications/new", {
      title: `Adoption Application for ${pet.name}`,
      pet,
    });
  } catch (err) {
    console.error("Get adoption form error:", err);
    req.flash("error", "An error occurred while loading the application form");
    res.redirect("/pets");
  }
};

// Submit adoption application
exports.submitAdoptionApplication = async (req, res) => {
  try {
    const {
      petId,
      homeType,
      hasYard,
      hasChildren,
      childrenAges,
      hasOtherPets,
      otherPetsDescription,
      workSchedule,
      experience,
      reasonForAdopting,
      additionalInfo,
    } = req.body;
    const pet = await Pet.findById(petId);
    if (!pet) {
      req.flash("error", "Pet not found");
      return res.redirect("/pets");
    }
    if (pet.status !== "available") {
      req.flash("error", "This pet is not available for adoption");
      return res.redirect(`/pets/${pet._id}`);
    }
    const newApplication = new AdoptionApplication({
      adopter: req.user._id,
      pet: pet._id,
      shelter: pet.shelter,
      homeType,
      hasYard: hasYard === "on",
      hasChildren: hasChildren === "on",
      childrenAges,
      hasOtherPets: hasOtherPets === "on",
      otherPetsDescription,
      workSchedule,
      experience,
      reasonForAdopting,
      additionalInfo,
    });
    await newApplication.save();
    pet.status = "pending";
    await pet.save();
    req.flash("success", "Application submitted successfully");
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Submit adoption application error:", err);
    req.flash("error", "An error occurred while submitting your application");
    res.redirect(`/pets/${req.body.petId}`);
  }
};