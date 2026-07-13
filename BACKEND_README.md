# HERMABI Backend Files — Quick Summary

## 📦 What You Have

### Core Backend Files
- **hermabi-backend.js** — Main Node.js server (all the payment logic)
- **package.json** — Dependencies list (express, cors, dotenv)
- **.env.example** — Configuration template

### Documentation
- **BACKEND_SETUP.md** — Complete setup & deployment guide
- **This file** — Quick reference

---

## 🚀 Quick Start (3 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Copy env template
cp .env.example .env

# 3. Start server
npm start

# 4. Test it
curl http://localhost:3000/health
```

Should see: `{"status":"ok","cmiConfigured":false}`

---

## 📋 What Happens Next

### Immediate (This Week)
1. ✅ Backend is running locally (test mode)
2. ✅ Frontend connects to backend for COD orders (works immediately)
3. ✅ Card orders go through (but require CMI credentials)

### When You Get CMI Credentials (1-2 weeks)
1. Contact your bank → get merchant ID + secret key
2. Add to `.env` file:
   ```
   CMI_CLIENTID=your_merchant_id
   CMI_STOREKEY=your_secret_key
   ```
3. Restart server → card payments work

### When You Deploy (2-3 weeks)
1. Push to GitHub
2. Deploy to Render.com (free) or similar
3. Update frontend `BACKEND_URL` to your hosted domain
4. Go live

---

## 🔌 API Endpoints

### POST /api/checkout
**What:** Receive cart & customer data, create order, prepare payment

**Input:**
```json
{
  "customer": {
    "fullname": "John Doe",
    "email": "john@example.com",
    "phone": "+212600000000",
    "address": "123 Rue Example",
    "city": "Casablanca"
  },
  "items": [...],
  "subtotal": 300,
  "shipping": 39,
  "total": 339,
  "paymentMethod": "cod" or "card"
}
```

**Output (COD):**
```json
{
  "success": true,
  "message": "Order confirmed",
  "orderId": "HMB-1234567890-abc123",
  "redirectUrl": "/order-confirmed?id=..."
}
```

**Output (Card):**
```json
{
  "success": true,
  "message": "Redirecting to payment gateway",
  "orderId": "HMB-1234567890-abc123",
  "cmiUrl": "https://cmi.co.ma/...",
  "cmiPayload": { "clientid": "...", "hash": "..." }
}
```

### GET /api/orders/:orderId
**What:** Look up order status

**Output:**
```json
{
  "id": "HMB-123...",
  "timestamp": "2026-07-11T...",
  "customer": {...},
  "items": [...],
  "total": 339,
  "status": "pending|confirmed|paid|payment_failed|cancelled",
  "paymentMethod": "cod|card"
}
```

### GET /health
**What:** Check if backend is running

**Output:** `{"status":"ok","cmiConfigured":false}`

---

## 🔐 Security Notes

- ✅ All API calls are POST/GET (no sensitive data in URLs)
- ✅ CORS restricts frontend access (only your domain)
- ✅ CMI credentials stored in `.env` (never in code)
- ✅ Card details NEVER touch your server (CMI handles them)
- ⚠️ In production, use HTTPS everywhere
- ⚠️ Never commit `.env` to GitHub (only `.env.example`)

---

## 📍 File Locations

When you download:
```
your-backend-folder/
├── hermabi-backend.js      ← Main server
├── package.json             ← Dependencies
├── .env.example             ← Config template
├── BACKEND_SETUP.md         ← Full guide
└── node_modules/            ← Downloaded packages (after npm install)
└── orders.json              ← Created automatically when orders are placed
```

---

## 🎯 Next Steps

1. **Today:** Run `npm install` and test locally
2. **This week:** Contact your bank for CMI setup
3. **Next week:** Add CMI credentials to `.env`
4. **Before launch:** Deploy to Render.com or similar

---

## ❓ Common Questions

**Q: Do I need to change anything for COD orders?**
A: No, they work out of the box. Customer info is stored, status set to "confirmed".

**Q: When does card payment happen?**
A: When customer clicks "Confirmer la commande" with card selected → redirected to CMI → card charged on CMI's page (not yours).

**Q: What if CMI is down?**
A: Backend catches errors and sends "payment_failure" notification. Customer can retry.

**Q: Can I test without CMI credentials?**
A: Yes, fully. COD works immediately. Card orders will fail gracefully (good for UI testing).

**Q: Where does the money go?**
A: Bank account you register with CMI. CMI deposits daily/weekly depending on your agreement.

---

**Questions?** See BACKEND_SETUP.md for detailed guides, or ask your bank for CMI documentation.
