import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {setActiveProfile} from '../../../lib/config.js';

export default class ConfigProfileUse extends BaseCommand {
  static override description = 'Switch the active configuration profile';

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  static override args = {
    name: Args.string({description: 'Profile name to activate', required: true}),
  };

  static override examples = [
    'bitmovin config profile use production',
    'bitmovin config profile use default',
  ];

  async run(): Promise<void> {
    const {args} = await this.parse(ConfigProfileUse);
    try {
      setActiveProfile(args.name);
      this.log(`Switched to profile: ${args.name}`);
      if (process.env.BITMOVIN_API_KEY) {
        this.warn(
          `BITMOVIN_API_KEY is set in your environment and will override the api-key from the '${args.name}' profile.`,
        );
      }
    } catch (err) {
      this.error((err as Error).message);
    }
  }
}
