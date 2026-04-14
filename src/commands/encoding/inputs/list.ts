import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingInputList extends BaseCommand {
  static override description = 'List encoding inputs';

  static override flags = {
    ...BaseCommand.baseFlags,
    type: Flags.string({description: 'Filter by type (s3, gcs, http, https, azure)'}),
    limit: Flags.integer({description: 'Max results', default: 25}),
    offset: Flags.integer({description: 'Offset for pagination', default: 0}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingInputList);
    const listParams = {limit: flags.limit, offset: flags.offset};

    let items: unknown[];
    const type = flags.type?.toLowerCase();

    if (type === 's3') {
      items = (await (await this.getApi()).encoding.inputs.s3.list(listParams)).items ?? [];
    } else if (type === 'gcs') {
      items = (await (await this.getApi()).encoding.inputs.gcs.list(listParams)).items ?? [];
    } else if (type === 'http') {
      items = (await (await this.getApi()).encoding.inputs.http.list(listParams)).items ?? [];
    } else if (type === 'https') {
      items = (await (await this.getApi()).encoding.inputs.https.list(listParams)).items ?? [];
    } else if (type === 'azure') {
      items = (await (await this.getApi()).encoding.inputs.azure.list(listParams)).items ?? [];
    } else {
      items = (await (await this.getApi()).encoding.inputs.list(listParams)).items ?? [];
    }

    await this.outputList(items as Record<string, unknown>[], ['id', 'name', 'type', 'createdAt']);
  }
}
