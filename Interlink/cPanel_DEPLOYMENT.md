# Production Deployment Guide (cPanel / Apache / LiteSpeed)
**Target Domain:** `https://interlink.jeenhost.in/`

---

## 1. Quick Overview

Your project is built with:
- **Frontend**: Vite + React SPA (outputs to `frontend/dist/`).
- **Backend**: Express + Socket.IO + MySQL (runs on Node.js port `5000` by default).

The generated [`.htaccess`](file:///.htaccess) acts as a unified traffic controller:
1. **Forces HTTPS** on all traffic.
2. **Reverse Proxies `/api/*`** to the local Node.js process (`http://127.0.0.1:5000/api/`).
3. **Reverse Proxies `/socket.io/*`** (both WebSockets `ws://` and HTTP polling) for real-time chat & meetings.
4. **Proxies `/uploads/*`** to the backend storage directory.
5. **Rewrites all other routes** to `/index.html` so client-side React routes (`/login`, `/admin/dashboard`, `/chat`, `/projects`, etc.) load without 404 errors.
6. **Adds production security headers** (`X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, etc.) and GZIP compression.

---

## 2. Step-by-Step Deployment on cPanel

### Step A: Deploy the Backend (Node.js App)
1. In cPanel, navigate to **"Setup Node.js App"** (or CloudLinux Node.js selector).
2. Click **"Create Application"**:
   - **Node.js version**: Choose `18.x`, `20.x`, or `22.x`.
   - **Application mode**: `Production`
   - **Application root**: `interlink-backend` (outside `public_html`)
   - **Application URL**: Can be set to a temporary path or subdomain.
   - **Application startup file**: `index.js`
3. Upload all files from the `backend/` folder into `interlink-backend/` on your server.
4. Set the environment variables in cPanel or in `interlink-backend/.env`:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=your_cpanel_db_user
   DB_PASSWORD=your_cpanel_db_password
   DB_NAME=your_cpanel_db_name
   DB_PORT=3306
   JWT_SECRET=your_strong_random_jwt_secret_here
   FRONTEND_URL=https://interlink.jeenhost.in
   UPLOAD_DIR=uploads
   UPLOAD_BASE_URL=https://interlink.jeenhost.in/uploads
   UPLOAD_SERVE_METHOD=express
   ```
5. Click **"Run NPM Install"** in the cPanel Node.js dashboard.
6. Click **"Start / Restart"** application.

---

### Step B: Deploy the Frontend
1. Run the production build locally:
   ```bash
   cd frontend
   npm run build
   ```
2. The `frontend/dist/` folder now contains:
   - `index.html`
   - `assets/` (bundled JS & CSS)
   - `.htaccess` (automatically copied from `public/.htaccess`)
3. Upload all files inside `frontend/dist/` directly into the document root of `interlink.jeenhost.in` (typically `public_html/` or `public_html/interlink/`).
4. Ensure the `.htaccess` file is uploaded (in cPanel File Manager, click **Settings** (top right) -> check **"Show Hidden Files (dotfiles)"** so `.htaccess` is visible).

---

### Step C: Note on Custom Node.js Ports
If your cPanel server assigns a custom port (e.g. `3000` or an internal port like `39281` instead of `5000`), simply update the port in your document root `.htaccess`:
```apache
RewriteRule ^socket\.io/(.*) ws://127.0.0.1:YOUR_PORT/socket.io/$1 [P,L]
RewriteRule ^socket\.io/(.*) http://127.0.0.1:YOUR_PORT/socket.io/$1 [P,L]
RewriteRule ^api/(.*) http://127.0.0.1:YOUR_PORT/api/$1 [P,L]
```
