import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';

interface LiveDetails {
  encoderIp?: string;
  streamKey?: string;
  application?: string;
  available?: boolean;
  message?: string;
  [key: string]: unknown;
}

interface ApiError extends Error {
  httpStatusCode?: number;
  developerMessage?: string;
}

function isLiveDetailsUnavailable(err: unknown): err is ApiError {
  if (!(err instanceof Error)) return false;

  const apiError = err as ApiError;
  const message = apiError.developerMessage ?? apiError.message;
  return apiError.httpStatusCode === 400 && /Details for live encoding with id '.+' are not available at the moment\./.test(message);
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
    let live: LiveDetails;

    try {
      live = (await (await this.getApi()).encoding.encodings.live.get(args.id)) as LiveDetails;
    } catch (err) {
      if (!isLiveDetailsUnavailable(err)) throw err;

      live = {
        available: false,
        message: 'Live encoding details are not available yet. The encoder may still be queued or spinning up.',
      };
    }

    if (await this.isJsonMode()) {
      await this.outputData(live);
      return;
    }

    const out = process.stdout;
    if (live.available === false && live.message) {
      out.write(`${live.message}\n`);
    }
    out.write(`Encoder IP:   ${live.encoderIp ?? '(not yet running)'}\n`);
    out.write(`Stream Key:   ${live.streamKey ?? '(unknown)'}\n`);
    out.write(`Application:  ${live.application ?? '(unknown)'}\n`);
  }
}
