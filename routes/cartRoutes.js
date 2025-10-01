const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// Get cart page
router.get('/', async (req, res) => {
  try {
    let cart;
    if (req.isAuthenticated()) {
      // Find user's cart or create a new one
      cart = await Cart.findOne({ customer: req.user._id }).populate('items.product');
      if (!cart) {
        cart = new Cart({
          customer: req.user._id,
          items: [],
          subtotal: 0,
          tax: 0,
          shipping: 0,
          total: 0,
          discount: 0,
        });
        await cart.save();
      }
    } else {
      // For non-authenticated users, use session cart
      if (!req.session.cart) {
        req.session.cart = {
          items: [],
          subtotal: 0,
          tax: 0,
          shipping: 0,
          total: 0,
          discount: 0,
        };
      }
      cart = req.session.cart;
    }

    res.render('pages/cart/index', {
      title: 'Shopping Cart',
      cart,
    });
  } catch (err) {
    console.error('Error loading cart:', err);
    req.flash('error', 'Failed to load cart');
    res.redirect('/products');
  }
});

// Add item to cart
router.post('/add', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = Number.parseInt(quantity) || 1;

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/products');
    }

    // Check if product is in stock
    if (product.stock < qty) {
      req.flash('error', 'Not enough stock available');
      return res.redirect(`/products/${productId}`);
    }

    // Determine the price (sale price or regular price)
    const price = product.onSale ? product.salePrice : product.price;

    if (req.isAuthenticated()) {
      // Find or create cart for authenticated user
      let cart = await Cart.findOne({ customer: req.user._id });
      if (!cart) {
        cart = new Cart({
          customer: req.user._id,
          items: [],
          subtotal: 0,
          tax: 0,
          shipping: 0,
          total: 0,
          discount: 0,
        });
      }

      // Check if product already in cart
      const existingItemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId
      );

      if (existingItemIndex > -1) {
        // Update quantity if product already in cart
        cart.items[existingItemIndex].quantity += qty;

        // Check if new quantity exceeds stock
        if (cart.items[existingItemIndex].quantity > product.stock) {
          cart.items[existingItemIndex].quantity = product.stock;
          req.flash('warning', 'Quantity adjusted to available stock');
        }
      } else {
        // Add new item to cart
        cart.items.push({
          product: productId,
          quantity: qty,
          price,
          name: product.name,
          image: product.mainImage,
        });
      }

      // Calculate totals and save
      await cart.calculateTotals();
      await cart.save();
      // console.log('Added to cart:', { productId, qty, cartItems: cart.items });
    } else {
      // Handle cart for non-authenticated users using session
      if (!req.session.cart) {
        req.session.cart = {
          items: [],
          subtotal: 0,
          tax: 0,
          shipping: 0,
          total: 0,
          discount: 0,
        };
      }

      // Check if product already in session cart
      const existingItemIndex = req.session.cart.items.findIndex(
        (item) => item.product.toString() === productId
      );

      if (existingItemIndex > -1) {
        // Update quantity if product already in cart
        req.session.cart.items[existingItemIndex].quantity += qty;

        // Check if new quantity exceeds stock
        if (req.session.cart.items[existingItemIndex].quantity > product.stock) {
          req.session.cart.items[existingItemIndex].quantity = product.stock;
          req.flash('warning', 'Quantity adjusted to available stock');
        }
      } else {
        // Add new item to cart with a unique _id
        req.session.cart.items.push({
          _id: new mongoose.Types.ObjectId().toString(),
          product: productId,
          quantity: qty,
          price,
          name: product.name,
          image: product.mainImage,
        });
      }

      // Calculate totals for session cart
      calculateSessionCartTotals(req.session.cart);
      // console.log('Added to session cart:', { productId, qty, cartItems: req.session.cart.items });
    }

    req.flash('success', 'Product added to cart');
    res.redirect('/cart');
  } catch (err) {
    console.error('Error adding to cart:', err);
    req.flash('error', 'Failed to add product to cart');
    res.redirect('/products');
  }
});

// Update cart item quantity
router.post('/update', async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    const qty = Number.parseInt(quantity);

    // Validate quantity
    if (qty < 1) {
      req.flash('error', 'Quantity must be at least 1');
      return res.redirect('/cart');
    }

    if (req.isAuthenticated()) {
      // Find cart for authenticated user
      const cart = await Cart.findOne({ customer: req.user._id });
      if (!cart) {
        req.flash('error', 'Cart not found');
        return res.redirect('/cart');
      }

      // Find item in cart
      const item = cart.items.id(itemId);
      if (!item) {
        req.flash('error', 'Item not found in cart');
        return res.redirect('/cart');
      }

      // Check stock
      const product = await Product.findById(item.product);
      if (!product) {
        req.flash('error', 'Product not found');
        return res.redirect('/cart');
      }

      if (product.stock < qty) {
        req.flash('error', 'Not enough stock available');
        return res.redirect('/cart');
      }

      // Update quantity
      item.quantity = qty;

      // Calculate totals and save
      await cart.calculateTotals();
      await cart.save();
      // console.log('Updated cart:', { itemId, qty, cartItems: cart.items });
    } else {
      // Handle for non-authenticated users using session
      if (!req.session.cart) {
        req.flash('error', 'Cart not found');
        return res.redirect('/cart');
      }

      // Find item in session cart
      const itemIndex = req.session.cart.items.findIndex(
        (item) => item._id === itemId
      );
      if (itemIndex === -1) {
        req.flash('error', 'Item not found in cart');
        return res.redirect('/cart');
      }

      // Get product to check stock
      const product = await Product.findById(req.session.cart.items[itemIndex].product);
      if (!product) {
        req.flash('error', 'Product not found');
        return res.redirect('/cart');
      }

      if (product.stock < qty) {
        req.flash('error', 'Not enough stock available');
        return res.redirect('/cart');
      }

      // Update quantity
      req.session.cart.items[itemIndex].quantity = qty;

      // Calculate totals
      calculateSessionCartTotals(req.session.cart);
      // console.log('Updated session cart:', { itemId, qty, cartItems: req.session.cart.items });
    }

    req.flash('success', 'Cart updated');
    res.redirect('/cart');
  } catch (err) {
    console.error('Error updating cart:', err);
    req.flash('error', 'Failed to update cart');
    res.redirect('/cart');
  }
});

// Remove item from cart
router.post('/remove', async (req, res) => {
  try {
    const { itemId } = req.body;

    if (req.isAuthenticated()) {
      // Find cart for authenticated user
      const cart = await Cart.findOne({ customer: req.user._id });
      if (!cart) {
        req.flash('error', 'Cart not found');
        return res.redirect('/cart');
      }

      // Remove item from cart
      cart.items = cart.items.filter((item) => item._id.toString() !== itemId);

      // Calculate totals and save
      await cart.calculateTotals();
      await cart.save();
      // console.log('Removed from cart:', { itemId, cartItems: cart.items });
    } else {
      // Handle for non-authenticated users using session
      if (!req.session.cart) {
        req.flash('error', 'Cart not found');
        return res.redirect('/cart');
      }

      // Remove item from session cart
      req.session.cart.items = req.session.cart.items.filter(
        (item) => item._id !== itemId
      );

      // Calculate totals
      calculateSessionCartTotals(req.session.cart);
      // console.log('Removed from session cart:', { itemId, cartItems: req.session.cart.items });
    }

    req.flash('success', 'Item removed from cart');
    res.redirect('/cart');
  } catch (err) {
    console.error('Error removing item:', err);
    req.flash('error', 'Failed to remove item from cart');
    res.redirect('/cart');
  }
});

// Clear cart
router.post('/clear', async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      // Find cart for authenticated user
      const cart = await Cart.findOne({ customer: req.user._id });
      if (!cart) {
        req.flash('error', 'Cart not found');
        return res.redirect('/cart');
      }

      // Clear cart
      cart.items = [];
      await cart.calculateTotals();
      await cart.save();
      // console.log('Cleared cart:', { cartItems: cart.items });
    } else {
      // Handle for non-authenticated users using session
      if (req.session.cart) {
        req.session.cart.items = [];
        calculateSessionCartTotals(req.session.cart);
        // console.log('Cleared session cart:', { cartItems: req.session.cart.items });
      }
    }

    req.flash('success', 'Cart cleared');
    res.redirect('/cart');
  } catch (err) {
    console.error('Error clearing cart:', err);
    req.flash('error', 'Failed to clear cart');
    res.redirect('/cart');
  }
});

// Get cart count (for AJAX)
router.get('/count', async (req, res) => {
  try {
    let count = 0;
    if (req.isAuthenticated()) {
      const cart = await Cart.findOne({ customer: req.user._id });
      count = cart ? cart.items.reduce((total, item) => total + item.quantity, 0) : 0;
    } else {
      if (req.session.cart && req.session.cart.items) {
        count = req.session.cart.items.reduce((total, item) => total + item.quantity, 0);
      }
    }

    res.json({ count });
  } catch (err) {
    console.error('Error getting cart count:', err);
    res.status(500).json({ error: 'Failed to get cart count' });
  }
});

// Merge guest cart with user cart after login
router.post('/merge', ensureAuthenticated, async (req, res) => {
  try {
    // Check if there's a session cart to merge
    if (!req.session.cart || !req.session.cart.items || req.session.cart.items.length === 0) {
      return res.redirect('/cart');
    }

    // Find or create user cart
    let userCart = await Cart.findOne({ customer: req.user._id });
    if (!userCart) {
      userCart = new Cart({
        customer: req.user._id,
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
        discount: 0,
      });
    }

    // Merge items from session cart to user cart
    for (const sessionItem of req.session.cart.items) {
      const product = await Product.findById(sessionItem.product);
      if (!product) continue;

      // Check if product already in user cart
      const existingItemIndex = userCart.items.findIndex(
        (item) => item.product.toString() === sessionItem.product.toString()
      );

      if (existingItemIndex > -1) {
        // Update quantity if product already in cart
        userCart.items[existingItemIndex].quantity += sessionItem.quantity;

        // Check if new quantity exceeds stock
        if (userCart.items[existingItemIndex].quantity > product.stock) {
          userCart.items[existingItemIndex].quantity = product.stock;
        }
      } else {
        // Add new item to cart
        userCart.items.push({
          product: sessionItem.product,
          quantity: sessionItem.quantity,
          price: sessionItem.price,
          name: sessionItem.name,
          image: sessionItem.image,
        });
      }
    }

    // Calculate totals and save
    await userCart.calculateTotals();
    await userCart.save();
    // console.log('Merged cart:', { cartItems: userCart.items });

    // Clear session cart
    delete req.session.cart;

    req.flash('success', 'Your guest cart has been merged with your account');
    res.redirect('/cart');
  } catch (err) {
    console.error('Error merging carts:', err);
    req.flash('error', 'Failed to merge carts');
    res.redirect('/cart');
  }
});

// Validate cart (remove invalid items)
router.post('/validate', ensureAuthenticated, async (req, res) => {
  try {
    const cart = await Cart.findOne({ customer: req.user._id });
    if (!cart) {
      req.flash('error', 'Cart not found');
      return res.redirect('/cart');
    }

    // Check each item for validity
    const validItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (product && product.stock >= item.quantity) {
        validItems.push(item);
      }
    }

    // Update cart with valid items
    cart.items = validItems;
    await cart.calculateTotals();
    await cart.save();
    // console.log('Validated cart:', { cartItems: cart.items });

    req.flash('success', 'Cart validated');
    res.redirect('/cart');
  } catch (err) {
    console.error('Error validating cart:', err);
    req.flash('error', 'Failed to validate cart');
    res.redirect('/cart');
  }
});

// Add item to cart with stock update
router.post('/add-with-stock-update', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = Number.parseInt(quantity) || 1;

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/products');
    }

    // Check if product is in stock
    if (product.stock < qty) {
      req.flash('error', 'Not enough stock available');
      return res.redirect(`/products/${productId}`);
    }

    // Update stock
    product.stock -= qty;
    await product.save();

    // Determine the price
    const price = product.onSale ? product.salePrice : product.price;

    if (req.isAuthenticated()) {
      // Find or create cart
      let cart = await Cart.findOne({ customer: req.user._id });
      if (!cart) {
        cart = new Cart({
          customer: req.user._id,
          items: [],
          subtotal: 0,
          tax: 0,
          shipping: 0,
          total: 0,
          discount: 0,
        });
      }

      // Check if product already in cart
      const existingItemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId
      );

      if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity += qty;
      } else {
        cart.items.push({
          product: productId,
          quantity: qty,
          price,
          name: product.name,
          image: product.mainImage,
        });
      }

      // Calculate totals and save
      await cart.calculateTotals();
      await cart.save();
      // console.log('Added to cart with stock update:', { productId, qty, cartItems: cart.items });
    } else {
      // Handle session cart
      if (!req.session.cart) {
        req.session.cart = {
          items: [],
          subtotal: 0,
          tax: 0,
          shipping: 0,
          total: 0,
          discount: 0,
        };
      }

      const existingItemIndex = req.session.cart.items.findIndex(
        (item) => item.product.toString() === productId
      );

      if (existingItemIndex > -1) {
        req.session.cart.items[existingItemIndex].quantity += qty;
      } else {
        req.session.cart.items.push({
          _id: new mongoose.Types.ObjectId().toString(),
          product: productId,
          quantity: qty,
          price,
          name: product.name,
          image: product.mainImage,
        });
      }

      calculateSessionCartTotals(req.session.cart);
      // console.log('Added to session cart with stock update:', { productId, qty, cartItems: req.session.cart.items });
    }

    req.flash('success', 'Product added to cart and stock updated');
    res.redirect('/cart');
  } catch (err) {
    console.error('Error adding to cart with stock update:', err);
    req.flash('error', 'Failed to add product to cart');
    res.redirect('/products');
  }
});

// Helper function to calculate session cart totals
function calculateSessionCartTotals(cart) {
  cart.subtotal = cart.items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);

  cart.shipping = cart.subtotal >= 50 ? 0 : 5.99;
  cart.tax = Number.parseFloat((cart.subtotal * 0.085).toFixed(2));
  cart.total = Number.parseFloat((cart.subtotal + cart.shipping + cart.tax).toFixed(2));

  return cart;
}

module.exports = router;