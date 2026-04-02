import { BaseCommand } from '../../../lib/base-command.js';
export default class ConfigListOrganizations extends BaseCommand {
    static description: string;
    static flags: {
        json: import("@oclif/core/interfaces").BooleanFlag<boolean>;
        fields: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        jq: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        format: import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        'api-key': import("@oclif/core/interfaces").OptionFlag<string | undefined, import("@oclif/core/interfaces").CustomOptions>;
        quiet: import("@oclif/core/interfaces").BooleanFlag<boolean>;
    };
    static examples: string[];
    run(): Promise<void>;
}
//# sourceMappingURL=organizations.d.ts.map