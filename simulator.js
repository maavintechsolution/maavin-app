const net = require('net');

// GT60 Device Simulator
class GT60Simulator {
    constructor(serverHost = 'localhost', serverPort = 8080) {
        this.serverHost = serverHost;
        this.serverPort = serverPort;
        this.imei = '123456789012345';
        this.client = null;
    }

    connect() {
        this.client = new net.Socket();
        
        this.client.connect(this.serverPort, this.serverHost, () => {
            console.log(`🔌 Connected to GT60 server at ${this.serverHost}:${this.serverPort}`);
            this.sendLoginPacket();
        });

        this.client.on('data', (data) => {
            console.log('📨 Received from server:', data.toString());
        });

        this.client.on('close', () => {
            console.log('🔌 Connection closed');
        });

        this.client.on('error', (err) => {
            console.error('❌ Connection error:', err.message);
        });
    }

    calculateChecksum(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data.charCodeAt(i);
        }
        return (sum & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }

    sendPacket(command, ...data) {
        const content = [this.imei, command, ...data].join(',');
        const checksum = this.calculateChecksum(content);
        const packet = `(${content},${checksum})`;
        
        console.log(`📤 Sending: ${packet}`);
        this.client.write(packet);
    }

    sendLoginPacket() {
        console.log('\n🚀 Sending login packet...');
        this.sendPacket('BP01', 'GT60', 'V1.0', '1.0');
    }

    sendHeartbeat() {
        console.log('\n💓 Sending heartbeat...');
        this.sendPacket('BP00', new Date().toISOString());
    }

    sendPositionReport() {
        console.log('\n📍 Sending position report...');
        const now = new Date();
        const datetime = now.toISOString().replace(/[-:]/g, '').substring(2, 14); // YYMMDDHHMMSS
        
        this.sendPacket(
            'BP02',
            datetime,
            'A',              // GPS fix status
            '3116.7845',      // Latitude
            'N',              // North
            '12122.7845',     // Longitude
            'E',              // East
            '045.5',          // Speed (km/h)
            '180',            // Course
            '150',            // Altitude
            '12',             // Satellites
            '0.8'             // HDOP
        );
    }

    sendAlarmReport() {
        console.log('\n🚨 Sending SOS alarm...');
        const now = new Date();
        const datetime = now.toISOString().replace(/[-:]/g, '').substring(2, 14);
        
        this.sendPacket(
            'BP03',
            'SOS',            // Alarm type
            datetime,
            'A',              // GPS fix status
            '3116.7845',      // Latitude
            'N',
            '12122.7845',     // Longitude
            'E'
        );
    }

    sendHeartRateData() {
        console.log('\n❤️ Sending heart rate data...');
        const heartRate = 65 + Math.floor(Math.random() * 30); // Random heart rate 65-95
        const now = new Date().toISOString().replace(/[-:]/g, '').substring(2, 14);
        
        this.sendPacket('BP22', heartRate.toString(), now);
    }

    sendStepCount() {
        console.log('\n👟 Sending step count...');
        const steps = Math.floor(Math.random() * 10000); // Random steps 0-10000
        const calories = Math.floor(steps * 0.04); // Rough calorie calculation
        const distance = (steps * 0.0008).toFixed(2); // Rough distance in km
        
        this.sendPacket('BP20', steps.toString(), calories.toString(), distance);
    }

    startSimulation() {
        this.connect();
        
        // Send different types of packets at intervals
        setTimeout(() => this.sendHeartbeat(), 2000);
        setTimeout(() => this.sendPositionReport(), 4000);
        setTimeout(() => this.sendHeartRateData(), 6000);
        setTimeout(() => this.sendStepCount(), 8000);
        setTimeout(() => this.sendAlarmReport(), 10000);
        
        // Send periodic heartbeats
        setInterval(() => this.sendHeartbeat(), 30000);
        
        // Send periodic position reports
        setInterval(() => this.sendPositionReport(), 60000);
    }

    disconnect() {
        if (this.client) {
            this.client.end();
        }
    }
}

// Run the simulator
console.log('🎯 GT60 Device Simulator Starting...');
console.log('=====================================');

const simulator = new GT60Simulator();
simulator.startSimulation();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down simulator...');
    simulator.disconnect();
    process.exit(0);
});