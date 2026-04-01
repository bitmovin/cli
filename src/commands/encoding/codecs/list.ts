import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingCodecList extends BaseCommand {
  static override description = 'List codec configurations';

  static override flags = {
    ...BaseCommand.baseFlags,
    type: Flags.string({description: 'Filter by type', options: ['video', 'audio']}),
    codec: Flags.string({description: 'Filter by codec (h264, h265, av1, aac, opus, etc.)'}),
    limit: Flags.integer({description: 'Max results', default: 25}),
    offset: Flags.integer({description: 'Offset for pagination', default: 0}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingCodecList);
    const api = await this.getApi();
    const listFn = (q: any) => {
      q.limit(flags.limit);
      q.offset(flags.offset);
      return q;
    };

    const codec = flags.codec?.toLowerCase();
    const type = flags.type?.toLowerCase();
    let items: unknown[];

    if (codec === 'h264') {
      items = (await api.encoding.configurations.video.h264.list(listFn)).items ?? [];
    } else if (codec === 'h265') {
      items = (await api.encoding.configurations.video.h265.list(listFn)).items ?? [];
    } else if (codec === 'av1') {
      items = (await api.encoding.configurations.video.av1.list(listFn)).items ?? [];
    } else if (codec === 'vp9') {
      items = (await api.encoding.configurations.video.vp9.list(listFn)).items ?? [];
    } else if (codec === 'aac') {
      items = (await api.encoding.configurations.audio.aac.list(listFn)).items ?? [];
    } else if (codec === 'opus') {
      items = (await api.encoding.configurations.audio.opus.list(listFn)).items ?? [];
    } else {
      const allItems: any[] = (await api.encoding.configurations.list(listFn)).items ?? [];
      if (type === 'video') {
        const videoCodecs = new Set(['H264', 'H265', 'AV1', 'VP9', 'VP8', 'H262', 'MJPEG']);
        items = allItems.filter((item: any) => videoCodecs.has(String(item.type ?? '').toUpperCase()));
      } else if (type === 'audio') {
        const audioCodecs = new Set(['AAC', 'OPUS', 'VORBIS', 'AC3', 'EAC3', 'MP2', 'MP3', 'DTS', 'DTS_PASSTHROUGH', 'DTS_X', 'DTSE']);
        items = allItems.filter((item: any) => audioCodecs.has(String(item.type ?? '').toUpperCase()));
      } else {
        items = allItems;
      }
    }

    await this.outputList(items as Record<string, unknown>[], ['id', 'name', 'type', 'createdAt']);
  }
}
