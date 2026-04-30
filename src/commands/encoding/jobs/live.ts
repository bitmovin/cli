import {Args} from '@oclif/core';
import {LiveEncoding} from '@bitmovin/api-sdk';
import {BaseCommand} from '../../../lib/base-command.js';

type LiveDetails = LiveEncoding & {
  available?: boolean;
  message?: string;
};

type LiveDetailsOutput = LiveDetails & Record<string, unknown>;

interface ApiError extends Error {
  httpStatusCode?: number;
  developerMessage?: string;
  errorCode?: string | number;
}

function normalizeErrorText(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[_-]+/g, ' ');
}

function mentionsUnavailableLiveDetails(value: string): boolean {
  const mentionsUnavailable = /\b(?:unavailable|not\s+(?:yet\s+)?available)\b/.test(value);
  const mentionsLiveDetails = value.includes('live encoding') || value.includes('live details') || (value.includes('live') && value.includes('details'));
  return mentionsUnavailable && mentionsLiveDetails;
}

function isLiveDetailsUnavailable(err: unknown): err is ApiError {
  if (!(err instanceof Error)) return false;

  const apiError = err as ApiError;
  if (apiError.httpStatusCode !== 400) return false;

  return mentionsUnavailableLiveDetails(normalizeErrorText(apiError.errorCode)) || mentionsUnavailableLiveDetails(normalizeErrorText(apiError.developerMessage ?? apiError.message));
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
      const api = await this.getApi();
      live = await api.encoding.encodings.live.get(args.id);
    } catch (err) {
      if (!isLiveDetailsUnavailable(err)) throw err;

      live = {
        available: false,
        message: 'Live encoding details are not available yet. The encoder may still be queued or spinning up.',
      };
    }

    const jsonMode = await this.isJsonMode();
    if (live.available === false && live.message) {
      this.log(live.message);
    }

    const output: LiveDetailsOutput = {
      encoderIp: live.encoderIp ?? '(not yet running)',
      streamKey: live.streamKey ?? '(unknown)',
      application: live.application ?? '(unknown)',
      ...(jsonMode && live.available !== undefined && {available: live.available}),
      ...(jsonMode && live.message && {message: live.message}),
    };

    await this.outputData(output);
  }
}
