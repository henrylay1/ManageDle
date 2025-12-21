# Deployment Guide - ManageDle with Full Supabase Integration

## Setup Steps

### 1. Create GitHub Repository
```bash
# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/ManageDle.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 2. Configure GitHub Secrets
Go to your repository on GitHub: Settings → Secrets and variables → Actions → New repository secret

Add these two secrets:
- **Name:** `VITE_SUPABASE_URL`
  - **Value:** Your Supabase project URL (from https://app.supabase.com/project/_/settings/api)
  
- **Name:** `VITE_SUPABASE_ANON_KEY`
  - **Value:** Your Supabase anon/public key (from https://app.supabase.com/project/_/settings/api)

### 3. Enable GitHub Pages
1. Go to repository Settings → Pages
2. Under "Source", select "GitHub Actions"
3. Save

### 4. Deploy
The site will automatically deploy when you push to the `main` branch. You can also manually trigger deployment:
1. Go to Actions tab
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow"

## How It Works

- **Environment Variables**: The GitHub Actions workflow injects your Supabase credentials during the build process
- **Security**: Credentials are stored as encrypted GitHub secrets, not in your code
- **Automatic Deployment**: Every push to `main` triggers a new deployment
- **Full Features**: Deployed site has authentication, cloud storage, and leaderboards via Supabase

## Local Development

For local development, create a `.env` file with your credentials:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run dev server:
```bash
npm run dev
```

## Important Notes

- ✅ Supabase anon keys are safe to use client-side (they're designed for public access)
- ✅ Row Level Security (RLS) policies protect your data
- ✅ The deployed app will have full authentication and cloud features
- ✅ Users can register, login, and their data persists across sessions
