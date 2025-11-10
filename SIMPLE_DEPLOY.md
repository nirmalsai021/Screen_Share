# 🚀 Simple Deployment (Railway + Netlify)

## 1. Deploy Backend to Railway (2 minutes)

1. Go to https://railway.app/
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select this repository
5. Railway will auto-deploy the backend
6. Copy the generated URL (e.g., `https://your-app.railway.app`)

## 2. Deploy Frontend to Netlify (2 minutes)

1. Go to https://netlify.com/
2. Sign up with GitHub
3. Click "New site from Git"
4. Select this repository
5. Build settings:
   - Build command: `cd frontend && npm install && npm run build`
   - Publish directory: `frontend/build`
6. Environment variables:
   - `REACT_APP_API_URL` = `https://your-app.railway.app` (from step 1)
7. Deploy site

## 3. Test Your App

1. Visit your Netlify URL
2. Click "Start Screen Share"
3. Share the link with anyone worldwide
4. They can view your screen in real-time!

## ✅ Benefits:
- **Free**: Both platforms have generous free tiers
- **Global**: Works across different devices/browsers
- **Fast**: Deploys in minutes
- **Secure**: HTTPS by default

## 💰 Cost:
- **Railway**: Free for 500 hours/month
- **Netlify**: Free for 100GB bandwidth/month
- **Total**: $0 for most usage

Your app will be live at:
- Frontend: `https://your-app.netlify.app`
- Backend: `https://your-app.railway.app`