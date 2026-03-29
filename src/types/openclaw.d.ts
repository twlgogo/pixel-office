/**
 * Type declarations for openclaw module (global npm install)
 */

declare module 'openclaw' {
  export class GatewayClient {
    opts: {
      url?: string;
      token?: string;
      password?: string;
      deviceIdentity?: ReturnType<typeof import('openclaw')['loadOrCreateDeviceIdentity']>;
      clientName?: string;
      clientDisplayName?: string;
      clientVersion?: string;
      mode?: string;
      scopes?: string[];
      caps?: string[];
      commands?: string[];
      permissions?: Record<string, unknown>;
      role?: string;
      deviceToken?: string;
      bootstrapToken?: string;
      platform?: string;
      deviceFamily?: string;
      instanceId?: string;
      pathEnv?: string;
      tlsFingerprint?: string;
      connectDelayMs?: number;
      minProtocol?: number;
      maxProtocol?: number;
      requestTimeoutMs?: number;
      tickWatchMinIntervalMs?: number;
      onEvent?: (event: GatewayEvent) => void;
      onHelloOk?: (helloOk: any) => void;
      onConnectError?: (err: Error) => void;
      onClose?: (code: number, reason: string) => void;
      onGap?: (info: { expected: number; received: number }) => void;
    };

    constructor(opts: Partial<GatewayClient['opts']>);

    start(): void;
    stop(): void;
    stopAndWait(opts?: { timeoutMs?: number }): Promise<void>;
    request(method: string, params?: Record<string, unknown>, opts?: { timeoutMs?: number; expectFinal?: boolean }): Promise<any>;
  }

  export interface GatewayEvent {
    event: string;
    seq?: number;
    payload?: any;
  }

  export function loadOrCreateDeviceIdentity(filePath?: string): {
    deviceId: string;
    publicKeyPem: string;
    privateKeyPem: string;
  };
}
