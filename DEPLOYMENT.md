# 🚀 Deployment Guide: GitHub & Vercel

This guide provides step-by-step instructions to push **ORATIONAL** to GitHub and deploy it live to **Vercel** and **GitHub Pages**.

---

## 1. Push to GitHub

### Option A: Using the Automated Script (Windows)
Double-click **`push-to-github.bat`** in the project root folder. It will ask for your GitHub repository URL and automatically push all code.

---

### Option B: Manual Command Line
Open your terminal (PowerShell or Bash) in this project directory:

```bash
# 1. Initialize git (if not already initialized) and verify status
git status

# 2. Add your GitHub repository as remote origin (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git

# 3. Rename branch to main (standard)
git branch -M main

# 4. Push your commits
git push -u origin main
```

---

## 2. Deploy to Vercel (Instant 1-Click)

The repository includes a pre-configured `vercel.json` designed for 100% zero-config static hosting.

### Method 1: Via Vercel Web Dashboard (Recommended)
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..."** → **"Project"**.
3. Under **Import Git Repository**, select your repository: `YOUR_REPOSITORY`.
4. Leave all settings at default (`vercel.json` handles everything automatically).
5. Click **"Deploy"**.
6. In ~15 seconds, your application will be live at:
   `https://<your-project-name>.vercel.app`

### Method 2: Via Vercel CLI
If you have Node.js and the Vercel CLI installed:
```bash
# In the project root directory:
npx vercel

# Follow prompts (accept defaults). For production deployment:
npx vercel --prod
```

---

## 3. Deploy to GitHub Pages (Free Automated Hosting)

This repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

To enable GitHub Pages:
1. Go to your repository on GitHub.
2. Click **Settings** (top tab) → **Pages** (left sidebar).
3. Under **Build and deployment** → **Source**, select:
   **GitHub Actions**.
4. Every time you push to `main`, GitHub will automatically build and deploy your site to:
   `https://<YOUR_USERNAME>.github.io/<YOUR_REPOSITORY>/`

---

## 4. Configuration Files Included

| File | Purpose |
|------|---------|
| `vercel.json` | Vercel routing rules, security headers, and static serving config |
| `.github/workflows/deploy-pages.yml` | Automatic GitHub Pages deployment on push |
| `.github/workflows/ci.yml` | CI validation pipeline checking core deployment assets |
| `push-to-github.bat` | 1-click Windows helper to connect remote and push code |
| `Open-ERP-Offline.bat` | 1-click Windows launcher for local offline usage |

---

## 👤 Admin Credentials for Live Deployment
- **Role**: Admin
- **User**: Swayam
- **Email**: `swayam@erp.com` (or `admin@erp.com`)
- **Password**: `Admin@123`
