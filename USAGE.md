# BardBot Usage Guide

Simple guide for running and managing BardBot.

## Quick Start

### Starting BardBot

From any directory, simply run:

```bash
bardbot
```

This will:
- Check if Lavalink is running (starts it if needed)
- Launch BardBot in the current terminal
- Display all bot output in real-time

### Stopping BardBot

From another terminal, run:

```bash
bardbotstop
```

Or press `Ctrl+C` in the terminal where BardBot is running.

## Commands

### `bardbot`
Launches BardBot from any directory. Output appears in the current terminal.

**Features:**
- Auto-starts Lavalink if not running
- Prevents multiple instances
- Shows real-time output and logs
- Press Ctrl+C to stop

**Example:**
```bash
$ bardbot
Starting BardBot v1.2 (Build 70)...
Launching BardBot from console...
🎵 BardBot v1.2 (Build 70) - Lavalink Edition
✅ Logged in as BardBot#8504
```

### `bardbotstop`
Stops a running BardBot instance gracefully.

**Features:**
- Finds and stops the BardBot process
- Graceful shutdown with fallback to force-kill
- Can be run from any terminal

**Example:**
```bash
$ bardbotstop
Stopping BardBot...
BardBot stopped successfully.
```

## Lavalink Service

Lavalink runs as a system service and starts automatically on boot.

### Manage Lavalink

```bash
# Check status
sudo systemctl status lavalink

# Start
sudo systemctl start lavalink

# Stop
sudo systemctl stop lavalink

# Restart
sudo systemctl restart lavalink

# View logs
sudo journalctl -u lavalink -f
```

## Typical Workflow

### Starting a Session

```bash
# Just run bardbot - it handles everything
bardbot
```

### Monitoring

Watch the terminal output for:
- Connection status
- Command usage
- Errors or warnings
- Playback events

### Stopping

**Option 1:** Press `Ctrl+C` in the BardBot terminal

**Option 2:** From another terminal:
```bash
bardbotstop
```

## Tips

**Running in Background:**
If you want to close the terminal but keep BardBot running, you can use `screen` or `tmux`:

```bash
# Using screen
screen -S bardbot
bardbot
# Press Ctrl+A then D to detach

# Reattach later
screen -r bardbot
```

**Viewing Logs:**
The bot outputs to the terminal, so you can redirect to a file if needed:

```bash
bardbot 2>&1 | tee bardbot.log
```

**Auto-start on Login:**
Add to your `~/.bashrc` or create a startup script if you want BardBot to start automatically.

## Troubleshooting

### "BardBot is already running"
Another instance is running. Stop it first:
```bash
bardbotstop
```

### "Lavalink service is not running"
The `bardbot` command will try to start it automatically. If it fails:
```bash
sudo systemctl start lavalink
sudo systemctl status lavalink
```

### No audio output
- Verify you're in a Discord voice channel
- Check Lavalink is running: `systemctl status lavalink`
- Check bot terminal for error messages
- Verify music files are accessible

---

**Version**: 1.2 (Build 70)
**Last Updated**: 2025-11-21
