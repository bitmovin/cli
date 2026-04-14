import {Args, Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import type {ApiClient} from '../../../lib/client.js';

const CODEC_DELETERS: Record<string, (api: ApiClient, id: string) => Promise<unknown>> = {
  H264: (api, id) => api.encoding.configurations.video.h264.delete(id),
  H265: (api, id) => api.encoding.configurations.video.h265.delete(id),
  AV1: (api, id) => api.encoding.configurations.video.av1.delete(id),
  VP9: (api, id) => api.encoding.configurations.video.vp9.delete(id),
  AAC: (api, id) => api.encoding.configurations.audio.aac.delete(id),
  OPUS: (api, id) => api.encoding.configurations.audio.opus.delete(id),
};

export default class EncodingCodecDelete extends BaseCommand {
  static override description = 'Delete a codec configuration';

  static override args = {
    id: Args.string({description: 'Codec config ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    codec: Flags.string({description: 'Codec type (auto-detected if omitted). Supported: h264, h265, av1, vp9, aac, opus'}),
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(EncodingCodecDelete);
    const api = await this.getApi();

    let codecType = flags.codec?.toUpperCase();
    if (!codecType) {
      const typeResponse = await api.encoding.configurations.type.get(args.id);
      codecType = typeResponse.type as string | undefined;
      if (!codecType) {
        this.error('Could not auto-detect codec type. Specify --codec explicitly.');
      }
    }

    const deleteFn = CODEC_DELETERS[codecType];
    if (!deleteFn) {
      this.error(`Unsupported codec type for deletion: ${codecType}. Supported: ${Object.keys(CODEC_DELETERS).join(', ').toLowerCase()}`);
    }

    await deleteFn(api, args.id);
    this.log(`Codec config ${args.id} deleted.`);
  }
}
