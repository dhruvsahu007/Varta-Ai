#!/bin/bash

# Varta-AI EC2 Deployment Script
# This script deploys the Varta-AI application on EC2 by:
# 1. Logging into AWS ECR
# 2. Pulling latest Docker images
# 3. Fetching secrets from AWS Secrets Manager (if configured)
# 4. Running the application with docker-compose

set -e  # Exit on any error

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
LOG_FILE="/var/log/varta-ai-deploy.log"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🚀 Starting Varta-AI deployment..."

# Check required environment variables
if [[ -z "$ECR_BACKEND_URI" ]]; then
    log "❌ ERROR: ECR_BACKEND_URI environment variable is required"
    exit 1
fi

if [[ -z "$ECR_FRONTEND_URI" ]]; then
    log "❌ ERROR: ECR_FRONTEND_URI environment variable is required"
    exit 1
fi

log "📋 Configuration:"
log "   - AWS Region: $AWS_REGION"
log "   - Backend Image: $ECR_BACKEND_URI"
log "   - Frontend Image: $ECR_FRONTEND_URI"

# Step 1: Login to AWS ECR
log "🔐 Logging into AWS ECR..."
if aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${ECR_BACKEND_URI%%/*}"; then
    log "✅ Successfully logged into ECR"
else
    log "❌ Failed to login to ECR"
    exit 1
fi

# Step 2: Pull Docker images
log "📥 Pulling Docker images..."

log "   - Pulling backend image: $ECR_BACKEND_URI"
if docker pull "$ECR_BACKEND_URI"; then
    log "✅ Backend image pulled successfully"
else
    log "❌ Failed to pull backend image"
    exit 1
fi

log "   - Pulling frontend image: $ECR_FRONTEND_URI"
if docker pull "$ECR_FRONTEND_URI"; then
    log "✅ Frontend image pulled successfully"
else
    log "❌ Failed to pull frontend image"
    exit 1
fi

# Step 3: Handle secrets from AWS Secrets Manager (if configured)
if [[ -n "$SECRETS_MANAGER_SECRET_ARN" ]]; then
    log "🔑 Fetching secrets from AWS Secrets Manager..."
    log "   - Secret ARN: $SECRETS_MANAGER_SECRET_ARN"
    
    # Fetch secrets JSON from AWS Secrets Manager
    if SECRETS_JSON=$(aws secretsmanager get-secret-value --secret-id "$SECRETS_MANAGER_SECRET_ARN" --region "$AWS_REGION" --query SecretString --output text 2>/dev/null); then
        log "✅ Secrets fetched successfully"
        
        # Create .env file from secrets JSON
        log "📝 Creating .env file from secrets..."
        echo "# Generated .env file from AWS Secrets Manager" > .env
        echo "# Generated on: $(date)" >> .env
        echo "" >> .env
        
        # Parse JSON and convert to .env format
        echo "$SECRETS_JSON" | jq -r 'to_entries[] | "\(.key)=\(.value)"' >> .env
        
        # Add ECR URIs to .env
        echo "" >> .env
        echo "# ECR Image URIs" >> .env
        echo "ECR_REPO_BACKEND=$ECR_BACKEND_URI" >> .env
        echo "ECR_REPO_FRONTEND=$ECR_FRONTEND_URI" >> .env
        
        log "✅ .env file created successfully"
        
        # Secure the .env file
        chmod 600 .env
        log "🔒 .env file permissions set to 600"
        
    else
        log "❌ Failed to fetch secrets from Secrets Manager"
        exit 1
    fi
else
    log "⚠️  SECRETS_MANAGER_SECRET_ARN not set, skipping secrets fetch"
    log "   Make sure required environment variables are set manually"
    
    # Ensure ECR URIs are available for docker-compose
    export ECR_REPO_BACKEND="$ECR_BACKEND_URI"
    export ECR_REPO_FRONTEND="$ECR_FRONTEND_URI"
fi

# Step 4: Stop existing containers (if any)
log "🛑 Stopping existing containers..."
if docker-compose -f docker-compose.prod.yml down 2>/dev/null; then
    log "✅ Existing containers stopped"
else
    log "ℹ️  No existing containers to stop"
fi

# Step 5: Start the application
log "🚀 Starting Varta-AI application..."
if docker-compose -f docker-compose.prod.yml up -d; then
    log "✅ Application started successfully"
else
    log "❌ Failed to start application"
    exit 1
fi

# Step 6: Verify deployment
log "🔍 Verifying deployment..."
sleep 10  # Wait for services to start

# Check if containers are running
BACKEND_STATUS=$(docker-compose -f docker-compose.prod.yml ps backend --format "{{.Status}}" 2>/dev/null || echo "Not found")
FRONTEND_STATUS=$(docker-compose -f docker-compose.prod.yml ps frontend --format "{{.Status}}" 2>/dev/null || echo "Not found")

log "📊 Container Status:"
log "   - Backend: $BACKEND_STATUS"
log "   - Frontend: $FRONTEND_STATUS"

# Check health endpoints
log "🏥 Checking health endpoints..."

# Backend health check
if curl -f -s "http://localhost:3000/api/health" > /dev/null; then
    log "✅ Backend health check passed"
else
    log "⚠️  Backend health check failed - service may still be starting"
fi

# Frontend health check  
if curl -f -s "http://localhost/" > /dev/null; then
    log "✅ Frontend health check passed"
else
    log "⚠️  Frontend health check failed - service may still be starting"
fi

log "🎉 Deployment completed successfully!"
log "📝 Application logs can be viewed with: docker-compose -f docker-compose.prod.yml logs -f"
log "🔧 To stop the application: docker-compose -f docker-compose.prod.yml down"

# Display quick status
echo ""
echo "=== Varta-AI Deployment Summary ==="
echo "✅ Deployment Status: SUCCESS"
echo "🐳 Images Pulled: $ECR_BACKEND_URI, $ECR_FRONTEND_URI"
echo "🌐 Frontend URL: http://$(curl -s ifconfig.me || echo 'localhost')"
echo "🔧 API URL: http://$(curl -s ifconfig.me || echo 'localhost'):3000/api/health"
echo "📊 View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "=================================="