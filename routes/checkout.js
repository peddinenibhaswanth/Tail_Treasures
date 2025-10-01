const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');
const { ensureAuthenticated } = require('../middleware/auth'); // Import authentication middleware

router.get('/', ensureAuthenticated, checkoutController.index); // Add route for /checkout
router.get('/index', ensureAuthenticated, checkoutController.index);

module.exports = router;