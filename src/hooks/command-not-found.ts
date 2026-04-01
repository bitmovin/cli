import {Hook} from '@oclif/core';
import chalk from 'chalk';

const hook: Hook<'command_not_found'> = async function ({id, config}) {
  // id is the full colon-separated command like "encoding:list"
  const parts = id.split(':');

  // Find the longest matching topic prefix
  let topicId = '';
  for (let i = parts.length - 1; i >= 1; i--) {
    const candidate = parts.slice(0, i).join(':');
    if (config.topics.some((t) => t.name === candidate)) {
      topicId = candidate;
      break;
    }
  }

  const attempted = parts.join(' ');
  process.stderr.write(chalk.red(`Unknown command: bitmovin ${attempted}`) + '\n\n');

  if (topicId) {
    const topicDisplay = topicId.replace(/:/g, ' ');
    // Find commands under this topic
    const commands = config.commands
      .filter((c) => c.id.startsWith(topicId + ':') && c.id.split(':').length === topicId.split(':').length + 1)
      .map((c) => c.id.replace(/:/g, ' '));

    // Find subtopics
    const subtopics = config.topics
      .filter((t) => t.name.startsWith(topicId + ':') && t.name.split(':').length === topicId.split(':').length + 1)
      .map((t) => t.name.replace(/:/g, ' '));

    const all = [...new Set([...subtopics, ...commands])].sort();

    if (all.length > 0) {
      process.stderr.write(`Available under ${chalk.bold('bitmovin ' + topicDisplay)}:\n\n`);
      for (const item of all) {
        process.stderr.write(`  bitmovin ${item}\n`);
      }

      process.stderr.write('\n');
    }
  } else {
    // Show top-level topics
    const topLevel = config.topics
      .filter((t) => !t.name.includes(':'))
      .map((t) => t.name);

    if (topLevel.length > 0) {
      process.stderr.write(`Available commands:\n\n`);
      for (const topic of topLevel.sort()) {
        process.stderr.write(`  bitmovin ${topic}\n`);
      }

      process.stderr.write('\n');
    }
  }

  process.stderr.write(chalk.dim('Run bitmovin --help for full usage.') + '\n');
  process.exit(1);
};

export default hook;
