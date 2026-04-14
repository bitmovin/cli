import {Flags} from '@oclif/core';
import {H264VideoConfiguration, ProfileH264} from '@bitmovin/api-sdk';
import {BaseCommand} from '../../../../lib/base-command.js';

export default class EncodingCodecCreateH264 extends BaseCommand {
  static override description = 'Create an H.264 codec configuration';

  static override flags = {
    ...BaseCommand.baseFlags,
    name: Flags.string({description: 'Config name', required: true}),
    bitrate: Flags.integer({description: 'Bitrate in bps', required: true}),
    height: Flags.integer({description: 'Video height'}),
    width: Flags.integer({description: 'Video width'}),
    profile: Flags.string({description: 'H.264 profile', options: ['BASELINE', 'MAIN', 'HIGH']}),
    rate: Flags.integer({description: 'Frame rate'}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingCodecCreateH264);
    const config = new H264VideoConfiguration({
      name: flags.name,
      bitrate: flags.bitrate,
      ...(flags.height && {height: flags.height}),
      ...(flags.width && {width: flags.width}),
      ...(flags.profile && {profile: flags.profile as ProfileH264}),
      ...(flags.rate && {rate: flags.rate}),
    });

    const result = await (await this.getApi()).encoding.configurations.video.h264.create(config);
    this.log(`H.264 config created: ${result.id}`);
    await this.outputData(result);
  }
}
