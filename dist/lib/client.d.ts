type AccountApi = import('@bitmovin/api-sdk/dist/account/AccountApi.js').default;
type AnalyticsApi = import('@bitmovin/api-sdk/dist/analytics/AnalyticsApi.js').default;
type EncodingApi = import('@bitmovin/api-sdk/dist/encoding/EncodingApi.js').default;
type GeneralApi = import('@bitmovin/api-sdk/dist/general/GeneralApi.js').default;
type NotificationsApi = import('@bitmovin/api-sdk/dist/notifications/NotificationsApi.js').default;
type PlayerApi = import('@bitmovin/api-sdk/dist/player/PlayerApi.js').default;
type StreamsApi = import('@bitmovin/api-sdk/dist/streams/StreamsApi.js').default;
export interface ApiClient {
    account: AccountApi;
    analytics: AnalyticsApi;
    encoding: EncodingApi;
    general: GeneralApi;
    notifications: NotificationsApi;
    player: PlayerApi;
    streams: StreamsApi;
}
export declare function getClient(apiKeyOverride?: string): ApiClient;
export {};
//# sourceMappingURL=client.d.ts.map