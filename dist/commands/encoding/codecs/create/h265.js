import { Flags } from '@oclif/core';
import { H265VideoConfiguration } from '@bitmovin/api-sdk';
import { BaseCommand } from '../../../../lib/base-command.js';
export default class EncodingCodecCreateH265 extends BaseCommand {
    static description = 'Create an H.265/HEVC codec configuration';
    static flags = {
        ...BaseCommand.baseFlags,
        name: Flags.string({ description: 'Config name', required: true }),
        bitrate: Flags.integer({ description: 'Bitrate in bps', required: true }),
        height: Flags.integer({ description: 'Video height' }),
        width: Flags.integer({ description: 'Video width' }),
        profile: Flags.string({ description: 'H.265 profile', options: ['MAIN', 'MAIN10'] }),
        rate: Flags.integer({ description: 'Frame rate' }),
    };
    async run() {
        const { flags } = await this.parse(EncodingCodecCreateH265);
        const config = new H265VideoConfiguration({
            name: flags.name,
            bitrate: flags.bitrate,
            ...(flags.height && { height: flags.height }),
            ...(flags.width && { width: flags.width }),
            ...(flags.profile && { profile: flags.profile }),
            ...(flags.rate && { rate: flags.rate }),
        });
        const result = await (await this.getApi()).encoding.configurations.video.h265.create(config);
        this.log(`H.265 config created: ${result.id}`);
        await this.outputData(result);
    }
}
//# sourceMappingURL=h265.js.map