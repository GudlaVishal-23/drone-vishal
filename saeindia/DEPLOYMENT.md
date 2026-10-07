# SAE INDIA Drone Rescue & QR Mission — Cloud Deployment Guide

This guide details the exact, tested steps to deploy the **Backend on Render** and the **Frontend on Netlify** with zero errors.

---

## 🏗️ Architecture Overview

```text
[ Browser GCS (Netlify) ]  <--- HTTPS / WSS --->  [ Relay Server (Render) ]
         ^                                                   ^
         | (WebRTC P2P Direct + Relay Broadcast Fallback)     | (WSS /connector)
         v                                                   v
[ Field Runner Device ]                            [ Local Connector Agent (Laptop/Pi) ]
                                                             | (LAN ws://192.168.31.x:8080/ws)
                                                             v
                                                    [ Drone ESP32 Bridge + Pixhawk ]
```

---

## 1. Backend Deployment (Render)

The backend is located in [`relay-server/`](file:///c:/Antigravityyyyy/Drone/saeindia/relay-server). It multiplexes binary MAVLink frames and JSON control messages between the frontend and the local ESP32 connector.

### Option A: Automatic Blueprint Deployment (Recommended)
1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository (`GudlaVishal-23/Antigravity-Projects` or your drone repository).
4. Render will automatically detect [`render.yaml`](file:///c:/Antigravityyyyy/Drone/saeindia/render.yaml) and configure the service.
5. Click **Apply**.

### Option B: Manual Web Service Setup
If creating the service manually:
1. Go to **New +** -> **Web Service**.
2. Select your repository.
3. Configure settings:
   - **Name**: `saeindia-relay-server`
   - **Root Directory**: `relay-server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
4. Expand **Advanced**:
   - **Health Check Path**: `/health`
5. Under **Environment Variables**, add:
   - `PORT`: `10000` (Render will default to this automatically)
   - `RELAY_TOKEN`: `saeindia_sec_99348a7b1c0e`
   - `NODE_ENV`: `production`
6. Click **Create Web Service**.

### 🔎 Verifying Backend Deployment
Once deployed, Render gives you a domain (e.g., `https://saeindia-relay-server.onrender.com`).
- Open `https://<YOUR-RENDER-NAME>.onrender.com/health` in your browser.
- You should see:
  ```json
  {
    "service": "SAE INDIA MAVLink Secure WSS Relay",
    "status": "ok",
    "uptime": ...,
    "connectorOnline": false,
    "esp32Online": false,
    "browserClientsCount": 0
  }
  ```
- Your secure WebSocket URL is:
  `wss://<YOUR-RENDER-NAME>.onrender.com/ws`

---

## 2. Frontend Deployment (Netlify)

The frontend is a Vite + React application in the root directory.

### Step-by-Step Setup:
1. Log in to [Netlify](https://app.netlify.com/).
2. Click **Add new site** -> **Import an existing project**.
3. Select GitHub and choose your repository.
4. Netlify will automatically detect [`netlify.toml`](file:///c:/Antigravityyyyy/Drone/saeindia/netlify.toml). Verify the build settings:
   - **Base directory**: (leave blank / root)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Go to **Site configuration** -> **Environment variables** -> **Add variables**:
   - `VITE_SECURE_RELAY_URL` = `wss://<YOUR-RENDER-NAME>.onrender.com/ws`
   - `VITE_RELAY_TOKEN` = `saeindia_sec_99348a7b1c0e`
6. Click **Deploy site**.

### 🔎 Verifying Frontend Deployment
1. Visit your Netlify URL (e.g., `https://saeindia-drone.netlify.app/`).
2. Verify SPA routing by refreshing any page (handled by `dist/_redirects`).
3. Verify that the standalone location map works by navigating to:
   `https://saeindia-drone.netlify.app/googlemaps.html`
4. In the GCS dashboard, open the **Pixhawk / ESP32 Connection Card**:
   - Select **Secure Cloud Relay (Render)**.
   - The relay endpoint will display your Render WSS URL.
   - (Note: You can also update the relay URL on-the-fly directly inside the UI without rebuilding).

---

## 3. Local Ground Connector (Field Laptop / Raspberry Pi)

During live flight operations with the actual drone:
1. Connect your ground laptop or Raspberry Pi to the ESP32 Wi-Fi network (e.g., `drone123`).
2. Navigate to [`local-connector/`](file:///c:/Antigravityyyyy/Drone/saeindia/local-connector):
   ```bash
   cd local-connector
   npm install
   ```
3. Set your environment variables (or update `.env`):
   ```bash
   # ESP32 IP on the drone Wi-Fi
   ESP32_HOST=192.168.31.194
   ESP32_PORT=8080
   ESP32_PATH=/ws

   # Outbound Cloud Relay on Render (No port forwarding needed!)
   RELAY_URL=wss://<YOUR-RENDER-NAME>.onrender.com/connector
   RELAY_TOKEN=saeindia_sec_99348a7b1c0e
   ```
4. Run the connector:
   ```bash
   node index.js
   ```
5. The connector establishes an outbound WSS tunnel to Render and bridges real-time MAVLink telemetry to the Netlify GCS.

---

## 4. Local Build & Test Validation

Before pushing any commit, you can run the built-in automated test suites:

```bash
# 1. Typecheck and bundle production assets
npm run build

# 2. End-to-end telemetry pipeline verification
npm run test:e2e
```

Both commands pass with exit code `0`.
