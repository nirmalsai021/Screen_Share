@echo off
echo ========================================
echo   Screen Share App - AWS Deployment
echo ========================================
echo.

echo Checking prerequisites...
echo.

echo 1. Checking AWS CLI...
aws --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ AWS CLI not found
    echo Please install from: https://aws.amazon.com/cli/
    echo Then run: aws configure
    pause
    exit /b 1
) else (
    echo ✅ AWS CLI found
)

echo.
echo 2. Checking SAM CLI...
sam --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ SAM CLI not found
    echo Please install from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
    pause
    exit /b 1
) else (
    echo ✅ SAM CLI found
)

echo.
echo 3. Checking AWS credentials...
aws sts get-caller-identity >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ AWS credentials not configured
    echo Please run: aws configure
    pause
    exit /b 1
) else (
    echo ✅ AWS credentials configured
)

echo.
echo ========================================
echo   Starting Deployment...
echo ========================================
echo.

echo Building SAM application...
sam build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo.
echo Deploying to AWS...
sam deploy --guided

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Note the API Gateway URL from the output above
echo 2. Update frontend/.env.production with the API URL
echo 3. Run: cd frontend && npm run build
echo 4. Upload to S3 bucket shown in the output
echo.
pause