export interface FlueServer {
  url: string;
  label: string;
}

export interface AgentTarget {
  serverUrl: string;
  agent: string;
  id: string;
  payload?: unknown;
}

export interface FlueEvent {
  event: string;
  data: unknown;
  raw: string;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error';
