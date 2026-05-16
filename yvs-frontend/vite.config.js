import {
    defineConfig
} from 'vite'
import react, {
    reactCompilerPreset
} from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        babel({
            presets: [reactCompilerPreset()]
        })
    ],

    // Proxy /api/* → backend during development.
    // This avoids CORS issues — the browser always talks to the same origin.
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    },
})