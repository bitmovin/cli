export interface CliConfig {
    apiKey?: string;
    tenantOrgId?: string;
    defaultRegion?: string;
}
export declare function loadConfig(): CliConfig;
export declare function saveConfig(config: CliConfig): void;
export declare function getConfigPath(): string;
//# sourceMappingURL=config.d.ts.map