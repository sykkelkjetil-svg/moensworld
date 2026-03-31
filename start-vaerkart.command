#!/bin/bash
# Dobbeltklikk denne filen for å starte Norsk Vær Live

cd "$(dirname "$0")"

# Drep gammel proxy hvis den kjører
pkill -f frost-proxy 2>/dev/null
sleep 1

# Start proxy i bakgrunnen
nohup node frost-proxy.js > /tmp/frost-proxy.log 2>&1 &
echo $! > /tmp/frost-proxy.pid

sleep 2

# Åpne i Safari/Chrome
open http://localhost:3333

echo "✓ Norsk Vær Live kjører på http://localhost:3333"
echo "  Lukk dette vinduet for å stoppe serveren."
