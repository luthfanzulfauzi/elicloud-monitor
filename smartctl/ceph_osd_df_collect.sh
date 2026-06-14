#!/usr/bin/env bash
set -euo pipefail
# Run on the Ceph admin/monitor node only. Collects cluster-wide OSD utilization.
OUTPUT_DIR="/root/smartctl"
HOSTNAME=$(hostname)
mkdir -p "$OUTPUT_DIR"
echo "Collecting ceph osd df data from ${HOSTNAME}..."
ceph osd df --format json > "$OUTPUT_DIR/${HOSTNAME}_ceph_osd_df.json"
echo "Saved to: $OUTPUT_DIR/${HOSTNAME}_ceph_osd_df.json"
