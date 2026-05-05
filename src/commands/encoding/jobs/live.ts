import {Args} from '@oclif/core';
import {LiveEncoding, StreamKey, SrtInput, InputType} from '@bitmovin/api-sdk';
import {BaseCommand} from '../../../lib/base-command.js';
import {ApiClient} from '../../../lib/client.js';

interface ApiError extends Error {
  httpStatusCode?: number;
  developerMessage?: string;
  errorCode?: string | number;
}

interface StreamKeyOutput {
  value?: string;
  ingestPointId?: string;
  status?: string;
}

interface SrtInputOutput {
  inputId: string;
  mode?: string;
  host?: string;
  port?: number;
  path?: string;
}

interface LiveOutput extends Record<string, unknown> {
  encoderIp: string;
  application: string;
  streamKeys: StreamKeyOutput[];
  srtInputs: SrtInputOutput[];
  available?: boolean;
  message?: string;
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

async function fetchLiveDetails(api: ApiClient, encodingId: string): Promise<{live: LiveEncoding | undefined; available: boolean; message?: string}> {
  try {
    const live = await api.encoding.encodings.live.get(encodingId);
    return {live, available: true};
  } catch (err) {
    if (!isLiveDetailsUnavailable(err)) throw err;
    return {
      live: undefined,
      available: false,
      message: 'Live encoding details are not available yet. The encoder may still be queued or spinning up.',
    };
  }
}

async function fetchAssignedStreamKeys(api: ApiClient, encodingId: string): Promise<StreamKey[]> {
  const response = await api.encoding.live.streamKeys.list({assignedEncodingId: encodingId});
  return response.items ?? [];
}

async function fetchSrtInputs(api: ApiClient, encodingId: string): Promise<SrtInputOutput[]> {
  const streams = await api.encoding.encodings.streams.list(encodingId);
  const inputIds = new Set<string>();
  for (const stream of streams.items ?? []) {
    for (const inputStream of stream.inputStreams ?? []) {
      if (inputStream.inputId) inputIds.add(inputStream.inputId);
    }
  }

  const results = await Promise.all(
    [...inputIds].map(async (inputId): Promise<SrtInputOutput | undefined> => {
      const typeResponse = await api.encoding.inputs.type.get(inputId);
      if (typeResponse.type !== InputType.SRT) return undefined;

      const srt: SrtInput = await api.encoding.inputs.srt.get(inputId);
      return {
        inputId,
        mode: srt.mode,
        host: srt.host,
        port: srt.port,
        path: srt.path,
      };
    }),
  );

  return results.filter((r): r is SrtInputOutput => r !== undefined);
}

export default class EncodingJobLive extends BaseCommand {
  static override description = 'Get live encoding connection details (encoder IP, stream keys, SRT inputs).';

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
    const api = await this.getApi();

    const [liveResult, streamKeys, srtInputs] = await Promise.all([
      fetchLiveDetails(api, args.id),
      fetchAssignedStreamKeys(api, args.id),
      fetchSrtInputs(api, args.id),
    ]);

    const {live, available, message} = liveResult;
    const jsonMode = await this.isJsonMode();

    if (!available && message) {
      this.log(message);
    }

    const mappedStreamKeys: StreamKeyOutput[] = streamKeys.map((key) => ({
      value: key.value,
      ingestPointId: key.assignedIngestPointId,
      status: key.status as string | undefined,
    }));

    if (mappedStreamKeys.length === 0 && live?.streamKey) {
      mappedStreamKeys.push({value: live.streamKey});
    }

    const output: LiveOutput = {
      encoderIp: live?.encoderIp ?? '(not yet running)',
      application: live?.application ?? '(unknown)',
      streamKeys: mappedStreamKeys,
      srtInputs,
      ...(jsonMode && {available}),
      ...(jsonMode && message && {message}),
    };

    await this.outputData(output);
  }
}
