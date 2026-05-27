# new_feature_plan.md

# General Idea

I need to add new feature to this elicloud-monitoring as a new Page "Disks Health Monitoring".
This elicloud-monitoring feature will only parse, summarize, and visualize the smartctl output

# Flow
In Storage server running smartctl collect script
├── smartctl output saved as {HOSTNAME}_{NVME_DISK}_smart.txt
│   ├── Elicloud-monitoring VM will download all smartctl output from all storage node listed through scp
│   │   └── parse, summarize, and visualize the smartctl output

# Output in elicloud-monitoring page
Sample output desired:
Hostname	NVME Device	Model Number	Capacity	TBW (Terabytes Written)	Endurance Used	Write Endurance (Life Remaining)	Available Spare	Disk Health	Summary	Notes
zs-storage01	nvme0n1	Dell Express Flash NVMe P4610 3.2TB SFF	3.20 TB	528.0 TB	4.00%	96.00%	99.00%	PASSED	Good	All indicators nominal
