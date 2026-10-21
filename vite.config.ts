import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';
import path from 'path';

export default defineConfig({
    plugins: [vue(), svgLoader()],
    publicDir: 'public',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    server: {
        port: 5173,
        strictPort: false,
        proxy: {
            // 开发环境代理百度 sugrec 搜索建议接口，规避浏览器 CORS 限制
            '/sugrec': {
                target: 'https://www.baidu.com',
                changeOrigin: true
            }
        }
    },
    build: {
        // 输出目录按目标区分：dist-chrome / dist-edge / dist-firefox
        // 未显式指定时默认产出 Chrome 包
        outDir: process.env.BUILD_OUT_DIR || 'dist-chrome',
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                popup: path.resolve(__dirname, 'view/popup.html'),
                'background-firefox': path.resolve(__dirname, 'src/background.ts')
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === 'background-firefox') {
                        return 'js/background-firefox.js';
                    }
                    return 'js/[name]-[hash].js';
                },
                chunkFileNames: 'js/[name]-[hash].js',
                assetFileNames: 'js/[name]-[hash][extname]'
            }
        }
    }
});
