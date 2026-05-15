import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom', // Зависимость для работы с DOM (возможны разные варианты (jsdom))
        setupFiles: ['./tests/setup.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'tests/',
                'resources/lib/',
                '**/*.config.js'
            ]
        },
        include: ['tests/**/*.test.js']
    }
});