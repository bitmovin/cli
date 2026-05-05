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

type LiveDetails = LiveEncoding & {
  streamKeys: StreamKeyOutput[];
  srtInputs: SrtInputOutput[];
  available?: boolean;
  message?: string;
};

type LiveDetailsOutput = Omit<LiveDetails, 'encoderIp' | 'application'> & {
  encoderIp: string | null;
  application: string | null;
} & Record<string, unknown>;

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

type FetchResult<T> = {value: T; error?: Error};

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function describeApiError(err: Error): string {
  const apiError = err as ApiError;
  const detail = apiError.developerMessage ?? err.message;
  return apiError.httpStatusCode ? `${apiError.httpStatusCode} ${detail}` : detail;
}

async function fetchAssignedStreamKeys(api: ApiClient, encodingId: string): Promise<FetchResult<StreamKey[]>> {
  try {
    const response = await api.encoding.live.streamKeys.list({assignedEncodingId: encodingId});
    return {value: response.items ?? []};
  } catch (err) {
    return {value: [], error: asError(err)};
  }
}

async function fetchSrtInputs(api: ApiClient, encodingId: string): Promise<FetchResult<SrtInputOutput[]>> {
  try {
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

    return {value: results.filter((r): r is SrtInputOutput => r !== undefined)};
  } catch (err) {
    return {value: [], error: asError(err)};
  }
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

    const [liveResult, streamKeysResult, srtInputsResult] = await Promise.all([
      fetchLiveDetails(api, args.id),
      fetchAssignedStreamKeys(api, args.id),
      fetchSrtInputs(api, args.id),
    ]);

    if (streamKeysResult.error) {
      this.warn(`Could not fetch stream keys (${describeApiError(streamKeysResult.error)}); continuing without them.`);
    }
    if (srtInputsResult.error) {
      this.warn(`Could not fetch SRT input details (${describeApiError(srtInputsResult.error)}); continuing without them.`);
    }

    const {live, available, message} = liveResult;
    const jsonMode = await this.isJsonMode();

    if (!available && message) {
      this.log(message);
    }

    const mappedStreamKeys: StreamKeyOutput[] = streamKeysResult.value.map((key) => ({
      value: key.value,
      ingestPointId: key.assignedIngestPointId,
      status: key.status as string | undefined,
    }));

    if (mappedStreamKeys.length === 0 && live?.streamKey) {
      mappedStreamKeys.push({value: live.streamKey});
    }

    const output: LiveDetailsOutput = jsonMode
      ? {
          encoderIp: live?.encoderIp ?? null,
          application: live?.application ?? null,
          streamKeys: mappedStreamKeys,
          srtInputs: srtInputsResult.value,
          available,
          ...(message && {message}),
        }
      : {
          encoderIp: live?.encoderIp ?? '(not yet running)',
          application: live?.application ?? '(unknown)',
          streamKeys: mappedStreamKeys,
          srtInputs: srtInputsResult.value,
        };

    await this.outputData(output);
  }
}
