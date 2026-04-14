import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingOutputList extends BaseCommand {
  static override description = 'List encoding outputs';

  static override flags = {
    ...BaseCommand.baseFlags,
    type: Flags.string({description: 'Filter by type (s3, gcs, azure)'}),
    limit: Flags.integer({description: 'Max results', default: 25}),
    offset: Flags.integer({description: 'Offset for pagination', default: 0}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingOutputList);
    const listParams = {limit: flags.limit, offset: flags.offset};

    let items: unknown[];
    const type = flags.type?.toLowerCase();

    if (type === 's3') {
      items = (await (await this.getApi()).encoding.outputs.s3.list(listParams)).items ?? [];
    } else if (type === 'gcs') {
      items = (await (await this.getApi()).encoding.outputs.gcs.list(listParams)).items ?? [];
    } else if (type === 'azure') {
      items = (await (await this.getApi()).encoding.outputs.azure.list(listParams)).items ?? [];
    } else {
      items = (await (await this.getApi()).encoding.outputs.list(listParams)).items ?? [];
    }

    await this.outputList(items as Record<string, unknown>[], ['id', 'name', 'type', 'createdAt']);
  }
}
