import {MCP_SERVER_NAME} from './registry.js';

export const BITMOVIN_MCP_URL = 'https://mcp.bitmovin.com';
export const MCP_AUTH_HEADER = 'x-api-key';

/** args for `claude mcp add`; the header argument carries the API key. */
export function claudeMcpAddArgs(apiKey: string): {args: string[]; redact: number[]} {
  const args = [
    'mcp', 'add',
    '--transport', 'http',
    '--scope', 'user',
    '--header', `${MCP_AUTH_HEADER}: ${apiKey}`,
    MCP_SERVER_NAME, BITMOVIN_MCP_URL,
  ];
  return {args, redact: [args.indexOf(`${MCP_AUTH_HEADER}: ${apiKey}`)]};
}

/** Probe args: exit 0 means the server is already configured. */
export function claudeMcpProbeArgs(): string[] {
  return ['mcp', 'get', MCP_SERVER_NAME];
}

/** Entry for ~/.cursor/mcp.json under mcpServers.bitmovin */
export function cursorMcpEntry(apiKey: string): Record<string, unknown> {
  return {url: BITMOVIN_MCP_URL, headers: {[MCP_AUTH_HEADER]: apiKey}};
}

/** Entry for ~/.gemini/settings.json under mcpServers.bitmovin (Gemini uses httpUrl for streamable HTTP) */
export function geminiMcpEntry(apiKey: string): Record<string, unknown> {
  return {httpUrl: BITMOVIN_MCP_URL, headers: {[MCP_AUTH_HEADER]: apiKey}};
}

/** TOML block appended to ~/.codex/config.toml */
export function buildCodexTomlBlock(apiKey: string): string {
  return [
    `[mcp_servers.${MCP_SERVER_NAME}]`,
    `url = "${BITMOVIN_MCP_URL}"`,
    `http_headers = { "${MCP_AUTH_HEADER}" = ${JSON.stringify(apiKey)} }`,
    '',
  ].join('\n');
}
