# BardBot Deployment Guide

This guide covers deploying BardBot as a production systemd service with automatic restarts and logging.

## Prerequisites

- Linux system with systemd
- Node.js installed
- Java 17+ installed (for Lavalink)
- Nginx configured (for local music serving)
- Bot configured with valid `.env` file

## Installation

### 1. Install Services

Run the installation script:

```bash
sudo ./install-services.sh
```

This will:
- Copy service files to `/etc/systemd/system/`
- Reload systemd daemon
- Enable services to start on boot

### 2. Start Services

Start Lavalink first, then the bot:

```bash
sudo systemctl start lavalink
sudo systemctl start bardbot
```

### 3. Verify Services are Running

```bash
sudo systemctl status lavalink
sudo systemctl status bardbot
```

You should see "active (running)" for both services.

## Service Management

### Start/Stop Services

```bash
# Start
sudo systemctl start bardbot

# Stop
sudo systemctl stop bardbot

# Restart
sudo systemctl restart bardbot
```

### View Logs

```bash
# Follow live logs
sudo journalctl -u bardbot -f

# View recent logs
sudo journalctl -u bardbot -n 100

# View logs from specific time
sudo journalctl -u bardbot --since "1 hour ago"
```

### Enable/Disable Auto-Start

```bash
# Enable (start on boot)
sudo systemctl enable bardbot

# Disable
sudo systemctl disable bardbot
```

## Service Configuration

### BardBot Service (`bardbot.service`)

- **Type**: Simple (foreground process)
- **User**: mithroll
- **Auto-Restart**: Always (10 second delay)
- **Restart Limit**: 5 attempts in 5 minutes
- **Dependencies**: Requires lavalink.service
- **Logging**: systemd journal

### Lavalink Service (`lavalink.service`)

- **Type**: Simple (foreground process)
- **User**: mithroll
- **Auto-Restart**: On failure (5 second delay)
- **Memory Limit**: 512MB
- **Logging**: systemd journal

## Auto-Restart Behavior

### BardBot
- Restarts automatically on any exit (crash, error, etc.)
- 10 second delay between restart attempts
- If service fails 5 times within 5 minutes, systemd stops trying
- Reset the failure counter: `sudo systemctl reset-failed bardbot`

### Lavalink
- Restarts automatically only on failure
- 5 second delay between restart attempts
- Critical dependency for BardBot

## Monitoring

### Check Service Health

```bash
# Quick status
systemctl status bardbot

# Detailed status with recent logs
systemctl status bardbot -l

# Check if service is active
systemctl is-active bardbot

# Check if service is enabled
systemctl is-enabled bardbot
```

### Monitor Resource Usage

```bash
# CPU and memory usage
systemctl status bardbot | grep -A 5 "Memory\|CPU"

# Full system resource view
top -p $(pидof node)
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs for errors
sudo journalctl -u bardbot -n 50

# Verify .env file exists
cat /home/mithroll/Projects/discord-mp3-bot/.env

# Check Lavalink is running
sudo systemctl status lavalink

# Test manual start
cd /home/mithroll/Projects/discord-mp3-bot
node index-lavalink.js
```

### Service Keeps Restarting

```bash
# View crash logs
sudo journalctl -u bardbot --since "10 minutes ago"

# Check restart counter
systemctl show bardbot | grep NRestarts

# Reset failure counter
sudo systemctl reset-failed bardbot
```

### Update Bot Code

```bash
# Pull latest changes
cd /home/mithroll/Projects/discord-mp3-bot
git pull

# Install dependencies
npm install

# Restart service
sudo systemctl restart bardbot
```

## Security Notes

- Services run as non-root user `mithroll`
- `NoNewPrivileges=true` prevents privilege escalation
- `PrivateTmp=true` provides isolated /tmp directory
- Logs go to systemd journal (not world-readable)

## Backup & Maintenance

### Backup Configuration

```bash
# Backup .env file (contains secrets!)
cp .env .env.backup

# Backup service files
cp /etc/systemd/system/bardbot.service ~/bardbot.service.backup
cp /etc/systemd/system/lavalink.service ~/lavalink.service.backup
```

### Update Lavalink

```bash
# Stop services
sudo systemctl stop bardbot
sudo systemctl stop lavalink

# Update Lavalink.jar
# (download new version)

# Start services
sudo systemctl start lavalink
sudo systemctl start bardbot
```

## Uninstall

```bash
# Stop and disable services
sudo systemctl stop bardbot
sudo systemctl disable bardbot
sudo systemctl stop lavalink
sudo systemctl disable lavalink

# Remove service files
sudo rm /etc/systemd/system/bardbot.service
sudo rm /etc/systemd/system/lavalink.service

# Reload systemd
sudo systemctl daemon-reload
```

---

**Version**: 1.1 (Build 64)
**Last Updated**: 2025-11-19
