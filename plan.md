# Plan.md

This file provide baseline, my rough idea for the product.

# General Idea

I need web app to Monitor our Zstack Cloud and can use to generate report.
this will be used as dashboard monitoring and reporting.

## Item to be monitor:
- Physical Server (hosts)
List of hosts, capacity each hosts and it's usage (physical and virtual)

- Primary storage
List of storages, capacity each storage and it's usage (physical and virtual)

- VM list
List all VM including name, status, project, tags, hosts, ip private, eip, total volume, which storage that vm and volume belongs

- VM creation time (for audit and reporting)
based on creation time will be used as weekly, monthly, yearly reporting. for example Feb 2026 there are 100 new VM created

- Project list
list all available project in the zstack cloud

- Resource Grouping
able to create custom resource grouping report.
For example
Resource Group Bursa, consist of project A, Project B, Project C and so on

other item can be added later
All monitored item should be able to extracted as report and shown in dashboard

## Data collection
data collection using Zstack API using AccessKey ID and AccessKey Secret
only read / get data, no modification allowed

## Action
### Document to create
- Create PRD
- Create ERD
- Create FRD
- Create FRS
- Create CLAUDE.md
- create AI model choice in CLAUDE.md

### Notes
ensure the application is easy for reusable, and deployment in different env (docker prefered)
split frontend, backend, and reusable items
Only create the documents, don't code