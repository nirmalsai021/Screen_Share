# 🔒 Secure Screen Share Application

A privacy-compliant screen sharing application built with WebRTC and AWS services.

## 🛡️ Security & Privacy Features

- **Explicit User Consent**: Users must manually click "Start Screen Share" and grant browser permission
- **HTTPS Only**: All communications encrypted via HTTPS/WSS
- **Session-based**: Temporary sessions with automatic expiration
- **No Recording**: Pure P2P streaming, no server-side recording
- **CORS Protection**: Configurable origin restrictions

## 🏗️ Architecture

- **Frontend**: React app with WebRTC (`getDisplayMedia()` API)
- **Backend**: AWS Lambda functions for signaling
- **Storage**: DynamoDB for session management
- **Hosting**: S3 + CloudFront for global distribution
- **API**: API Gateway for secure REST endpoints

## 🚀 Quick Deploy

### Prerequisites
- AWS CLI configured
- AWS SAM CLI installed
- Node.js 18+

### Deploy Steps

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd screen-share-app
   ```

2. **Deploy backend**:
   ```bash
   sam build
   sam deploy --guided
   ```

3. **Build and deploy frontend**:
   ```bash
   cd frontend
   npm install
   
   # Set API URL from CloudFormation output
   echo "REACT_APP_API_URL=https://your-api-id.execute-api.region.amazonaws.com/prod" > .env.production
   
   npm run build
   
   # Upload to S3 bucket (get bucket name from CloudFormation outputs)
   aws s3 sync build/ s3://your-bucket-name --delete
   ```

## 📱 Usage

### For Screen Sharers:
1. Visit your CloudFront URL
2. Click "Start Screen Share"
3. Grant browser permission when prompted
4. Share the generated link with viewers

### For Viewers:
1. Click the shared link
2. View the shared screen in real-time

## 🔧 Configuration

### Environment Variables:
- `REACT_APP_API_URL`: API Gateway endpoint
- `CORS_ORIGIN`: Allowed origins for CORS (default: "*")

### Security Settings:
- Sessions auto-expire after 1 hour
- Signaling data expires after 5 minutes
- HTTPS enforced via CloudFront

## 🛠️ Development

### Local Development:
```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
npm start
```

### Testing:
- Test screen sharing in Chrome/Firefox/Safari
- Verify permission prompts appear
- Test with multiple viewers

## 📋 Compliance Notes

- ✅ GDPR/CCPA compliant (explicit consent required)
- ✅ Browser security standards (getDisplayMedia API)
- ✅ No automatic screen capture
- ✅ User-initiated sharing only
- ✅ Temporary sessions with TTL

## 🔍 Monitoring

Monitor via AWS CloudWatch:
- Lambda function metrics
- API Gateway request counts
- DynamoDB read/write capacity
- CloudFront cache hit rates

## 🚨 Important Security Notes

1. **Never bypass browser permission prompts**
2. **Always use HTTPS in production**
3. **Configure CORS origins appropriately**
4. **Monitor for unusual session creation patterns**
5. **Implement rate limiting for production use**