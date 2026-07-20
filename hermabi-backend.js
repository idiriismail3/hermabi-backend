// ============================================================================
// HERMABI BACKEND — Node.js + Express
// Handles checkout, CMI payment processing, and order management
// ============================================================================

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8000',
  credentials: true,
}));

// ============================================================================
// CMI CONFIGURATION — Replace with YOUR credentials from your bank
// ============================================================================
const CMI_CONFIG = {
  clientid: process.env.CMI_CLIENTID || 'YOUR_MERCHANT_ID_HERE',
  storekey: process.env.CMI_STOREKEY || 'YOUR_SECRET_KEY_HERE',
  apiUrl: process.env.CMI_API_URL || 'https://cmi.co.ma/tccommercewebapi/api',  // Production
  testUrl: 'https://testpayment.cmi.co.ma/tccommercewebapi/api',  // Sandbox for testing
  // Use testUrl until you go live
};

// ============================================================================
// ORDERS STORAGE — Currently JSON file; upgrade to MongoDB/PostgreSQL later
// ============================================================================
const ORDERS_FILE = path.join(__dirname, 'orders.json');

function loadOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading orders:', e);
  }
  return [];
}

function saveOrder(order) {
  const orders = loadOrders();
  orders.push(order);
  // Note: This saves to backend's memory. For persistent storage, use a database.
  // For now, we'll rely on frontend localStorage
  return order;
}

function getOrder(orderId) {
  const orders = loadOrders();
  return orders.find(o => o.id === orderId);
}

// ============================================================================
// HELPER: Generate CMI Payment Hash
// ============================================================================
function generateCMIHash(params) {
  // CMI requires a specific hash format: param1:param2:...storekey
  // Order matters — consult CMI documentation for exact sequence
  const hashString = `${params.amount}:${params.orderid}:${params.currency}:${CMI_CONFIG.storekey}`;
  return crypto.createHash('sha256').update(hashString).digest('hex');
}

// ============================================================================
// ROUTE: Initiate Payment (called from checkout)
// ============================================================================
app.post('/api/checkout', (req, res) => {
  try {
    const { customer, items, subtotal, shipping, total, paymentMethod } = req.body;

    // Validation
    if (!customer || !items || !total) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Validate payment method
    if (!['cod', 'card', 'whatsapp'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
}

    // Create order record
    const orderId = 'HMB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const order = {
      id: orderId,
      timestamp: new Date().toISOString(),
      customer: customer,
      items: items,
      subtotal: subtotal,
      shipping: shipping,
      total: total,
      paymentMethod: paymentMethod,
      status: 'pending',
    };

    // Save order
    saveOrder(order);

    // If COD (cash on delivery), mark as confirmed and return success
    if (paymentMethod === 'cod') {
      order.status = 'confirmed';
      // In production, send email to customer and admin here
      return res.json({
        success: true,
        message: 'Order confirmed — payment due at delivery',
        orderId: orderId,
        redirectUrl: `/order-confirmed?id=${orderId}`,
      });
    }
    // If WhatsApp payment
    if (paymentMethod === 'whatsapp') {
      order.status = 'pending_whatsapp';
      saveOrder(order);
      return res.json({
        success: true,
        message: 'WhatsApp redirect',
        orderId: orderId,
        redirectUrl: `/order-confirmed?id=${orderId}`,
  });
}

    // If card payment, prepare CMI redirect
    if (paymentMethod === 'card') {
      // Build CMI payment request
      const cmiPayment = {
        clientid: CMI_CONFIG.clientid,
        amount: Math.round(total * 100), // CMI expects amount in cents
        currency: '504', // MAD currency code for CMI
        orderid: orderId,
        okUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payment-success`,
        failUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payment-failure`,
        cancelUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payment-cancel`,
        refreshtime: '0',
        trantype: 'PreAuth', // or 'Sales' depending on your CMI setup
      };

      // Generate security hash
      cmiPayment.hash = generateCMIHash(cmiPayment);

      // Return redirect info to frontend
      return res.json({
        success: true,
        message: 'Redirecting to secure payment gateway',
        orderId: orderId,
        cmiUrl: CMI_CONFIG.testUrl, // Use testUrl for testing, apiUrl for production
        cmiPayload: cmiPayment,
      });
    }

    res.status(400).json({ error: 'Invalid payment method' });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Checkout failed', details: error.message });
  }
});

// ============================================================================
// ROUTE: Payment Success (CMI redirects here after successful payment)
// ============================================================================
app.post('/api/payment-success', (req, res) => {
  try {
    const { orderid, tranid, response } = req.body;

    // Verify the transaction with CMI (in production)
    // For now, just update order status
    const order = getOrder(orderid);
    if (order) {
      order.status = 'paid';
      order.transactionId = tranid;
      order.cmiResponse = response;
      saveOrder(order);
      // In production, send confirmation email to customer and admin
    }

    // Redirect to success page (or return JSON for SPA)
    res.json({
      success: true,
      message: 'Payment successful',
      orderId: orderid,
      redirectUrl: `/order-confirmed?id=${orderid}`,
    });
  } catch (error) {
    console.error('Payment success error:', error);
    res.status(500).json({ error: 'Payment confirmation failed' });
  }
});

// ============================================================================
// ROUTE: Payment Failure
// ============================================================================
app.post('/api/payment-failure', (req, res) => {
  try {
    const { orderid } = req.body;
    const order = getOrder(orderid);
    if (order) {
      order.status = 'payment_failed';
      saveOrder(order);
    }
    res.json({
      success: false,
      message: 'Payment failed',
      orderId: orderid,
      redirectUrl: `/checkout?error=payment_failed&orderId=${orderid}`,
    });
  } catch (error) {
    console.error('Payment failure error:', error);
    res.status(500).json({ error: 'Error processing payment failure' });
  }
});

// ============================================================================
// ROUTE: Payment Cancelled
// ============================================================================
app.post('/api/payment-cancel', (req, res) => {
  try {
    const { orderid } = req.body;
    const order = getOrder(orderid);
    if (order) {
      order.status = 'cancelled';
      saveOrder(order);
    }
    res.json({
      success: false,
      message: 'Payment cancelled by user',
      orderId: orderid,
      redirectUrl: `/checkout?error=payment_cancelled&orderId=${orderid}`,
    });
  } catch (error) {
    console.error('Payment cancel error:', error);
    res.status(500).json({ error: 'Error processing cancellation' });
  }
});

// ============================================================================
// ROUTE: Get Order Status (for order tracking page)
// ============================================================================
app.get('/api/orders/:orderId', (req, res) => {
  try {
    const order = getOrder(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Order lookup error:', error);
    res.status(500).json({ error: 'Failed to retrieve order' });
  }
});

// ============================================================================
// ROUTE: Health Check
// ============================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    cmiConfigured: CMI_CONFIG.clientid !== 'YOUR_MERCHANT_ID_HERE',
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Unknown error',
  });
});

// ============================================================================
// START SERVER
// ============================================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads folder if it doesn't exist
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Setup multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Image upload endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const imageUrl = `${process.env.BACKEND_URL}/uploads/${req.file.filename}`;
  res.json({ success: true, imageUrl });
});

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.listen(PORT, () => {
  console.log(`\n=================================`);
  console.log(`HERMABI Backend Server`);
  console.log(`=================================`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend: ${process.env.FRONTEND_URL || 'http://localhost:8000'}`);
  console.log(`\n⚠️  CMI Configuration Status:`);
  if (CMI_CONFIG.clientid === 'YOUR_MERCHANT_ID_HERE') {
    console.log(`❌ NOT CONFIGURED — Add .env file with:`);
    console.log(`   CMI_CLIENTID=your_merchant_id`);
    console.log(`   CMI_STOREKEY=your_secret_key`);
    console.log(`   CMI_API_URL=https://cmi.co.ma/tccommercewebapi/api`);
  } else {
    console.log(`✓ Configured with merchant ID: ${CMI_CONFIG.clientid}`);
  }
  console.log(`\nAPI endpoints:`);
  console.log(`  POST /api/checkout — Initiate payment`);
  console.log(`  GET  /api/orders/:orderId — Get order status`);
  console.log(`  GET  /health — Server health check`);
  console.log(`=================================\n`);
});
