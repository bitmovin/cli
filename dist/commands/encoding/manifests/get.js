import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
export default class EncodingManifestGet extends BaseCommand {
    static description = 'Get manifest details';
    static args = {
        id: Args.string({ description: 'Manifest ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        type: Flags.string({ description: 'Manifest type', options: ['dash', 'hls', 'smooth'], required: true }),
    };
    async run() {
        const { args, flags } = await this.parse(EncodingManifestGet);
        let result;
        if (flags.type === 'dash')
            result = await (await this.getApi()).encoding.manifests.dash.get(args.id);
        else if (flags.type === 'hls')
            result = await (await this.getApi()).encoding.manifests.hls.get(args.id);
        else
            result = await (await this.getApi()).encoding.manifests.smooth.get(args.id);
        await this.outputData(result);
    }
}
//# sourceMappingURL=get.js.map