#!/bin/bash

# AIFilms Synchronization Stress Test
# Launches 1 control panel + 10 voting screens in parallel

BASE_URL="http://localhost:8080"
LOG_DIR="./stress-test-logs"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

mkdir -p "$LOG_DIR"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        AIFilms Synchronization Stress Test                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Test Configuration:"
echo "   - Control Panel: 1 instance"
echo "   - Voting Screens: 10 instances"
echo "   - Test Duration: ~30 seconds"
echo "   - Logs: $LOG_DIR"
echo ""

# Function to launch a voting screen
launch_voter() {
    local id=$1
    echo "🚀 Launching Voter #$id..."

    agent-browser --session "voter-$id" open "$BASE_URL/vote.html" &
    sleep 0.5
}

# Function to launch control panel
launch_control() {
    echo "🎮 Launching Control Panel..."

    agent-browser --session "control-panel" open "$BASE_URL/control.html" &
    sleep 1
}

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up browser sessions..."

    agent-browser --session "control-panel" close 2>/dev/null &

    for i in {1..10}; do
        agent-browser --session "voter-$i" close 2>/dev/null &
    done

    wait
    echo "✓ Cleanup complete"
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Launch all browsers
echo "📡 Launching browsers..."
echo ""

launch_control

for i in {1..10}; do
    launch_voter $i
done

echo ""
echo "⏳ Waiting for all browsers to initialize (5 seconds)..."
sleep 5

echo ""
echo "✅ All browsers launched!"
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Manual Testing Instructions:                                   ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  1. Navigate through reels using the control panel             ║"
echo "║  2. Observe if all voting screens stay in sync                 ║"
echo "║  3. Check the green connection indicators                      ║"
echo "║  4. Try rapid navigation (spam next/prev buttons)              ║"
echo "║  5. Check browser console logs for any errors                  ║"
echo "║                                                                 ║"
echo "║  Press Ctrl+C when done to close all browsers                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Keep script running
wait
