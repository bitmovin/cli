import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingCodecList extends BaseCommand {
  static override description = 'List codec configurations';

  static override flags = {
    ...BaseCommand.baseFlags,
    type: Flags.string({description: 'Filter by type', options: ['video', 'audio']}),
    codec: Flags.string({description: 'Filter by codec (h264, h265, av1, aac, opus, etc.)'}),
    limit: Flags.integer({description: 'Max results', default: 25}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingCodecList);
    const listFn = (q: any) => {
      q.limit(flags.limit);
      return q;
    };

    const codec = flags.codec?.toLowerCase();
    let items: Record<string, unknown>[];

    if (codec === 'h264') {
      items = (await (await this.getApi()).encoding.configurations.video.h264.list(listFn)).items ?? [];
    } else if (codec === 'h265') {
      items = (await (await this.getApi()).encoding.configurations.video.h265.list(listFn)).items ?? [];
    } else if (codec === 'av1') {
      items = (await (await this.getApi()).encoding.configurations.video.av1.list(listFn)).items ?? [];
    } else if (codec === 'vp9') {
      items = (await (await this.getApi()).encoding.configurations.video.vp9.list(listFn)).items ?? [];
    } else if (codec === 'aac') {
      items = (await (await this.getApi()).encoding.configurations.audio.aac.list(listFn)).items ?? [];
    } else if (codec === 'opus') {
      items = (await (await this.getApi()).encoding.configurations.audio.opus.list(listFn)).items ?? [];
    } else if (flags.type === 'video') {
      items = (await (await this.getApi()).encoding.configurations.video.list(listFn)).items ?? [];
    } else if (flags.type === 'audio') {
      items = (await (await this.getApi()).encoding.configurations.audio.list(listFn)).items ?? [];
    } else {
      items = (await (await this.getApi()).encoding.configurations.list(listFn)).items ?? [];
    }

    await this.outputList(items as Record<string, unknown>[], ['id', 'name', 'type', 'createdAt']);
  }
}
