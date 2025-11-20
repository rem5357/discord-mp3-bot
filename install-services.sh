#!/bin/bash
# Installation script for BardBot and Lavalink systemd services

set -e

echo "Installing BardBot systemd services..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=${SUDO_USER:-$USER}
PROJECT_DIR="/home/$ACTUAL_USER/Projects/discord-mp3-bot"

echo "Project directory: $PROJECT_DIR"
echo "User: $ACTUAL_USER"

# Copy service files
echo "Installing service files..."
cp "$PROJECT_DIR/lavalink.service" /etc/systemd/system/
cp "$PROJECT_DIR/bardbot.service" /etc/systemd/system/

# Reload systemd
echo "Reloading systemd..."
systemctl daemon-reload

# Enable services
echo "Enabling services..."
systemctl enable lavalink.service
systemctl enable bardbot.service

echo ""
echo "✅ Services installed successfully!"
echo ""
echo "Usage:"
echo "  Start services:  sudo systemctl start lavalink && sudo systemctl start bardbot"
echo "  Stop services:   sudo systemctl stop bardbot && sudo systemctl stop lavalink"
echo "  Restart:         sudo systemctl restart bardbot"
echo "  View logs:       sudo journalctl -u bardbot -f"
echo "  Status:          sudo systemctl status bardbot"
echo ""
