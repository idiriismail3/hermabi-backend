const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS
const frontendUrl = process.env.FRONTEND_URL || 'https://hermabi-frontend11.onrender.com';
app.use(cors({
  origin: frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Orders file
const ordersFile = path.join(__dirname, 'orders.json');

function loadOrders() {
  try {
    if (fs.existsSync(ordersFile)) {
      return JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading orders:', e);
  }
  return [];
}

function saveOrderToFile(order) {
  try {
    const orders = loadOrders();
    orders.push(order);
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
  } catch (e) {
    console.error('Error saving order:', e);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', cmiConfigured: false });
});

// Checkout endpoint
app.post('/api/checkout', (req, res) => {
  try {
    const { customer, items, subtotal, shipping, total, paymentMethod } = req.body;

    if (!customer || !items || !total || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const orderId = `HMB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const order = {
      id: orderId,
      customer: customer,
      items: items,
      subtotal: subtotal,
      shipping: shipping,
      total: total,
      paymentMethod: paymentMethod,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    saveOrderToFile(order);

    res.json({
      success: true,
      orderId: orderId,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all orders
app.get('/api/orders', (req, res) => {
  try {
    const orders = loadOrders();
    res.json({ success: true, orders: orders });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

// Get single order
app.get('/api/orders/:orderId', (req, res) => {
  try {
    const orders = loadOrders();
    const order = orders.find(o => o.id === req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ success: true, order: order });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Hermabi backend running on port ${PORT}`);
  console.log(`✓ Frontend: ${frontendUrl}`);
});

module.exports = app;
