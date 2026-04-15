import {Args} from '@oclif/core';
import {BaseCommand} from '../../../lib/base-command.js';
import {deleteProfile} from '../../../lib/config.js';

export default class ConfigProfileDelete extends BaseCommand {
  static override description = 'Delete a configuration profile';

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  static override args = {
    name: Args.string({description: 'Profile name to delete', required: true}),
  };

  static override examples = [
    'bitmovin config profile delete staging',
  ];

  async run(): Promise<void> {
    const {args} = await this.parse(ConfigProfileDelete);
    try {
      deleteProfile(args.name);
      this.log(`Deleted profile: ${args.name}`);
    } catch (err) {
      this.error((err as Error).message);
    }
  }
}
