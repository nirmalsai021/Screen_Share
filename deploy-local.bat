@echo off
echo Setting up AWS credentials for local deployment...
echo.
echo Please configure AWS credentials:
echo 1. Create an AWS account if you don't have one
echo 2. Create an IAM user with programmatic access
echo 3. Attach policies: AWSLambdaFullAccess, AmazonAPIGatewayAdministrator, AmazonDynamoDBFullAccess, AmazonS3FullAccess, CloudFormationFullAccess
echo 4. Run: aws configure
echo.
echo After configuring credentials, run:
echo python -m samcli deploy --resolve-s3 --capabilities CAPABILITY_IAM
echo.
echo Then update frontend with API URL and deploy to S3
pause