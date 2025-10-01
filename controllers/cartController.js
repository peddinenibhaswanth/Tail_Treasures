const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Add item to cart
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user._id; // Assumes user is authenticated

    // Find or create a cart for the user
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [], subtotal: 0, tax: 0, shipping: 0, total: 0, discount: 0 });
    }

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if the product is already in the cart
    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex > -1) {
      // Update quantity if product exists
      cart.items[itemIndex].quantity += parseInt(quantity);
    } else {
      // Add new product to cart
      cart.items.push({ product: productId, quantity: parseInt(quantity) });
    }

    // Recalculate totals
    await cart.save();
    await recalculateCart(cart);

    res.redirect('/cart'); // Redirect to cart page
  } catch (err) {
    console.error('Error adding to cart:', err);
    res.status(500).send('Server Error');
  }
};

// Helper function to recalculate cart totals
async function recalculateCart(cart) {
  try {
    cart.subtotal = 0;
    cart.tax = 0;
    cart.shipping = 0;
    cart.total = 0;

    // Populate items to get product details
    await cart.populate('items.product');
    
    for (const item of cart.items) {
      const price = item.product.onSale ? item.product.salePrice : item.product.price;
      cart.subtotal += price * item.quantity;
    }

    // Calculate tax (8%)
    cart.tax = cart.subtotal * 0.08;

    // Calculate shipping (free if subtotal >= 50)
    cart.shipping = cart.subtotal >= 50 ? 0 : 5; // Example shipping cost

    // Calculate total
    cart.total = cart.subtotal + cart.tax + cart.shipping - (cart.discount || 0);

    await cart.save();
  } catch (err) {
    console.error('Error recalculating cart:', err);
  }
}