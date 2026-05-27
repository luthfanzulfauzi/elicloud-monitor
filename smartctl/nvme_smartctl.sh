OUTPUT_DIR="/root/smartctl"
HOSTNAME=`hostname`
echo "Collecting SMART data from NVMe drives..."
echo "Output directory: $OUTPUT_DIR"
echo ""

# Find all NVMe devices (e.g., /dev/nvme0n1, /dev/nvme1n1)
NVME_DEVICES=$(ls /dev/nvme*n1 2>/dev/null)

if [ -z "$NVME_DEVICES" ]; then
    echo "No NVMe devices found."
    exit 1
fi

# Loop through each NVMe device
for device in $NVME_DEVICES; do
    name=$(basename "$device")
    output_file="$OUTPUT_DIR/${HOSTNAME}_${name}_smart.txt"
    
    echo "Processing $device..."
    
    {
        echo "===== Device: $device ====="
        echo "===== Date: $(date) ====="
        echo ""
        echo "--- SMART INFO (-a) ---"
        smartctl -a "$device"
        echo ""
        echo "--- HEALTH (-H) ---"
        smartctl -H "$device"
        echo ""
        echo "--- ERROR LOG ---"
        smartctl -l error "$device"
    } > "$output_file" 2>&1
    
    echo "  Saved to: $output_file"
done

echo ""
echo "Done! All reports saved in: $OUTPUT_DIR"
