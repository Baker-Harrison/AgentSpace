import { createId } from './id';
import type { CommandBlock } from './types';

const OSC_SEQUENCE = /\u001b]133;([A-D])(.*?)(?:\u0007|\u001b\\)/g;

export type CommandEvent =
  | { type: 'start'; command: string; source: 'osc' | 'heuristic' }
  | { type: 'end'; exitCode: number | null; source: 'osc' | 'heuristic' }
  | { type: 'output'; chunk: string };

export class CommandBlockParser {
  private pendingCommand = '';

  parse(chunk: string): CommandEvent[] {
    const events: CommandEvent[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = OSC_SEQUENCE.exec(chunk)) !== null) {
      const before = chunk.slice(lastIndex, match.index);
      if (before) {
        events.push({ type: 'output', chunk: before });
      }

      lastIndex = match.index + match[0].length;
      if (match[1] === 'A') {
        events.push({
          type: 'start',
          command: match[2].replace(/^;?/, '').trim(),
          source: 'osc'
        });
      }

      if (match[1] === 'D') {
        const exitCodeMatch = match[2].match(/;(\d+)/);
        events.push({
          type: 'end',
          exitCode: exitCodeMatch ? Number(exitCodeMatch[1]) : null,
          source: 'osc'
        });
      }
    }

    const remainder = chunk.slice(lastIndex);
    if (remainder) {
      events.push({ type: 'output', chunk: remainder });
    }

    return events;
  }

  noteInput(data: string): CommandEvent[] {
    this.pendingCommand += data;
    if (!data.includes('\r')) {
      return [];
    }

    const [command] = this.pendingCommand.split('\r');
    this.pendingCommand = '';
    const trimmed = command.trim();
    if (!trimmed) {
      return [];
    }

    return [{ type: 'start', command: trimmed, source: 'heuristic' }];
  }

  notePrompt(): CommandEvent[] {
    return [{ type: 'end', exitCode: null, source: 'heuristic' }];
  }
}

export function createCommandBlock(paneId: string, command: string, source: 'osc' | 'heuristic'): CommandBlock {
  return {
    id: createId('cb'),
    paneId,
    command,
    exitCode: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    output: '',
    collapsed: false,
    status: 'running',
    source,
    prompt: null
  };
}
