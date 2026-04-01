import {Args, Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingCodecGet extends BaseCommand {
  static override description = 'Get codec configuration details';

  static override args = {
    id: Args.string({description: 'Codec config ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    codec: Flags.string({description: 'Codec type (h264, h265, av1, aac, opus)', required: true}),
  };

  async run(): Promise<void> {
    const {args, flags} = await this.parse(EncodingCodecGet);
    const codec = flags.codec.toLowerCase();

    let result: unknown;
    if (codec === 'h264') result = await (await this.getApi()).encoding.configurations.video.h264.get(args.id);
    else if (codec === 'h265') result = await (await this.getApi()).encoding.configurations.video.h265.get(args.id);
    else if (codec === 'av1') result = await (await this.getApi()).encoding.configurations.video.av1.get(args.id);
    else if (codec === 'vp9') result = await (await this.getApi()).encoding.configurations.video.vp9.get(args.id);
    else if (codec === 'aac') result = await (await this.getApi()).encoding.configurations.audio.aac.get(args.id);
    else if (codec === 'opus') result = await (await this.getApi()).encoding.configurations.audio.opus.get(args.id);
    else this.error(`Unknown codec: ${codec}. Supported: h264, h265, av1, vp9, aac, opus`);

    await this.outputData(result);
  }
}
