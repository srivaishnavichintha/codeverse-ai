# contestZone Module Architecture
New contest types (team contests, rated contests, hackathons) follow this pattern:
1. Add model in /models/
2. Add service in /services/
3. Register socket events in /sockets/contestZone.socket.js
4. Export from index.js