const express = require('express');
const bodyParser = require('body-parser');
const net = require('net');

const app = express();
const HTTP_PORT = 3000;
const TCP_PORT = 8080;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.raw({ type: 'application/octet-stream' }));

// GT60 Protocol Constants
const PROTOCOL_START = '(';
const PROTOCOL_END = ')';

// GT60 Command Types
const COMMAND_TYPES = {
    'BP00': 'Heartbeat',
    'BP01': 'Login',
    'BP02': 'Position Report',
    'BP03': 'Alarm Report',
    'BP04': 'Status Report',
    'BP05': 'String Info',
    'BP10': 'GPS Info',
    'BP11': 'LBS Info',
    'BP12': 'WiFi Info',
    'BP13': 'Address Info',
    'BP15': 'Time Info',
    'BP20': 'Step Count',
    'BP21': 'Sleep Info',
    'BP22': 'Heart Rate',
    'BP23': 'Blood Pressure',
    'BP24': 'Temperature',
    'BP25': 'Blood Oxygen',
    'BR00': 'Response to command',
    'BR01': 'Configuration response'
};

class GT60PacketParser {
    constructor() {
        this.buffer = '';
    }

    /**
     * Parse GT60 protocol packet
     * Format: (imei,command,data1,data2,...,checksum)
     */
    parsePacket(data) {
        try {
            const packet = data.toString().trim();
            console.log('Raw packet received:', packet);

            if (!packet.startsWith(PROTOCOL_START) || !packet.endsWith(PROTOCOL_END)) {
                throw new Error('Invalid packet format - missing start/end markers');
            }

            // Remove parentheses
            const content = packet.slice(1, -1);
            const parts = content.split(',');

            if (parts.length < 3) {
                throw new Error('Invalid packet format - insufficient data');
            }

            const imei = parts[0];
            const command = parts[1];
            const dataFields = parts.slice(2, -1); // All except last (checksum)
            const receivedChecksum = parts[parts.length - 1];

            // Validate IMEI
            if (!/^\d{15}$/.test(imei)) {
                throw new Error('Invalid IMEI format');
            }

            // Validate command
            if (!COMMAND_TYPES[command]) {
                console.warn(`Unknown command type: ${command}`);
            }

            // Calculate and verify checksum
            const calculatedChecksum = this.calculateChecksum(content.substring(0, content.lastIndexOf(',')));
            
            const parsedPacket = {
                imei,
                command,
                commandName: COMMAND_TYPES[command] || 'Unknown',
                data: dataFields,
                checksum: receivedChecksum,
                calculatedChecksum,
                isValid: calculatedChecksum === receivedChecksum,
                timestamp: new Date().toISOString()
            };

            return parsedPacket;
        } catch (error) {
            console.error('Packet parsing error:', error.message);
            return {
                error: error.message,
                rawData: data.toString(),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Calculate checksum for GT60 protocol
     */
    calculateChecksum(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data.charCodeAt(i);
        }
        return (sum & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }

    /**
     * Parse specific data based on command type
     */
    parseCommandData(command, data) {
        switch (command) {
            case 'BP01': // Login
                return this.parseLoginData(data);
            case 'BP02': // Position Report
                return this.parsePositionData(data);
            case 'BP03': // Alarm Report
                return this.parseAlarmData(data);
            case 'BP10': // GPS Info
                return this.parseGPSData(data);
            case 'BP11': // LBS Info
                return this.parseLBSData(data);
            case 'BP20': // Step Count
                return this.parseStepData(data);
            case 'BP22': // Heart Rate
                return this.parseHeartRateData(data);
            default:
                return { rawData: data };
        }
    }

    parseLoginData(data) {
        return {
            deviceType: data[0] || 'Unknown',
            firmwareVersion: data[1] || 'Unknown',
            protocol: data[2] || 'Unknown'
        };
    }

    parsePositionData(data) {
        if (data.length < 10) return { rawData: data };
        
        return {
            datetime: data[0],
            gpsFix: data[1] === 'A' ? 'Valid' : 'Invalid',
            latitude: this.parseCoordinate(data[2], data[3]),
            longitude: this.parseCoordinate(data[4], data[5]),
            speed: parseFloat(data[6]) || 0,
            course: parseFloat(data[7]) || 0,
            altitude: parseFloat(data[8]) || 0,
            satellites: parseInt(data[9]) || 0,
            hdop: parseFloat(data[10]) || 0
        };
    }

    parseAlarmData(data) {
        return {
            alarmType: data[0] || 'Unknown',
            datetime: data[1],
            location: data.length > 2 ? data.slice(2) : []
        };
    }

    parseGPSData(data) {
        return {
            satelliteCount: parseInt(data[0]) || 0,
            signalStrength: parseInt(data[1]) || 0,
            accuracy: parseFloat(data[2]) || 0
        };
    }

    parseLBSData(data) {
        return {
            mcc: data[0] || 'Unknown',
            mnc: data[1] || 'Unknown',
            lac: data[2] || 'Unknown',
            cellId: data[3] || 'Unknown',
            signalStrength: parseInt(data[4]) || 0
        };
    }

    parseStepData(data) {
        return {
            stepCount: parseInt(data[0]) || 0,
            calories: parseFloat(data[1]) || 0,
            distance: parseFloat(data[2]) || 0
        };
    }

    parseHeartRateData(data) {
        return {
            heartRate: parseInt(data[0]) || 0,
            measureTime: data[1] || new Date().toISOString()
        };
    }

    parseCoordinate(coord, direction) {
        if (!coord || !direction) return 0;
        
        const degrees = parseFloat(coord.substring(0, coord.indexOf('.') - 2));
        const minutes = parseFloat(coord.substring(coord.indexOf('.') - 2));
        let decimal = degrees + minutes / 60;
        
        if (direction === 'S' || direction === 'W') {
            decimal = -decimal;
        }
        
        return decimal;
    }
}

// Initialize parser
const parser = new GT60PacketParser();

// TCP Server for GT60 devices
const tcpServer = net.createServer((socket) => {
    console.log(`\n=== New GT60 device connected: ${socket.remoteAddress}:${socket.remotePort} ===`);
    
    socket.on('data', (data) => {
        console.log('\n--- Incoming Data ---');
        
        // Parse the packet
        const parsedPacket = parser.parsePacket(data);
        
        if (parsedPacket.error) {
            console.error('❌ Packet Error:', parsedPacket.error);
            console.log('Raw data:', parsedPacket.rawData);
        } else {
            console.log('✅ Packet Validation:', parsedPacket.isValid ? 'VALID' : 'INVALID');
            console.log('📱 Device IMEI:', parsedPacket.imei);
            console.log('📨 Command:', `${parsedPacket.command} (${parsedPacket.commandName})`);
            console.log('🔢 Checksum:', `Received: ${parsedPacket.checksum}, Calculated: ${parsedPacket.calculatedChecksum}`);
            console.log('⏰ Timestamp:', parsedPacket.timestamp);
            
            // Parse command-specific data
            const commandData = parser.parseCommandData(parsedPacket.command, parsedPacket.data);
            console.log('📊 Parsed Data:', JSON.stringify(commandData, null, 2));
            
            // Send acknowledgment back to device
            const ackMessage = `(${parsedPacket.imei},BR00,OK)`;
            socket.write(ackMessage);
            console.log('📤 Sent ACK:', ackMessage);
        }
        
        console.log('--- End Data Processing ---\n');
    });

    socket.on('close', () => {
        console.log(`🔌 GT60 device disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
    });

    socket.on('error', (err) => {
        console.error('❌ Socket error:', err.message);
    });
});

// HTTP Server for monitoring and API
app.get('/', (req, res) => {
    res.json({
        service: 'GT60 GPS Server',
        status: 'running',
        tcpPort: TCP_PORT,
        httpPort: HTTP_PORT,
        supportedCommands: COMMAND_TYPES
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Test endpoint for simulating packets
app.post('/test-packet', (req, res) => {
    const { packet } = req.body;
    
    if (!packet) {
        return res.status(400).json({ error: 'Packet data required' });
    }
    
    console.log('\n--- Test Packet Processing ---');
    const parsedPacket = parser.parsePacket(Buffer.from(packet));
    console.log('Test Result:', JSON.stringify(parsedPacket, null, 2));
    console.log('--- End Test Processing ---\n');
    
    res.json(parsedPacket);
});

// Start servers
tcpServer.listen(TCP_PORT, () => {
    console.log(`🚀 GT60 TCP Server listening on port ${TCP_PORT}`);
    console.log(`📡 Waiting for GT60 devices to connect...`);
});

app.listen(HTTP_PORT, () => {
    console.log(`🌐 HTTP Server listening on port ${HTTP_PORT}`);
    console.log(`📊 Visit http://localhost:${HTTP_PORT} for server info`);
    console.log(`🧪 Test endpoint: POST http://localhost:${HTTP_PORT}/test-packet`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down servers...');
    tcpServer.close(() => {
        console.log('TCP server closed');
        process.exit(0);
    });
});

console.log('\n🎯 GT60 GPS Server Started');
console.log('=====================================');
console.log(`TCP Port: ${TCP_PORT} (for GT60 devices)`);
console.log(`HTTP Port: ${HTTP_PORT} (for monitoring)`);
console.log('=====================================\n');