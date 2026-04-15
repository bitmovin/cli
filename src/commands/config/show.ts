import {Flags} from '@oclif/core';
import {BaseCommand} from '../../lib/base-command.js';
import {loadConfig, getProfile, getConfigPath} from '../../lib/config.js';

export default class ConfigShow extends BaseCommand {
  static override description = 'Show current configuration';

  static override flags = {
    ...BaseCommand.baseFlags,
    profile: Flags.string({description: 'Profile to show (default: active profile)'}),
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(ConfigShow);
    const full = loadConfig();
    const profileName = flags.profile ?? full.activeProfile;
    const config = getProfile(full, profileName);

    if (await this.isJsonMode()) {
      const masked = config.apiKey
        ? config.apiKey.slice(0, 8) + '...' + config.apiKey.slice(-4)
        : undefined;
      await this.outputData({
        configFile: getConfigPath(),
        activeProfile: full.activeProfile,
        profile: profileName,
        apiKey: masked ?? '(not set)',
        tenantOrgId: config.tenantOrgId ?? '(not set)',
        defaultRegion: config.defaultRegion ?? '(not set)',
      });
      return;
    }

    this.log(`Config file: ${getConfigPath()}\n`);
    this.log(`Profile:        ${profileName}${profileName === full.activeProfile ? ' (active)' : ''}`);

    if (config.apiKey) {
      const masked = config.apiKey.slice(0, 8) + '...' + config.apiKey.slice(-4);
      this.log(`API Key:        ${masked}`);
    } else {
      this.log('API Key:        (not set)');
    }

    this.log(`Tenant Org ID:  ${config.tenantOrgId ?? '(not set)'}`);
    this.log(`Default Region: ${config.defaultRegion ?? '(not set)'}`);
  }
}
