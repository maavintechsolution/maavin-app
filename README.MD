# GT60 GPS Server

A Node.js server for receiving and processing data packets from GT60 GPS tracking devices.

## Features

- **TCP Server**: Receives data packets from GT60 devices on port 8080
- **HTTP Server**: Provides monitoring and testing endpoints on port 3000
- **Packet Validation**: Validates checksums and packet format
- **Command Parsing**: Supports all GT60 command types
- **Real-time Logging**: Detailed console output of received data
- **Acknowledgment**: Sends proper ACK responses to devices

## Supported GT60 Commands

- **BP00**: Heartbeat
- **BP01**: Login
- **BP02**: Position Report
- **BP03**: Alarm Report
- **BP04**: Status Report
- **BP05**: String Info
- **BP10**: GPS Info
- **BP11**: LBS Info
- **BP12**: WiFi Info
- **BP13**: Address Info
- **BP15**: Time Info
- **BP20**: Step Count
- **BP21**: Sleep Info
- **BP22**: Heart Rate
- **BP23**: Blood Pressure
- **BP24**: Temperature
- **BP25**: Blood Oxygen
- **BR00**: Response to command
- **BR01**: Configuration response

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Usage

### GT60 Device Connection

Configure your GT60 device to send data to:
- **Server IP**: Your server's IP address
- **Port**: 8080
- **Protocol**: TCP

### Monitoring

Visit `http://localhost:3000` to see server status and supported commands.

### Testing

Send a test packet using the HTTP endpoint:
```bash
curl -X POST http://localhost:3000/test-packet \
  -H "Content-Type: application/json" \
  -d '{"packet": "(123456789012345,BP02,240101120000,A,3116.7845,N,12122.7845,E,000.0,000,100,8,1.2,1234)"}'
```

## Packet Format

GT60 devices use the following packet format:
```
(IMEI,COMMAND,DATA1,DATA2,...,CHECKSUM)
```

Example:
```
(123456789012345,BP02,240101120000,A,3116.7845,N,12122.7845,E,000.0,000,100,8,1.2,1234)
```

## Server Output

The server provides detailed console output for each received packet:

```
=== New GT60 device connected: 192.168.1.100:12345 ===

--- Incoming Data ---
Raw packet received: (123456789012345,BP02,240101120000,A,3116.7845,N,12122.7845,E,000.0,000,100,8,1.2,1234)
✅ Packet Validation: VALID
📱 Device IMEI: 123456789012345
📨 Command: BP02 (Position Report)
🔢 Checksum: Received: 1234, Calculated: 1234
⏰ Timestamp: 2025-07-04T10:30:45.123Z
📊 Parsed Data: {
  "datetime": "240101120000",
  "gpsFix": "Valid",
  "latitude": 31.279742,
  "longitude": 121.379742,
  "speed": 0,
  "course": 0,
  "altitude": 100,
  "satellites": 8,
  "hdop": 1.2
}
📤 Sent ACK: (123456789012345,BR00,OK)
--- End Data Processing ---
```

## Configuration

You can modify the following settings in `server.js`:

- **TCP_PORT**: Port for GT60 device connections (default: 8080)
- **HTTP_PORT**: Port for HTTP monitoring (default: 3000)

## Error Handling

The server handles various error conditions:
- Invalid packet format
- Checksum mismatches
- Unknown command types
- Connection errors
- Invalid IMEI format

## License

MIT