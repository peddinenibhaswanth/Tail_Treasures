const express = require("express");
const router = express.Router();
const { ensureAuthenticated, isAdmin, isSeller, isAdminCoAdminOrSeller } = require("../middleware/auth");
const petController = require("../controllers/petController");
const { petUpload } = require("../middleware/upload");

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, errors: [err.message] });
  }
  if (err) {
    return res.status(400).json({ success: false, errors: [err.message] });
  }
  next();
};

// Get all pets
router.get("/", petController.getAllPets);

// Search pets
router.get("/search", petController.searchPets);

// Get pet create form
router.get("/new", ensureAuthenticated, isAdminCoAdminOrSeller, petController.getCreatePetForm);

// Create new pet
router.post(
  "/",
  ensureAuthenticated,
  isAdminCoAdminOrSeller,
  petUpload.array("images", 5),
  handleMulterError,
  petController.createPet
);

// Get pet by ID
router.get("/:id", petController.getPetById);

// Get pet edit form
router.get("/:id/edit", ensureAuthenticated, isAdminCoAdminOrSeller, petController.getEditPetForm);

// Update pet
router.put(
  "/:id",
  ensureAuthenticated,
  isAdminCoAdminOrSeller,
  petUpload.array("images", 10),
  handleMulterError,
  petController.updatePet
);

// Delete pet
router.delete("/:id", ensureAuthenticated, isAdminCoAdminOrSeller, petController.deletePet);

// Get adoption application form
router.get("/:petId/adopt", ensureAuthenticated, petController.getAdoptionForm);

// Submit adoption application
router.post("/:petId/adopt", ensureAuthenticated, petController.submitAdoptionApplication);

module.exports = router;