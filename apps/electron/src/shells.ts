import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { ShellOption } from '@agentspaces/shared';

function fileExists(candidate: string): boolean {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
}

export function getShellOptions(): ShellOption[] {
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
    const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const pwsh = path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe');
    const cmd = path.join(systemRoot, 'System32', 'cmd.exe');

    return [
      { key: 'powershell', label: 'PowerShell', path: fileExists(powershell) ? powershell : 'powershell.exe' },
      { key: 'pwsh', label: 'PowerShell 7', path: fileExists(pwsh) ? pwsh : 'pwsh.exe' },
      { key: 'cmd', label: 'Command Prompt', path: fileExists(cmd) ? cmd : 'cmd.exe' }
    ];
  }

  const loginShell = process.env.SHELL || os.userInfo().shell || '/bin/bash';
  const shells = [loginShell, '/bin/zsh', '/bin/bash', '/usr/bin/fish'];

  return Array.from(new Set(shells.filter(Boolean))).map((shellPath) => ({
    key: path.basename(shellPath).replace(/\.[^.]+$/, ''),
    label: path.basename(shellPath),
    path: shellPath
  }));
}

export function resolveShell(shellKey?: string): ShellOption {
  const options = getShellOptions();
  return options.find((option) => option.key === shellKey) ?? options[0];
}
