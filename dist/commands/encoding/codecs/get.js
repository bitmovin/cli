import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../../lib/base-command.js';
const CODEC_GETTERS = {
    H264: (api, id) => api.encoding.configurations.video.h264.get(id),
    H265: (api, id) => api.encoding.configurations.video.h265.get(id),
    AV1: (api, id) => api.encoding.configurations.video.av1.get(id),
    VP9: (api, id) => api.encoding.configurations.video.vp9.get(id),
    AAC: (api, id) => api.encoding.configurations.audio.aac.get(id),
    OPUS: (api, id) => api.encoding.configurations.audio.opus.get(id),
};
export default class EncodingCodecGet extends BaseCommand {
    static description = 'Get codec configuration details';
    static args = {
        id: Args.string({ description: 'Codec config ID', required: true }),
    };
    static flags = {
        ...BaseCommand.baseFlags,
        codec: Flags.string({ description: 'Codec type (auto-detected if omitted). Supported: h264, h265, av1, vp9, aac, opus' }),
    };
    async run() {
        const { args, flags } = await this.parse(EncodingCodecGet);
        const api = await this.getApi();
        let codecType = flags.codec?.toUpperCase();
        if (!codecType) {
            const typeResponse = await api.encoding.configurations.type.get(args.id);
            codecType = typeResponse.type;
            if (!codecType) {
                this.error('Could not auto-detect codec type. Specify --codec explicitly.');
            }
        }
        const getFn = CODEC_GETTERS[codecType];
        if (!getFn) {
            // Fall back to generic get for unsupported specific codecs
            const result = await api.encoding.configurations.get(args.id);
            await this.outputData(result);
            return;
        }
        const result = await getFn(api, args.id);
        await this.outputData(result);
    }
}
//# sourceMappingURL=get.js.map