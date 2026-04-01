import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingInputList extends BaseCommand {
  static override description = 'List encoding inputs';

  static override flags = {
    ...BaseCommand.baseFlags,
    type: Flags.string({description: 'Filter by type (s3, gcs, http, https, azure)'}),
    limit: Flags.integer({description: 'Max results', default: 25}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingInputList);
    const listFn = (q: any) => {
      q.limit(flags.limit);
      return q;
    };

    let items: Record<string, unknown>[];
    const type = flags.type?.toLowerCase();

    if (type === 's3') {
      items = (await (await this.getApi()).encoding.inputs.s3.list(listFn)).items ?? [];
    } else if (type === 'gcs') {
      items = (await (await this.getApi()).encoding.inputs.gcs.list(listFn)).items ?? [];
    } else if (type === 'http') {
      items = (await (await this.getApi()).encoding.inputs.http.list(listFn)).items ?? [];
    } else if (type === 'https') {
      items = (await (await this.getApi()).encoding.inputs.https.list(listFn)).items ?? [];
    } else if (type === 'azure') {
      items = (await (await this.getApi()).encoding.inputs.azure.list(listFn)).items ?? [];
    } else {
      items = (await (await this.getApi()).encoding.inputs.list(listFn)).items ?? [];
    }

    await this.outputList(items as Record<string, unknown>[], ['id', 'name', 'type', 'createdAt']);
  }
}
