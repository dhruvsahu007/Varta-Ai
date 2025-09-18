#!/bin/bash

# Varta-AI Systemd Service Setup Script
# This script installs and configures the Varta-AI systemd service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

print_header "Varta-AI Systemd Service Setup"

# Step 1: Copy service file
print_status "Installing systemd service file..."
if [[ -f "/home/ubuntu/deploy/varta-deploy.service" ]]; then
    cp /home/ubuntu/deploy/varta-deploy.service /etc/systemd/system/
    print_status "Service file copied to /etc/systemd/system/varta-deploy.service"
else
    print_error "Service file not found at /home/ubuntu/deploy/varta-deploy.service"
    print_error "Please ensure you've deployed the Varta-AI code to /home/ubuntu/deploy/"
    exit 1
fi

# Step 2: Set proper permissions
print_status "Setting service file permissions..."
chmod 644 /etc/systemd/system/varta-deploy.service
chown root:root /etc/systemd/system/varta-deploy.service

# Step 3: Reload systemd
print_status "Reloading systemd daemon..."
systemctl daemon-reload

# Step 4: Enable the service
print_status "Enabling Varta-AI service..."
systemctl enable varta-deploy.service

# Step 5: Check if docker-compose exists
print_status "Checking docker-compose installation..."
if ! command -v docker-compose &> /dev/null; then
    print_warning "docker-compose not found in PATH"
    print_status "Attempting to install docker-compose..."
    
    # Install docker-compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    if command -v docker-compose &> /dev/null; then
        print_status "docker-compose installed successfully"
    else
        print_error "Failed to install docker-compose"
        exit 1
    fi
else
    print_status "docker-compose is available"
fi

# Step 6: Verify deployment directory
if [[ ! -d "/home/ubuntu/deploy" ]]; then
    print_warning "Deploy directory /home/ubuntu/deploy not found"
    print_status "Creating deploy directory..."
    mkdir -p /home/ubuntu/deploy
    chown ubuntu:ubuntu /home/ubuntu/deploy
fi

if [[ ! -f "/home/ubuntu/deploy/docker-compose.prod.yml" ]]; then
    print_warning "docker-compose.prod.yml not found in /home/ubuntu/deploy/"
    print_warning "Please ensure you've deployed the application files"
fi

# Step 7: Add ubuntu user to docker group
print_status "Adding ubuntu user to docker group..."
usermod -aG docker ubuntu

print_header "Setup Complete!"
print_status "Varta-AI systemd service has been installed and enabled"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Ensure your application files are in /home/ubuntu/deploy/"
echo "2. Set up environment variables or .env file"
echo "3. Start the service: sudo systemctl start varta-deploy"
echo "4. Check status: sudo systemctl status varta-deploy"
echo ""
echo -e "${BLUE}Service Management Commands:${NC}"
echo "• Start:   sudo systemctl start varta-deploy"
echo "• Stop:    sudo systemctl stop varta-deploy"
echo "• Restart: sudo systemctl restart varta-deploy"
echo "• Status:  sudo systemctl status varta-deploy"
echo "• Logs:    sudo journalctl -u varta-deploy -f"
echo ""
echo -e "${GREEN}✅ Setup completed successfully!${NC}"