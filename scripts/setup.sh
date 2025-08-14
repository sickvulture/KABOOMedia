#!/bin/bash

# KABOOMedia Setup Script
echo "🚀 Setting up KABOOMedia..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check Node.js version
print_step "Checking Node.js version..."
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "Node.js version: $NODE_VERSION"
    
    # Extract major version number
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_warning "Node.js 18+ is recommended. Current version: $NODE_VERSION"
    else
        print_success "Node.js version is compatible"
    fi
else
    print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

# Create necessary directories
print_step "Creating directories..."
mkdir -p storage/encrypted
mkdir -p storage/thumbnails
mkdir -p temp
mkdir -p logs
print_success "Directories created"

# Install root dependencies
print_step "Installing server dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_success "Server dependencies installed"
else
    print_error "Failed to install server dependencies"
    exit 1
fi

# Install client dependencies
print_step "Installing client dependencies..."
cd client
npm install
if [ $? -eq 0 ]; then
    print_success "Client dependencies installed"
else
    print_error "Failed to install client dependencies"
    exit 1
fi
cd ..

# Create environment file
print_step "Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    print_success "Environment file created (.env)"
    print_warning "Please edit .env file with your configuration before running"
else
    print_warning ".env file already exists"
fi

# Set file permissions
print_step "Setting file permissions..."
chmod +x scripts/*.sh
print_success "Script permissions set"

# Run security audit
print_step "Running security audit..."
npm audit --audit-level=moderate
cd client && npm audit --audit-level=moderate && cd ..

# Final setup
print_step "Final setup..."
echo ""
print_success "🎉 KABOOMedia setup completed!"
echo ""
echo "📝 Next steps:"
echo "  1. Edit .env file with your configuration"
echo "  2. Run 'npm run dev' to start development servers"
echo "  3. Open http://localhost:3000 in your browser"
echo ""
echo "📚 Useful commands:"
echo "  npm run dev          - Start development servers"
echo "  npm run build        - Build for production"
echo "  npm run start        - Start production server"
echo "  npm run audit:fix    - Fix security vulnerabilities"
echo ""
echo "🔐 Security notes:"
echo "  - Change JWT_SECRET in .env file"
echo "  - Use HTTPS in production"
echo "  - Regularly update dependencies"
echo ""
print_success "Setup complete! Happy coding! 🚀"
