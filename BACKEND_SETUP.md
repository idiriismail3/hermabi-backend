# HERMABI Backend — Setup & Deployment Guide

## Overview

This is a Node.js/Express backend server that handles:
- ✅ Checkout processing (receives cart data from frontend)
- ✅ CMI payment gateway integration (secure card processing)
- ✅ Order management (stores orders with payment status)
- ✅ Payment notifications (success/failure/cancellation)

**Payment Flow:**
```
Customer fills checkout → Frontend posts to /api/checkout → 
Backend validates & creates order → 
If CARD: returns CMI redirect info → Customer enters card on CMI's secure page → 
CMI confirms payment → Backend marks order as paid
If COD: order confirmed immediately
```

---

## Prerequisites

- **Node.js** 14+ ([download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **CMI merchant account** from your Moroccan bank (not needed to test, but needed to go live)
- **Hosting** (see below for options)

---

## Local Setup (Testing)

### 1. Download Backend Files
You have:
- `hermabi-backend.js` — the main server code
- `package.json` — dependencies list
- `.env.example` — configuration template

### 2. Install Dependencies
```bash
npm install
```
This downloads express, cors, dotenv, etc.

### 3. Create `.env` File
```bash
cp .env.example .env
```
Then edit `.env` and fill in:
```
PORT=3000
FRONTEND_URL=http://localhost:8000
BACKEND_URL=http://localhost:3000
CMI_CLIENTID=YOUR_VALUE_HERE
CMI_STOREKEY=YOUR_VALUE_HERE
CMI_API_URL=https://testpayment.cmi.co.ma/tccommercewebapi/api
```

**Note:** Leave CMI values as-is for now. The server will work without real CMI credentials (just won't process real payments). Once your bank gives you credentials, plug them in here.

### 4. Start the Server
```bash
npm start
```
You should see:
```
=================================
HERMABI Backend Server
=================================
Server running on port 3000
Frontend: http://localhost:8000

⚠️  CMI Configuration Status:
❌ NOT CONFIGURED — Add .env file with:
   CMI_CLIENTID=your_merchant_id
   CMI_STOREKEY=your_secret_key
```

### 5. Test It
```bash
curl http://localhost:3000/health
```
Should return: `{"status":"ok","cmiConfigured":false}`

---

## Connect Frontend to Backend

In your **frontend checkout.html**, update the payment handling to send to this backend:

**Where:** In the `checkout-form` submit handler

**Current code (frontend-only):** Just shows confirmation locally

**New code (with backend):**
```javascript
// In checkout.html, replace the handleSubmit function:
async function handleSubmit(e){
  e.preventDefault();
  const form = e.target;
  if(!validate(form)) return;
  
  const cart = getCart();
  const total = cartTotal();
  const customer = {
    fullname: form.querySelector('[name="fullname"]').value,
    email: form.querySelector('[name="email"]').value,
    phone: form.querySelector('[name="phone"]').value,
    address: form.querySelector('[name="address"]').value,
    city: form.querySelector('[name="city"]').value,
  };
  const paymentMethod = form.querySelector('[name="payment"]:checked').value;

  try {
    // Send to backend
    const response = await fetch('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer,
        items: cart.map(item => ({
          id: item.id,
          name: getProduct(item.id).name,
          qty: item.qty,
          price: getProduct(item.id).price,
        })),
        subtotal: cartSubtotal(),
        shipping: shippingCost(),
        total,
        paymentMethod,
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      showToast('Erreur: ' + result.error);
      return;
    }

    // If COD (cash on delivery), show confirmation
    if (paymentMethod === 'cod') {
      showConfirmation(result.orderId, total, 'cod');
      saveCart([]);
      return;
    }

    // If card, redirect to CMI payment page
    if (paymentMethod === 'card') {
      // This part requires more setup — see "CMI Integration" below
      showCardPaymentRedirect(result.orderId, result.cmiPayload, result.cmiUrl);
    }
  } catch (error) {
    console.error('Checkout error:', error);
    showToast('Erreur de connexion au serveur');
  }
}
```

---

## CMI Integration (When You Have Credentials)

Once your bank provides CMI credentials:

1. **Add to `.env`:**
   ```
   CMI_CLIENTID=your_actual_merchant_id
   CMI_STOREKEY=your_actual_secret_key
   CMI_API_URL=https://cmi.co.ma/tccommercewebapi/api  (for production)
   ```

2. **Test with CMI Sandbox first:**
   ```
   CMI_API_URL=https://testpayment.cmi.co.ma/tccommercewebapi/api
   ```
   Use test card numbers CMI provides (e.g., 4111 1111 1111 1111)

3. **Frontend card form submission:** When user clicks "Confirmer la commande", the backend will:
   - Create order
   - Return CMI payment URL + form data
   - Frontend redirects user to CMI's secure payment page
   - User enters card details on CMI's page (NOT on your site — more secure)
   - CMI confirms payment back to your backend
   - Backend updates order status to "paid"
   - User sees confirmation

---

## Deployment to Hosting

### Option 1: Render.com (Easiest, Free Tier Available)

1. Push code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. Go to [render.com](https://render.com) → Sign up → "New +"  → "Web Service"

3. Connect your GitHub repo, select main branch

4. Set environment variables:
   - In Render dashboard, go to "Environment" → paste values from `.env`

5. Deploy! Render will auto-start with `npm start`

**Your backend URL:** `https://hermabi-backend-abc123.onrender.com` (something like this)

### Option 2: Heroku (Classic, but requires payment)

1. Install Heroku CLI
2. `heroku login`
3. `heroku create hermabi-backend`
4. Push environment variables: `heroku config:set CMI_CLIENTID=xxx CMI_STOREKEY=yyy`
5. `git push heroku main`

### Option 3: Digital Ocean App Platform (~$5/mo)

Similar to Render but more control. Recommended for serious businesses.

### Option 4: OVH/Hetzner (Moroccan-friendly hosting)

These French/European hosts often work well in Morocco:
- OVH.com
- Hetzner.com
- Scaleway.com

---

## Production Checklist

Once you're ready to go live:

- ✅ CMI credentials plugged into `.env`
- ✅ `CMI_API_URL` set to production (not sandbox)
- ✅ `BACKEND_URL` set to your actual domain (e.g., `https://api.hermabi.ma`)
- ✅ `FRONTEND_URL` set to your store (e.g., `https://hermabi.ma`)
- ✅ `NODE_ENV=production` in `.env`
- ✅ Use HTTPS everywhere (hosting provider should provide free SSL)
- ✅ Bank account verified with CMI (they'll confirm deposits work)

---

## Troubleshooting

**Q: Backend won't start**
- Check Node.js is installed: `node --version`
- Check dependencies: `npm install`
- Check `.env` file exists and is readable

**Q: Frontend can't reach backend**
- Make sure backend is running: `curl http://localhost:3000/health`
- Check CORS: backend must have FRONTEND_URL matching your frontend domain
- Check firewall isn't blocking port 3000

**Q: CMI payment fails**
- Verify CMI credentials in `.env` are correct (ask your bank)
- Use sandbox URL first (`testpayment.cmi.co.ma`) to test
- Check CMI documentation for hash format (it's strict)

**Q: Orders not saving**
- Backend creates `orders.json` automatically
- Make sure backend has write permissions to its folder
- In production, replace JSON with a real database (MongoDB, PostgreSQL)

---

## Next Steps

1. **Get CMI credentials:** Contact your bank this week
2. **Deploy backend:** Use Render.com (free, easiest)
3. **Update frontend checkout:** Add the backend API call (code above)
4. **Test with sandbox:** Use CMI test cards
5. **Go live:** Switch to production credentials

---

## Support

**Need help?**
- CMI docs: https://cmi.co.ma/ (ask your bank for API docs)
- Express.js: https://expressjs.com/
- Render deployment: https://render.com/docs

Let me know once you have CMI credentials — I can update the backend with the exact hash format and callback handling they require.
