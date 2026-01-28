#!/bin/bash
# Instagram Reels Downloader for AIFilms
# Usage: ./download-reels.sh [reel_url1] [reel_url2] ...
# Or: ./download-reels.sh --file urls.txt

VIDEOS_DIR="$(dirname "$0")/videos"
mkdir -p "$VIDEOS_DIR"

# Function to download a single reel
download_reel() {
    local url="$1"
    local index="$2"

    echo "Downloading reel $index: $url"

    yt-dlp \
        --output "$VIDEOS_DIR/reel-%(autonumber)s.%(ext)s" \
        --format "best[ext=mp4]/best" \
        --no-playlist \
        --autonumber-start "$index" \
        "$url"
}

# Check if we have arguments
if [ $# -eq 0 ]; then
    echo "Usage:"
    echo "  $0 URL1 URL2 URL3 ...          - Download specific URLs"
    echo "  $0 --file urls.txt             - Download URLs from file (one per line)"
    echo ""
    echo "Example Instagram reel URL format:"
    echo "  https://www.instagram.com/reel/ABC123xyz/"
    echo "  https://www.instagram.com/p/ABC123xyz/"
    exit 1
fi

# Handle --file option
if [ "$1" == "--file" ]; then
    if [ -z "$2" ] || [ ! -f "$2" ]; then
        echo "Error: Please provide a valid file path"
        exit 1
    fi

    index=1
    while IFS= read -r url || [ -n "$url" ]; do
        [ -z "$url" ] && continue
        [[ "$url" == \#* ]] && continue
        download_reel "$url" "$index"
        ((index++))
    done < "$2"
else
    # Download each URL provided as argument
    index=1
    for url in "$@"; do
        download_reel "$url" "$index"
        ((index++))
    done
fi

echo ""
echo "Downloaded videos are in: $VIDEOS_DIR"
ls -la "$VIDEOS_DIR"
