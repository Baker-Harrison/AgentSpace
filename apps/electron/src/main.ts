import path from 'node:path';
import fs from 'node:fs';
import { app, BrowserWindow, Menu, ipcMain, type MenuItemConstructorOptions } from 'electron';
import {
  ipcChannels,
  type PaneCwdInput,
  type PaneRenameInput,
  type PaneShellInput,
  type PaneStageAssetInput,
  type WorkspaceCreateInput,
  type WorkspaceLayoutInput
} from '@agentspaces/shared';
import { getRendererEntry } from './env';
import { PersistenceService } from './persistence';
import { WorkspaceManager } from './workspace-manager';

let mainWindow: BrowserWindow | null = null;
let workspaceManager: WorkspaceManager | null = null;

function resolveLaunchFolder(): string | undefined {
  const launchFlagIndex = process.argv.findIndex((argument) => argument === '--launch-folder');
  if (launchFlagIndex >= 0) {
    const candidate = process.argv[launchFlagIndex + 1];
    if (candidate && isDirectory(candidate)) {
      return candidate;
    }
  }

  const passthroughIndex = process.argv.findIndex((argument) => argument === '--');
  if (passthroughIndex >= 0) {
    const candidate = process.argv[passthroughIndex + 1];
    if (candidate && isDirectory(candidate)) {
      return candidate;
    }
  }

  if (!app.isPackaged) {
    return undefined;
  }

  return process.argv.find((argument, index) => index > 0 && isDirectory(argument));
}

function isDirectory(candidate: string): boolean {
  if (!candidate || candidate.startsWith('-') || candidate.endsWith('.js') || candidate.toLowerCase().includes('electron')) {
    return false;
  }

  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 720,
    backgroundColor: '#101115',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  const launchFolder = resolveLaunchFolder();
  workspaceManager = new WorkspaceManager(mainWindow, new PersistenceService(), launchFolder);
  registerIpc(workspaceManager);
  buildMenu();

  await mainWindow.loadURL(getRendererEntry());
}

function registerIpc(manager: WorkspaceManager): void {
  ipcMain.handle(ipcChannels.bootstrap, () => manager.bootstrap());
  ipcMain.handle(ipcChannels.workspaceOpenFolder, () => manager.openFolder());
  ipcMain.handle(ipcChannels.workspaceCreate, (_event, input: WorkspaceCreateInput) => manager.createWorkspace(input));
  ipcMain.handle(ipcChannels.workspaceActivate, (_event, workspaceId: string) => manager.activateWorkspace(workspaceId));
  ipcMain.handle(ipcChannels.workspaceClose, (_event, workspaceId: string) => manager.closeWorkspace(workspaceId));
  ipcMain.handle(ipcChannels.workspaceSetLayout, (_event, input: WorkspaceLayoutInput) => manager.setWorkspaceLayout(input));
  ipcMain.handle(ipcChannels.paneActivate, (_event, paneId: string) => manager.activatePane(paneId));
  ipcMain.handle(ipcChannels.paneRename, (_event, input: PaneRenameInput) => manager.renamePane(input));
  ipcMain.handle(ipcChannels.paneSetShell, (_event, input: PaneShellInput) => manager.setPaneShell(input));
  ipcMain.handle(ipcChannels.paneSetCwd, (_event, input: PaneCwdInput) => manager.setPaneCwd(input));
  ipcMain.handle(ipcChannels.paneStageAsset, (_event, input: PaneStageAssetInput) => manager.stagePaneAsset(input));
  ipcMain.handle(ipcChannels.paneClose, (_event, paneId: string) => manager.closePane(paneId));
  ipcMain.handle(ipcChannels.paneToggleMaximize, (_event, paneId: string) => manager.togglePaneMaximize(paneId));
  ipcMain.handle(ipcChannels.ptyRestart, (_event, paneId: string) => manager.restartPane(paneId));
  ipcMain.on(ipcChannels.ptyInput, (_event, paneId: string, data: string) => manager.handlePtyInput(paneId, data));
  ipcMain.on(ipcChannels.ptyResize, (_event, paneId: string, columns: number, rows: number) => manager.handlePtyResize(paneId, columns, rows));
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const folderPath = await workspaceManager?.openFolder();
            if (folderPath) {
              workspaceManager?.createWorkspace({ projectRootPath: folderPath, layoutId: 'layout_2x2' });
            }
          }
        },
        { role: 'quit' as const }
      ]
    },
    {
      label: 'View',
      submenu: [{ role: 'reload' as const }, { role: 'toggleDevTools' as const }]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  await createMainWindow();
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
