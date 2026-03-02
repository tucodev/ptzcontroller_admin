/**
 * PTZ Proxy Service
 * 
 * This module provides WebSocket-based proxy functionality for Mode 3 operation.
 * It allows browsers to communicate with PTZ cameras through a local proxy server.
 * 
 * Usage:
 * 1. Run the proxy on a machine that has direct access to the PTZ camera
 * 2. Configure the camera in the web app to use 'proxy' mode
 * 3. Set the proxyUrl to ws://<proxy-host>:9902
 * 
 * For standalone deployment, this can be extracted to a separate Node.js application.
 */

import { WebSocketServer, WebSocket } from 'ws';
import net from 'net';
import { ProxyMessage, ProxyResponse, PTZCommand, CameraConfig } from './types';
import { PelcoDProtocol } from './protocols/pelcod-protocol';
import { UjinProtocol } from './protocols/ujin-protocol';

interface ProxyConnection {
  ws: WebSocket;
  socket: net.Socket | null;
  config: Partial<CameraConfig> | null;
}

export class PTZProxyServer {
  private wss: WebSocketServer | null = null;
  private connections: Map<WebSocket, ProxyConnection> = new Map();
  private port: number;

  constructor(port: number = 9902) {
    this.port = port;
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.port });
    console.log(`PTZ Proxy Server started on ws://localhost:${this.port}`);

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Client connected to proxy');
      
      this.connections.set(ws, {
        ws,
        socket: null,
        config: null,
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const message: ProxyMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          this.sendResponse(ws, {
            type: 'error',
            success: false,
            message: `Parse error: ${(error as Error)?.message ?? 'Unknown error'}`,
          });
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected from proxy');
        const conn = this.connections.get(ws);
        if (conn?.socket) {
          conn.socket.destroy();
        }
        this.connections.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  stop(): void {
    for (const [ws, conn] of this.connections) {
      if (conn?.socket) {
        conn.socket.destroy();
      }
      ws.close();
    }
    this.connections.clear();
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  private async handleMessage(ws: WebSocket, message: ProxyMessage): Promise<void> {
    const conn = this.connections.get(ws);
    if (!conn) return;

    switch (message?.type) {
      case 'connect':
        await this.handleConnect(ws, conn, message?.connectionConfig);
        break;

      case 'command':
        await this.handleCommand(ws, conn, message?.command);
        break;

      case 'disconnect':
        this.handleDisconnect(ws, conn);
        break;

      case 'status':
        this.sendResponse(ws, {
          type: 'response',
          success: true,
          data: {
            connected: !!conn?.socket,
            config: conn?.config,
          },
        });
        break;

      default:
        this.sendResponse(ws, {
          type: 'error',
          success: false,
          message: 'Unknown message type',
        });
    }
  }

  private async handleConnect(
    ws: WebSocket,
    conn: ProxyConnection,
    config?: Partial<CameraConfig>
  ): Promise<void> {
    if (conn?.socket) {
      conn.socket.destroy();
      conn.socket = null;
    }

    const host = config?.host ?? 'localhost';
    const port = config?.port ?? 5000;

    conn.config = config ?? null;
    conn.socket = new net.Socket();

    conn.socket.connect(port, host, () => {
      console.log(`Proxy connected to PTZ at ${host}:${port}`);
      this.sendResponse(ws, {
        type: 'connected',
        success: true,
        message: `Connected to ${host}:${port}`,
      });
    });

    conn.socket.on('data', (data: Buffer) => {
      this.sendResponse(ws, {
        type: 'response',
        success: true,
        data: { received: Array.from(data) },
      });
    });

    conn.socket.on('error', (error) => {
      this.sendResponse(ws, {
        type: 'error',
        success: false,
        message: `Connection error: ${error?.message ?? 'Unknown error'}`,
      });
    });

    conn.socket.on('close', () => {
      this.sendResponse(ws, {
        type: 'disconnected',
        success: true,
        message: 'PTZ connection closed',
      });
      conn.socket = null;
    });
  }

  private async handleCommand(
    ws: WebSocket,
    conn: ProxyConnection,
    command?: PTZCommand
  ): Promise<void> {
    if (!conn?.socket) {
      this.sendResponse(ws, {
        type: 'error',
        success: false,
        message: 'Not connected to PTZ',
      });
      return;
    }

    if (!command) {
      this.sendResponse(ws, {
        type: 'error',
        success: false,
        message: 'No command provided',
      });
      return;
    }

    // Generate packet based on protocol
    const protocol = conn?.config?.protocol ?? 'pelcod';
    let packet: number[] | null = null;

    if (protocol === 'pelcod') {
      const handler = new PelcoDProtocol(conn.config as CameraConfig);
      packet = handler.generatePacket(command);
    } else if (protocol === 'ujin') {
      const handler = new UjinProtocol(conn.config as CameraConfig);
      packet = handler.generatePacket(command);
    }

    if (!packet) {
      this.sendResponse(ws, {
        type: 'error',
        success: false,
        message: 'Failed to generate command packet',
      });
      return;
    }

    conn.socket.write(Buffer.from(packet), (err) => {
      if (err) {
        this.sendResponse(ws, {
          type: 'error',
          success: false,
          message: `Send error: ${err?.message ?? 'Unknown error'}`,
        });
      } else {
        this.sendResponse(ws, {
          type: 'response',
          success: true,
          message: 'Command sent',
          data: { packet: packet?.map(b => b?.toString?.(16)?.padStart?.(2, '0') ?? '00') },
        });
      }
    });
  }

  private handleDisconnect(ws: WebSocket, conn: ProxyConnection): void {
    if (conn?.socket) {
      conn.socket.destroy();
      conn.socket = null;
    }
    this.sendResponse(ws, {
      type: 'disconnected',
      success: true,
      message: 'Disconnected from PTZ',
    });
  }

  private sendResponse(ws: WebSocket, response: ProxyResponse): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(response));
    }
  }
}

// Export for standalone usage
export function startProxyServer(port?: number): PTZProxyServer {
  const server = new PTZProxyServer(port);
  server.start();
  return server;
}
