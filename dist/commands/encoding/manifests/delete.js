import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingManifestDelete extends BaseCommand {
    static description = 'Delete a manifest';
    static args = {
        id: Args.string({ description: 'Manifest ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        type: Flags.string({ description: 'Manifest type', options: ['dash', 'hls', 'smooth'], required: true }),
    };
    async run() {
        const { args, flags } = await this.parse(EncodingManifestDelete);
        if (flags.type === 'dash')
            await (await this.getApi()).encoding.manifests.dash.delete(args.id);
        else if (flags.type === 'hls')
            await (await this.getApi()).encoding.manifests.hls.delete(args.id);
        else
            await (await this.getApi()).encoding.manifests.smooth.delete(args.id);
        this.log(`Manifest ${args.id} deleted.`);
    }
}
//# sourceMappingURL=delete.js.map