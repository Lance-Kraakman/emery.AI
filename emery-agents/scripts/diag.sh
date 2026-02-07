#!/bin/bash
# gRPC diagnostics script for debugging resource issues

PID=$(pgrep -f "grpc.server")

echo "======== GRPC DIAGNOSTICS ========"
date

echo -e "\n[MEMORY]"
free -h

echo -e "\n[CPU LOAD]"
cat /proc/loadavg

echo -e "\n[PROCESS INFO] PID: $PID"
if [ -n "$PID" ]; then
  grep -E 'Threads|VmRSS|VmPeak|State' /proc/$PID/status
  echo "Open FDs: $(ls /proc/$PID/fd | wc -l)"
else
  echo "Process not running!"
fi

echo -e "\n[NETWORK - gRPC port 50051]"
# C3A3 = 50051 in hex
CONNS=$(cat /proc/net/tcp | grep -i ":C3A3" | wc -l)
echo "Active connections: $CONNS"

echo -e "\n[TCP STATE COUNTS]"
cat /proc/net/tcp | awk 'NR>1 {
  state=$4
  if(state=="01") s="ESTABLISHED"
  else if(state=="06") s="TIME_WAIT"
  else if(state=="0A") s="LISTEN"
  else s=state
  print s
}' | sort | uniq -c | sort -rn

echo -e "\n[TOP 5 BY MEMORY]"
ps aux --sort=-%mem | head -6
