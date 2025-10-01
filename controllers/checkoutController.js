const Cart = require('../models/Cart');
const User = require('../models/User');

exports.index = async (req, res) => {
  try {
    // Fetch the current user (from req.user set by Passport.js)
    const currentUser = req.user || { name: '', email: '', phone: '', address: {} };

    // Fetch the cart for the authenticated user
    let cart = await Cart.findOne({ customer: req.user._id }).populate('items.product');

    // If no cart or empty items, provide a default empty cart
    if (!cart || !cart.items || cart.items.length === 0) {
      cart = { items: [], subtotal: 0, tax: 0, shipping: 0, total: 0, discount: 0 };
    }

    // Render the checkout page with user and cart data
    res.render('pages/checkout/index', { currentUser, cart });
  } catch (err) {
    console.error('Error rendering checkout page:', err);
    res.status(500).send('Server Error');
  }
};