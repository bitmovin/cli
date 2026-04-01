import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingManifestList extends BaseCommand {
  static override description = 'List manifests';

  static override flags = {
    ...BaseCommand.baseFlags,
    type: Flags.string({description: 'Filter by manifest type', options: ['dash', 'hls', 'smooth']}),
    limit: Flags.integer({description: 'Max results', default: 25}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingManifestList);
    const listFn = (q: any) => {
      q.limit(flags.limit);
      return q;
    };

    let items: Record<string, unknown>[];
    if (flags.type === 'dash') {
      items = (await (await this.getApi()).encoding.manifests.dash.list(listFn)).items ?? [];
    } else if (flags.type === 'hls') {
      items = (await (await this.getApi()).encoding.manifests.hls.list(listFn)).items ?? [];
    } else if (flags.type === 'smooth') {
      items = (await (await this.getApi()).encoding.manifests.smooth.list(listFn)).items ?? [];
    } else {
      items = (await (await this.getApi()).encoding.manifests.list(listFn)).items ?? [];
    }

    await this.outputList(items as Record<string, unknown>[], ['id', 'name', 'type', 'status', 'createdAt']);
  }
}
