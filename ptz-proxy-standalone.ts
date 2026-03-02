#!/usr/bin/env node
/**
 * PTZ Proxy Standalone Server
 * 
 * Run this script on a machine that has direct access to PTZ cameras.
 * It provides a WebSocket server that forwards commands to PTZ devices.
 * 
 * Usage:
 *   npx tsx ptz-proxy-standalone.ts [port]
 *   
 * Default port: 9902
 */

import { WebSocketServer, WebSocket } from 'ws';
import net from 'net';

const PORT = parseInt(process.argv[2] ?? '9902', 10);

interface PTZCommand {
  action: 'pan' | 'tilt' | 'zoom' | 'focus' | 'stop' | 'preset' | 'custom';
  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'near' | 'far';
  speed?: number;
  presetNumber?: number;
  customCommand?: string;
}

interface ConnectionConfig {
  host: string;
  port: number;
  protocol: 'pelcod' | 'ujin';
  address: number;
}

interface ProxyMessage {
  type: 'connect' | 'command' | 'disconnect' | 'status' | 'raw';
  config?: ConnectionConfig;
  command?: PTZCommand;
  packet?: number[];
}

// PelcoD packet builder
function buildPelcoDPacket(command: PTZCommand, address: number = 1): number[] | null {
  const speed = Math.round(((command?.speed ?? 50) / 100) * 0x3F);
  
  let cmd1 = 0x00;
  let cmd2 = 0x00;
  let data1 = 0x00;
  let data2 = 0x00;

  switch (command?.action) {
    case 'stop': cmd2 = 0x00; break;
    case 'pan':
      data1 = speed;
      cmd2 = command?.direction === 'left' ? 0x04 : 0x02;
      break;
    case 'tilt':
      data2 = speed;
      cmd2 = command?.direction === 'up' ? 0x08 : 0x10;
      break;
    case 'zoom':
      cmd2 = command?.direction === 'in' ? 0x20 : 0x40;
      break;
    case 'focus':
      if (command?.direction === 'near') cmd1 = 0x01;
      else { cmd1 = 0x00; cmd2 = 0x80; }
      break;
    case 'preset':
      cmd2 = 0x07;
      data2 = command?.presetNumber ?? 1;
      break;
    default: return null;
  }

  const packet = [0xFF, address, cmd1, cmd2, data1, data2];
  packet.push((address + cmd1 + cmd2 + data1 + data2) % 256);
  return packet;
}

// ujin packet builder (PelcoD variant with header)
function buildUjinPacket(command: PTZCommand, address: number = 1): number[] | null {
  const pelco = buildPelcoDPacket(command, address);
  if (!pelco) return null;
  
  // Add ujin header and extension byte
  const packet = [0xAA, ...pelco.slice(0, -1), 0x00]; // Insert header, remove checksum
  const checksum = packet.reduce((sum, b) => sum + b, 0) % 256;
  packet.push(checksum);
  return packet;
}

console.log(`
╔═════════════════════════════════════════╗
║      PTZ Proxy Server                  ║
╠═════════════════════════════════════════╣
║  Listening on: ws://localhost:${PORT}     ║
║  Protocols: PelcoD, ujin               ║
╚═════════════════════════════════════════╝
`);

const wss = new WebSocketServer({ port: PORT });
const connections = new Map<WebSocket, { socket: net.Socket | null; config: ConnectionConfig | null }>();

wss.on('connection', (ws: WebSocket) => {
  console.log('[+] Client connected');
  connections.set(ws, { socket: null, config: null });

  ws.on('message', async (data: Buffer) => {
    try {
      const message: ProxyMessage = JSON.parse(data.toString());
      const conn = connections.get(ws);
      if (!conn) return;

      switch (message?.type) {
        case 'connect': {
          if (conn.socket) conn.socket.destroy();
          const config = message?.config;
          if (!config?.host || !config?.port) {
            ws.send(JSON.stringify({ type: 'error', success: false, message: 'Missing host/port' }));
            return;
          }
          
          conn.config = config;
          conn.socket = new net.Socket();
          
          conn.socket.connect(config.port, config.host, () => {
            console.log(`[✓] Connected to PTZ at ${config.host}:${config.port}`);
            ws.send(JSON.stringify({ type: 'connected', success: true }));
          });
          
          conn.socket.on('error', (err) => {
            console.error('[!] Socket error:', err?.message);
            ws.send(JSON.stringify({ type: 'error', success: false, message: err?.message }));
          });
          
          conn.socket.on('close', () => {
            console.log('[-] PTZ connection closed');
            conn.socket = null;
          });
          
          conn.socket.on('data', (buf) => {
            ws.send(JSON.stringify({ type: 'data', data: Array.from(buf) }));
          });
          break;
        }

        case 'command': {
          if (!conn?.socket) {
            ws.send(JSON.stringify({ type: 'error', success: false, message: 'Not connected' }));
            return;
          }
          
          const cmd = message?.command;
          if (!cmd) {
            ws.send(JSON.stringify({ type: 'error', success: false, message: 'No command' }));
            return;
          }
          
          const protocol = conn?.config?.protocol ?? 'pelcod';
          const address = conn?.config?.address ?? 1;
          const packet = protocol === 'ujin'
            ? buildUjinPacket(cmd, address)
            : buildPelcoDPacket(cmd, address);
          
          if (!packet) {
            ws.send(JSON.stringify({ type: 'error', success: false, message: 'Invalid command' }));
            return;
          }
          
          console.log(`[>] ${cmd?.action}${cmd?.direction ? '-' + cmd.direction : ''}: ${packet.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
          
          conn.socket.write(Buffer.from(packet), (err) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'error', success: false, message: err?.message }));
            } else {
              ws.send(JSON.stringify({ type: 'response', success: true, packet }));
            }
          });
          break;
        }

        case 'raw': {
          if (!conn?.socket) {
            ws.send(JSON.stringify({ type: 'error', success: false, message: 'Not connected' }));
            return;
          }
          
          const packet = message?.packet;
          if (!packet || !Array.isArray(packet)) {
            ws.send(JSON.stringify({ type: 'error', success: false, message: 'Invalid packet' }));
            return;
          }
          
          console.log(`[>] RAW: ${packet.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
          
          conn.socket.write(Buffer.from(packet), (err) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'error', success: false, message: err?.message }));
            } else {
              ws.send(JSON.stringify({ type: 'response', success: true }));
            }
          });
          break;
        }

        case 'disconnect': {
          if (conn?.socket) {
            conn.socket.destroy();
            conn.socket = null;
          }
          ws.send(JSON.stringify({ type: 'disconnected', success: true }));
          break;
        }

        case 'status': {
          ws.send(JSON.stringify({
            type: 'status',
            success: true,
            connected: !!conn?.socket,
            config: conn?.config,
          }));
          break;
        }
      }
    } catch (error) {
      console.error('[!] Parse error:', error);
      ws.send(JSON.stringify({ type: 'error', success: false, message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('[-] Client disconnected');
    const conn = connections.get(ws);
    if (conn?.socket) conn.socket.destroy();
    connections.delete(ws);
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close();
  process.exit(0);
});
