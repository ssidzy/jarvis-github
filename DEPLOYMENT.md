# Jarvis Deployment Guide

Complete guide for deploying Jarvis with:
- **Frontend**: S3 + CloudFront + Custom Domain
- **Backend**: EC2 + Nginx Reverse Proxy

---

## Architecture Overview

```
┌─────────────────┐     HTTPS      ┌─────────────────┐
│   User/Browser  │ ─────────────> │   CloudFront    │
└─────────────────┘                │  (yourapp.com)  │
                                   └────────┬────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    │                                               │
                    ▼                                               ▼
           ┌───────────────┐                              ┌─────────────────┐
           │   S3 Bucket   │                              │   EC2 + Nginx   │
           │  (Frontend)   │                              │ api.yourapp.com │
           │  Static Files │                              │   (Backend)     │
           └───────────────┘                              └─────────────────┘
```

---

## Prerequisites

- AWS Account with appropriate IAM permissions
- Custom domain (optional but recommended)
- SSL certificate in ACM (for HTTPS)
- Node.js 20+ locally

---

## Part 1: Local Development Setup

### 1.1 Initial Setup

```bash
# Clone and install
git clone <your-repo>
cd jarvis-github
npm install

# Create environment file
cp .env.example .env
```

### 1.2 Configure .env for local development

```env
# Backend
OPENAI_API_KEY=sk-...your-key...
OPENAI_MODEL=gpt-4o-mini
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Frontend (leave empty for local - Vite proxy handles it)
VITE_API_BASE_URL=
VITE_BASE_PATH=/
```

### 1.3 Run Locally

**Option A: Full Development Mode (Recommended)**
```bash
npm run dev
```
This runs Express backend with Vite middleware. Access at `http://localhost:3000`

**Option B: Separate Frontend & Backend**
```bash
# Terminal 1 - Backend only
npm run dev

# Terminal 2 - Frontend with HMR (if you prefer Vite's dev server)
npx vite --port 5173
```
Frontend: `http://localhost:5173` (proxies API to :3000)
Backend: `http://localhost:3000`

### 1.4 Test Before Deployment

```bash
# Build frontend
npm run build

# Run production-like locally
NODE_ENV=production npm start
```
Visit `http://localhost:3000` to test the production build.

---

## Part 2: Deploy Frontend to S3 + CloudFront

### 2.1 Create S3 Bucket

```bash
# Create bucket (replace with your bucket name)
aws s3 mb s3://jarvis-frontend-bucket --region ap-south-1

# Enable static website hosting
aws s3 website s3://jarvis-frontend-bucket \
  --index-document index.html \
  --error-document index.html
```

### 2.2 S3 Bucket Policy (for CloudFront OAC)

Create `bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::jarvis-frontend-bucket/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DIST_ID"
        }
      }
    }
  ]
}
```

Apply after creating CloudFront:
```bash
aws s3api put-bucket-policy --bucket jarvis-frontend-bucket --policy file://bucket-policy.json
```

### 2.3 Build and Upload Frontend

Create `.env.production`:
```env
VITE_API_BASE_URL=https://api.yourapp.com
VITE_BASE_PATH=/
```

```bash
# Build with production env
npm run build

# Upload to S3
aws s3 sync dist/ s3://jarvis-frontend-bucket --delete

# Set cache headers (optional but recommended)
aws s3 cp s3://jarvis-frontend-bucket s3://jarvis-frontend-bucket \
  --recursive --metadata-directive REPLACE \
  --cache-control "max-age=31536000" \
  --exclude "index.html" --include "*.js" --include "*.css"

aws s3 cp s3://jarvis-frontend-bucket/index.html s3://jarvis-frontend-bucket/index.html \
  --metadata-directive REPLACE \
  --cache-control "no-cache"
```

### 2.4 Create CloudFront Distribution

**Via AWS Console:**

1. Go to CloudFront → Create Distribution
2. **Origin Settings:**
   - Origin Domain: `jarvis-frontend-bucket.s3.ap-south-1.amazonaws.com`
   - Origin Access: Origin Access Control (OAC) - Create new
   - Enable Origin Shield: Optional (reduces origin load)

3. **Default Cache Behavior:**
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Allowed HTTP Methods: GET, HEAD
   - Cache Policy: CachingOptimized

4. **Settings:**
   - Alternate Domain Names (CNAME): `yourapp.com`, `www.yourapp.com`
   - Custom SSL Certificate: Select your ACM certificate
   - Default Root Object: `index.html`

5. **Error Pages (Important for SPA):**
   - Create custom error response: 403 → /index.html → 200
   - Create custom error response: 404 → /index.html → 200

**Via CLI:**
```bash
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

### 2.5 Connect Custom Domain

1. **Route 53 (if using AWS DNS):**
   - Create A record: `yourapp.com` → Alias to CloudFront distribution
   - Create A record: `www.yourapp.com` → Alias to CloudFront distribution

2. **External DNS:**
   - Create CNAME: `www.yourapp.com` → `d1234.cloudfront.net`
   - For apex domain, use ALIAS if supported

---

## Part 3: Deploy Backend to EC2 with Nginx

### 3.1 Launch EC2 Instance

**Recommended specs (for small selective users):**
- Instance Type: `t3.micro` (free tier) or `t3.small`
- AMI: Ubuntu 22.04 LTS
- Storage: 20GB gp3
- Security Group: Allow SSH (22), HTTP (80), HTTPS (443)

### 3.2 SSH and Initial Setup

```bash
# Connect to EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

### 3.3 Deploy Application

```bash
# Create app directory
sudo mkdir -p /var/www/jarvis
sudo chown ubuntu:ubuntu /var/www/jarvis

# Clone or upload your code
cd /var/www/jarvis
git clone <your-repo> .
# OR use scp: scp -r -i key.pem ./jarvis-github/* ubuntu@IP:/var/www/jarvis/

# Install dependencies
npm ci --omit=dev

# Create production environment
sudo nano /var/www/jarvis/.env
```

Add to `.env`:
```env
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-...your-key...
OPENAI_MODEL=gpt-4o-mini
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com
```

### 3.4 Configure PM2

```bash
# Start with PM2
cd /var/www/jarvis
pm2 start npm --name "jarvis-api" -- start

# Save PM2 config for reboot
pm2 save
pm2 startup  # Follow the instructions it prints

# Useful PM2 commands
pm2 status
pm2 logs jarvis-api
pm2 restart jarvis-api
```

### 3.5 Configure Nginx as Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/jarvis-api
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name api.yourapp.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourapp.com;

    # SSL certificates (use Certbot or your own)
    ssl_certificate /etc/letsencrypt/live/api.yourapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourapp.com/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for long-running AI requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Enable and test:
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/jarvis-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 3.6 SSL with Certbot (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourapp.com

# Auto-renewal (already set up, but verify)
sudo certbot renew --dry-run
```

### 3.7 DNS for API

Create DNS record:
- Type: A
- Name: `api` (or `api.yourapp.com`)
- Value: Your EC2 Elastic IP

---

## Part 4: Connect Frontend to Backend

### 4.1 Update Frontend Environment

In your project, update `.env.production`:
```env
VITE_API_BASE_URL=https://api.yourapp.com
VITE_BASE_PATH=/
```

### 4.2 Rebuild and Deploy Frontend

```bash
# Build with production API URL
npm run build

# Upload to S3
aws s3 sync dist/ s3://jarvis-frontend-bucket --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

### 4.3 Update Backend CORS

On EC2, update `/var/www/jarvis/.env`:
```env
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com
```

Restart the backend:
```bash
pm2 restart jarvis-api
```

---

## Part 5: CI/CD Automation (Optional)

### GitHub Actions for Frontend

Create `.github/workflows/deploy-frontend.yml`:
```yaml
name: Deploy Frontend to S3

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'index.html'
      - 'vite.config.ts'
      - 'package.json'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      
      - run: npm ci
      
      - run: npm run build
        env:
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
      
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1
      
      - name: Deploy to S3
        run: aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DIST_ID }} \
            --paths "/*"
```

### GitHub Actions for Backend (Deploy to EC2)

Create `.github/workflows/deploy-backend.yml`:
```yaml
name: Deploy Backend to EC2

on:
  push:
    branches: [main]
    paths:
      - 'server.ts'
      - 'package.json'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /var/www/jarvis
            git pull origin main
            npm ci --omit=dev
            pm2 restart jarvis-api
```

---

## Architecture Review & Scalability

### Is this approach industry standard?

**Yes, for small-to-medium applications with selective users.** This is a very common and cost-effective architecture.

### Pros:
- **Cost-effective**: S3 + CloudFront for frontend is ~$1-5/month for low traffic
- **Scalable frontend**: CloudFront CDN handles traffic spikes automatically
- **Simple backend**: Single EC2 is easy to manage and debug
- **SSL everywhere**: Free with ACM (CloudFront) and Let's Encrypt (EC2)
- **Clear separation**: Frontend and backend can be updated independently

### Cons & Limitations:
- **Single point of failure**: EC2 instance is not highly available
- **Manual scaling**: Need to upgrade EC2 instance type manually
- **No auto-healing**: If EC2 crashes, manual intervention needed

### When to Scale Up:

| Users | Recommended Changes |
|-------|-------------------|
| 1-100 | Current setup is fine |
| 100-1000 | Add EC2 Auto Scaling Group + ALB |
| 1000+ | Consider ECS/Fargate or Lambda |
| 10000+ | Add RDS, ElastiCache, consider microservices |

### Alternative Architectures:

1. **Serverless (AWS Lambda + API Gateway)**
   - Pros: Pay per request, auto-scaling
   - Cons: Cold starts, complex for stateful sessions

2. **Container (ECS Fargate)**
   - Pros: No server management, auto-scaling
   - Cons: More complex, slightly higher base cost

3. **Managed PaaS (Railway, Render, Fly.io)**
   - Pros: Zero DevOps, easy deployment
   - Cons: Less control, can be expensive at scale

### For Your Use Case (Small Selective Users):

The S3 + CloudFront + EC2 setup is **ideal** because:
- Fixed, predictable costs
- Easy to understand and debug
- Can be upgraded gradually
- Industry-proven pattern

---

## Estimated Monthly Costs (ap-south-1)

| Service | Specification | Est. Cost |
|---------|--------------|-----------|
| S3 | ~1GB storage, ~10k requests | $0.50 |
| CloudFront | ~10GB transfer | $1-2 |
| EC2 t3.micro | On-demand | $8-10 |
| EC2 t3.micro | Reserved 1yr | $4-5 |
| Route 53 | 1 hosted zone | $0.50 |
| **Total** | | **~$10-15/month** |

---

## Troubleshooting

### Frontend Issues:
```bash
# Check S3 sync
aws s3 ls s3://your-bucket

# Check CloudFront status
aws cloudfront get-distribution --id YOUR_DIST_ID

# Clear CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Backend Issues:
```bash
# Check PM2 status
pm2 status
pm2 logs jarvis-api --lines 100

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Test locally
curl http://localhost:3000/api/templates

# Test via Nginx
curl https://api.yourapp.com/api/templates
```

### CORS Issues:
1. Ensure `ALLOWED_ORIGINS` includes your frontend URL (with https://)
2. Check browser console for exact error
3. Restart PM2 after changing .env

### SSL Issues:
```bash
# Check certificate
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Check Nginx SSL config
sudo nginx -t
```
