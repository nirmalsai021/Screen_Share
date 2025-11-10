# Deployment Instructions

## Prerequisites

1. **Install AWS CLI**:
   - Download from: https://aws.amazon.com/cli/
   - Run: `aws configure` with your AWS credentials

2. **Install SAM CLI**:
   - Download from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

## Deploy Steps

### 1. Deploy Backend
```bash
sam build
sam deploy --guided
```

### 2. Update Frontend with API URL
After backend deployment, update frontend/.env.production:
```
REACT_APP_API_URL=https://your-api-id.execute-api.region.amazonaws.com/prod
```

### 3. Build and Deploy Frontend
```bash
cd frontend
npm run build
aws s3 sync build/ s3://your-bucket-name --delete
```

### 4. Get Your App URL
Your app will be available at the CloudFront URL from the deployment output.

## Quick Test
1. Visit your CloudFront URL
2. Click "Start Screen Share"
3. Share the generated link
4. Open link in different browser/device to test