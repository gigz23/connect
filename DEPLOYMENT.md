# 🚀 Deployment Guide

## Quick Deploy to Vercel (Recommended)

### Prerequisites
- GitHub account
- Vercel account (free tier is fine)
- Supabase project set up

### Steps

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

2. **Deploy to Vercel**

Visit [vercel.com](https://vercel.com) and:
- Click "New Project"
- Import your GitHub repository
- Vercel auto-detects Vite
- Add environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Click "Deploy"

Done! Your app is live in ~2 minutes.

### Custom Domain (Optional)

In Vercel:
- Go to Project Settings → Domains
- Add your domain
- Update DNS records as shown

---

## Alternative: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod
```

Environment variables:
- Add in Netlify dashboard under Site Settings → Environment Variables

---

## Alternative: Self-Hosted (VPS)

### On Ubuntu/Debian Server:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and build
git clone YOUR_REPO_URL
cd placeconnect
npm install
npm run build

# Serve with nginx
sudo apt install nginx
sudo nano /etc/nginx/sites-available/placeconnect
```

Nginx config:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/placeconnect/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/placeconnect /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

---

## CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

---

## Performance Tips

### 1. Enable Compression
Already handled by Vercel/Netlify

### 2. Lazy Loading
```javascript
// In App.jsx
const ChatPanel = lazy(() => import('./components/ChatPanel'));

<Suspense fallback={<div>Loading...</div>}>
  <ChatPanel />
</Suspense>
```

### 3. Image Optimization
Use WebP format for icons and images

### 4. Code Splitting
Vite handles this automatically!

---

## Monitoring

### Add Analytics

```html
<!-- Google Analytics in index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

### Error Tracking

```bash
npm install @sentry/react @sentry/vite-plugin
```

```javascript
// In main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production",
});
```

---

## Security Checklist

- ✅ Environment variables never committed
- ✅ Supabase RLS policies enabled
- ✅ HTTPS enforced (automatic on Vercel)
- ⚠️ Add rate limiting for production
- ⚠️ Implement content moderation
- ⚠️ Add user reporting feature

---

## Scaling Considerations

### Database
- Free tier: 500MB, good for ~100k messages
- Upgrade triggers: 
  - >50k daily active users
  - >1M messages/month
  - Real-time connections >200 concurrent

### CDN
Vercel automatically uses global CDN

### Costs Estimate
- **0-10k users**: Free (Vercel + Supabase free tiers)
- **10k-100k users**: ~$50-200/month
- **100k+ users**: Need custom plan

---

## Post-Deploy Checklist

- [ ] Test on mobile browsers (iOS Safari, Chrome)
- [ ] Verify real-time updates work
- [ ] Check map loads on different locations
- [ ] Test message sending/receiving
- [ ] Verify username persistence
- [ ] Check activity indicators update
- [ ] Test error states (no internet, etc.)
- [ ] Set up error monitoring
- [ ] Configure custom domain
- [ ] Add meta tags for social sharing

---

## Troubleshooting

### Build fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist .vite
npm install
npm run build
```

### Environment variables not working
- Restart dev server after changing `.env`
- In Vercel: redeploy after adding env vars
- Prefix must be `VITE_` for Vite to expose them

### Real-time not working in production
- Check Supabase URL is correct (no localhost)
- Verify WebSocket connections aren't blocked
- Check browser console for errors

---

## Going Live Checklist

### Pre-Launch
1. Test thoroughly on staging
2. Set up monitoring
3. Configure backups
4. Prepare support email
5. Create privacy policy
6. Add feedback mechanism

### Launch Day
1. Announce on social media
2. Monitor error rates
3. Watch database performance
4. Be ready to scale quickly

### Post-Launch
1. Gather user feedback
2. Fix critical bugs ASAP
3. Plan feature roadmap
4. Optimize based on usage patterns

---

## Support

For deployment issues:
- Vercel: [vercel.com/docs](https://vercel.com/docs)
- Supabase: [supabase.com/docs](https://supabase.com/docs)
- Vite: [vitejs.dev/guide](https://vitejs.dev/guide)
