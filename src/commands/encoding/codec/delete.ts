import {Args, Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingCodecDelete extends BaseCommand {
  static override description = 'Delete a codec configuration';

  static override args = {
    id: Args.string({description: 'Codec config ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    codec: Flags.string({description: 'Codec type (h264, h265, av1, aac, opus)', required: true}),
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(EncodingCodecDelete);
    const codec = flags.codec.toLowerCase();

    if (codec === 'h264') await (await this.getApi()).encoding.configurations.video.h264.delete(args.id);
    else if (codec === 'h265') await (await this.getApi()).encoding.configurations.video.h265.delete(args.id);
    else if (codec === 'av1') await (await this.getApi()).encoding.configurations.video.av1.delete(args.id);
    else if (codec === 'vp9') await (await this.getApi()).encoding.configurations.video.vp9.delete(args.id);
    else if (codec === 'aac') await (await this.getApi()).encoding.configurations.audio.aac.delete(args.id);
    else if (codec === 'opus') await (await this.getApi()).encoding.configurations.audio.opus.delete(args.id);
    else this.error(`Unknown codec: ${codec}. Supported: h264, h265, av1, vp9, aac, opus`);

    this.log(`Codec config ${args.id} deleted.`);
  }
}
