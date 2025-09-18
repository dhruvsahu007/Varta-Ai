# Varta-AI EC2 Deployment

This directory contains deployment scripts for running Varta-AI on EC2.

## Prerequisites

1. **AWS CLI configured** with appropriate permissions:
   ```bash
   aws configure
   ```

2. **Docker and Docker Compose installed**:
   ```bash
   # Install Docker
   sudo yum update -y
   sudo yum install -y docker
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -a -G docker ec2-user
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **jq installed** (for JSON parsing):
   ```bash
   sudo yum install -y jq
   ```

## Usage

### Basic Deployment

```bash
# Set required environment variables
export ECR_BACKEND_URI="123456789012.dkr.ecr.us-east-1.amazonaws.com/varta-ai-backend:latest"
export ECR_FRONTEND_URI="123456789012.dkr.ecr.us-east-1.amazonaws.com/varta-ai-frontend:latest"
export AWS_REGION="us-east-1"

# Make script executable
chmod +x deploy/deploy.sh

# Run deployment
./deploy/deploy.sh
```

### Deployment with AWS Secrets Manager

```bash
# Set ECR URIs and Secrets Manager ARN
export ECR_BACKEND_URI="123456789012.dkr.ecr.us-east-1.amazonaws.com/varta-ai-backend:latest"
export ECR_FRONTEND_URI="123456789012.dkr.ecr.us-east-1.amazonaws.com/varta-ai-frontend:latest"
export SECRETS_MANAGER_SECRET_ARN="arn:aws:secretsmanager:us-east-1:123456789012:secret:varta-ai-secrets-abc123"
export AWS_REGION="us-east-1"

# Run deployment
./deploy/deploy.sh
```

## Secrets Manager Format

If using AWS Secrets Manager, create a secret with the following JSON structure:

```json
{
  "DATABASE_URL": "postgresql://user:pass@host:5432/varta_ai",
  "AWS_ACCESS_KEY_ID": "your-access-key",
  "AWS_SECRET_ACCESS_KEY": "your-secret-key",
  "SESSION_SECRET": "your-secure-session-secret",
  "OPENSEARCH_ENDPOINT": "https://your-opensearch-endpoint.com",
  "FRONTEND_URL": "https://your-domain.com"
}
```

## Monitoring

- **View logs**: `docker-compose -f docker-compose.prod.yml logs -f`
- **Check status**: `docker-compose -f docker-compose.prod.yml ps`
- **Stop application**: `docker-compose -f docker-compose.prod.yml down`
- **Restart**: `./deploy/deploy.sh`

## Troubleshooting

- **ECR login fails**: Check AWS credentials and region
- **Image pull fails**: Verify ECR repository URIs and permissions
- **Secrets fetch fails**: Check Secrets Manager ARN and IAM permissions
- **Health checks fail**: Services may still be starting, wait 30-60 seconds

## Required IAM Permissions

Your EC2 instance or IAM user needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:varta-ai-*"
    }
  ]
}
```