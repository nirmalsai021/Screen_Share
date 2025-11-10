#!/bin/bash

# Build frontend
cd frontend
npm install
npm run build

# Deploy backend
cd ../
sam build
sam deploy --guided

# Get API Gateway URL from CloudFormation outputs
API_URL=$(aws cloudformation describe-stacks --stack-name screen-share-app --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)

# Update frontend with API URL
cd frontend
echo "REACT_APP_API_URL=$API_URL" > .env.production

# Rebuild with API URL
npm run build

# Upload to S3
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name screen-share-app --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucket`].OutputValue' --output text)
aws s3 sync build/ s3://$BUCKET_NAME --delete

echo "Deployment complete!"
echo "API URL: $API_URL"
echo "Website: https://$(aws cloudformation describe-stacks --stack-name screen-share-app --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' --output text)"