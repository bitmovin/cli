import { Flags } from '@oclif/core';
import { AacAudioConfiguration } from '@bitmovin/api-sdk';
import { BaseCommand } from '../../../../lib/base-command.js';
export default class EncodingCodecCreateAac extends BaseCommand {
    static description = 'Create an AAC audio codec configuration';
    static flags = {
        ...BaseCommand.baseFlags,
        name: Flags.string({ description: 'Config name', required: true }),
        bitrate: Flags.integer({ description: 'Bitrate in bps', required: true }),
        'sample-rate': Flags.integer({ description: 'Sample rate in Hz (e.g. 48000)' }),
    };
    async run() {
        const { flags } = await this.parse(EncodingCodecCreateAac);
        const config = new AacAudioConfiguration({
            name: flags.name,
            bitrate: flags.bitrate,
            ...(flags['sample-rate'] && { rate: flags['sample-rate'] }),
        });
        const result = await (await this.getApi()).encoding.configurations.audio.aac.create(config);
        this.log(`AAC config created: ${result.id}`);
        await this.outputData(result);
    }
}
//# sourceMappingURL=aac.js.map