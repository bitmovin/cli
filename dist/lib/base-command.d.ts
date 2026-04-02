import { Command } from '@oclif/core';
import { type ApiClient } from './client.js';
export declare abstract class BaseCommand extends Command {
    static baseFlags: {
        json: import("@oclif/core/interfaces").BooleanFlag<boolean>;
        fields: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        jq: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        format: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        'api-key': import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        quiet: import("@oclif/core/interfaces").BooleanFlag<boolean>;
    };
    private _parsedFlags?;
    private _api?;
    private _jsonMode?;
    /**
     * Status/info messages. Goes to stderr in JSON mode so stdout stays clean.
     * Goes to stdout in interactive mode so users see it normally.
     */
    log(message?: string, ...args: any[]): void;
    protected catch(err: Error & {
        httpStatusCode?: number;
        errorCode?: number;
        developerMessage?: string;
        requestId?: string;
    }): Promise<void>;
    protected parseFlags(): Promise<Record<string, unknown>>;
    protected getApi(): Promise<ApiClient>;
    protected isJsonMode(): Promise<boolean>;
    /** Whether to render rich tables (TTY or --format table) */
    private useTable;
    private writeJson;
    /**
     * Output structured data. In --json mode writes JSON to stdout.
     * Otherwise renders a key-value table for objects, columnar table for arrays.
     */
    protected outputData(data: unknown): Promise<void>;
    /**
     * Output a list of items. In --json mode writes full objects as JSON.
     * In table mode, only shows the specified columns.
     */
    protected outputList(items: Record<string, unknown>[], columns: string[]): Promise<void>;
}
//# sourceMappingURL=base-command.d.ts.map