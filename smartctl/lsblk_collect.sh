#!/usr/bin/env bash
set -euo pipefail
OUTPUT_DIR="/root/smartctl"
HOSTNAME=$(hostname)
mkdir -p "$OUTPUT_DIR"
echo "Collecting lsblk data for ${HOSTNAME}..."
lsblk -J -o NAME,SIZE,TYPE,MOUNTPOINT > "$OUTPUT_DIR/${HOSTNAME}_lsblk.json"
echo "Saved to: $OUTPUT_DIR/${HOSTNAME}_lsblk.json"
