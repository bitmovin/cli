import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingJobList extends BaseCommand {
  static override description = 'List encodings';

  static override flags = {
    ...BaseCommand.baseFlags,
    limit: Flags.integer({description: 'Max results', default: 25}),
    offset: Flags.integer({description: 'Offset for pagination', default: 0}),
    status: Flags.string({description: 'Filter by status (CREATED, QUEUED, RUNNING, FINISHED, ERROR)'}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingJobList);
    const result = await (await this.getApi()).encoding.encodings.list({
      limit: flags.limit,
      offset: flags.offset,
      ...(flags.status && {status: flags.status}),
    });

    const items = (result.items ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      cloudRegion: e.cloudRegion,
      status: String(e.status ?? ''),
      createdAt: e.createdAt,
    }));

    await this.outputList(items as Record<string, unknown>[], ['id', 'name', 'cloudRegion', 'status', 'createdAt']);
  }
}
