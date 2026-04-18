import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { surdejDomains } from './plugins/vite-plugin-surdej-domains';
import { surdejSkins } from './plugins/vite-plugin-surdej-skins';
import fs from 'fs';
import yaml from 'yaml';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, resolve(__dirname, '../../'), '');
    const PORT = env.FRONTEND_PORT ? parseInt(env.FRONTEND_PORT) : 4001;
    const API_URL = env.API_URL || 'http://localhost:5001';
    let version = 'unknown';
    try {
        const surdejYamlPath = resolve(__dirname, '../../surdej.yaml');
        const file = fs.readFileSync(surdejYamlPath, 'utf8');
        const config = yaml.parse(file);
        version = config.version || '0.1.0';
    }
    catch (e) {
        console.warn('Could not read version from surdej.yaml', e);
    }
    return {
        define: {
            __APP_VERSION__: JSON.stringify(version),
        },
        plugins: [
            react(),
            tailwindcss(),
            surdejDomains(),
            surdejSkins(),
        ],
        resolve: {
            alias: {
                '@': resolve(__dirname, './src'),
            },
        },
        server: {
            allowedHosts: true,
            port: PORT,
            proxy: {
                '/api': {
                    target: API_URL,
                    changeOrigin: true,
                },
            },
        },
    };
});
