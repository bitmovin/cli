import {Flags} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

export default class EncodingTemplateList extends BaseCommand {
  static override description = 'List stored encoding templates';

  static override flags = {
    ...BaseCommand.baseFlags,
    type: Flags.string({description: 'Filter by type', options: ['VOD', 'LIVE']}),
    limit: Flags.integer({description: 'Max results', default: 25}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(EncodingTemplateList);
    const result = await (await this.getApi()).encoding.templates.list((q: any) => {
      q.limit(flags.limit);
      if (flags.type) q.type(flags.type);
      return q;
    });

    const items = (result.items ?? []) as Record<string, unknown>[];
    await this.outputList(items, ['id', 'name', 'type', 'createdAt']);
  }
}
