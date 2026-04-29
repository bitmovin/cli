import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

interface LiveDetails {
  encoderIp?: string;
  streamKey?: string;
  application?: string;
  [key: string]: unknown;
}

export default class EncodingJobLive extends BaseCommand {
  static override description = 'Get live encoding details (encoder IP, stream key, application).';

  static override args = {
    id: Args.string({description: 'Encoding ID', required: true}),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  static override examples = [
    'bitmovin encoding jobs live abc123',
    'bitmovin encoding jobs live abc123 --json',
  ];

  async run(): Promise<void> {
    const {args} = await this.parse(EncodingJobLive);
    const live = (await (await this.getApi()).encoding.encodings.live.get(args.id)) as LiveDetails;

    if (await this.isJsonMode()) {
      await this.outputData(live);
      return;
    }

    const out = process.stdout;
    out.write(`Encoder IP:   ${live.encoderIp ?? '(not yet running)'}\n`);
    out.write(`Stream Key:   ${live.streamKey ?? '(unknown)'}\n`);
    out.write(`Application:  ${live.application ?? '(unknown)'}\n`);
  }
}
