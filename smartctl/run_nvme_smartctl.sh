# Run Smartctl in every Nodes
# Run in Node1
/root/smartctl/nvme_smartctl.sh
sleep 5
# Run in Other Nodes
for stor in {2..6}
do
	ssh zs-storage0$stor  /root/smartctl/nvme_smartctl.sh
	sleep 5
done

sleep 5

for stor in {2..6}
do
        scp zs-storage0$stor:/root/smartctl/*.txt /root/smartctl/
        sleep 5
done

