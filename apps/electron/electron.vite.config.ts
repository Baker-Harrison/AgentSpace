import path from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@agentspaces/shared': path.resolve(__dirname, '../../packages/shared/src'),
        '@agentspaces/shared/ipc': path.resolve(__dirname, '../../packages/shared/src/ipc.ts')
      }
    },
    build: {
      lib: {
        entry: path.resolve(__dirname, 'src/main.ts')
      },
      outDir: 'dist/main'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@agentspaces/shared': path.resolve(__dirname, '../../packages/shared/src'),
        '@agentspaces/shared/ipc': path.resolve(__dirname, '../../packages/shared/src/ipc.ts')
      }
    },
    build: {
      lib: {
        entry: path.resolve(__dirname, 'src/preload.ts')
      },
      outDir: 'dist/preload'
    }
  },
  renderer: {
    root: path.resolve(__dirname, '../renderer'),
    server: {
      port: 5173,
      strictPort: true
    },
    build: {
      outDir: path.resolve(__dirname, 'dist/renderer'),
      rollupOptions: {
        input: path.resolve(__dirname, '../renderer/index.html')
      }
    },
    resolve: {
      alias: {
        '@agentspaces/shared': path.resolve(__dirname, '../../packages/shared/src'),
        '@agentspaces/shared/ipc': path.resolve(__dirname, '../../packages/shared/src/ipc.ts')
      }
    }
  }
});
