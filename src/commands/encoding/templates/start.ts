import {Args, Flags} from '@oclif/core';
import {readFileSync} from 'node:fs';
import {BaseCommand} from '../../../lib/base-command.js';
import {waitForEncoding} from '../../../lib/wait.js';

export default class EncodingTemplateStart extends BaseCommand {
  static override description = 'Start an encoding from a YAML template file or a stored template ID';

  static override args = {
    file: Args.string({description: 'Path to YAML template file'}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
    id: Flags.string({description: 'Stored template ID (instead of a file)'}),
    watch: Flags.boolean({char: 'w', description: 'Wait for encoding to finish'}),
  };

  static override examples = [
    'bitmovin encoding template start ./my-encoding.yaml --watch',
    'bitmovin encoding template start --id abc123 --watch',
  ];

  async run(): Promise<void> {
    const {args, flags} = await this.parse(EncodingTemplateStart);

    if (!args.file && !flags.id) {
      this.error('Provide a template file path or --id <template-id>');
    }

    let result: {encodingId?: string};

    if (flags.id) {
      result = await (await this.getApi()).encoding.templates.start({id: flags.id} as never);
    } else {
      const content = readFileSync(args.file!, 'utf-8');
      result = await (await this.getApi()).encoding.templates.start(content as never);
    }

    const encodingId = result.encodingId;
    this.log(`Encoding started: ${encodingId}`);

    if (flags.watch && encodingId) {
      const task = await waitForEncoding(await this.getApi(), encodingId);
      await this.outputData(task);
    }
  }
}
