module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'lib/**/*.{js,ts}',
        'renderer/modules/**/*.{js,ts}',
        '!**/*.test.{js,ts}',
        '!**/node_modules/**',
        '!**/dist/**'
    ],
    testMatch: [
        '**/__tests__/**/*.test.{js,ts}',
        '!**/__tests__/e2e/**',
        '!**/__tests__/component/**'  // Skipped - blocked by jsdom ESM dependency (@exodus/bytes) issue
    ],
    moduleFileExtensions: ['js', 'ts', 'json'],
    testTimeout: 10000,
    verbose: true,
    // Mock problematic ESM modules
    moduleNameMapper: {
        '^@exodus/bytes$': '<rootDir>/__mocks__/@exodus/bytes.js'
    },
    // Use ts-jest for TypeScript, babel-jest for JavaScript
    transform: {
        '^.+\.ts$': 'ts-jest',
        '^.+\\.js$': 'babel-jest'
    },
    // Transform ES modules in node_modules
    transformIgnorePatterns: [
        'node_modules/(?!(@exodus|html-encoding-sniffer|jsdom|whatwg-encoding)/)'
    ],
    // Clear mocks between tests
    clearMocks: true,
    // Reset modules between tests
    resetModules: true,
    // Projects for different test environments
    projects: [
        {
            displayName: 'node',
            testEnvironment: 'node',
            testMatch: [
                '**/__tests__/lib/**/*.test.js',
                '**/__tests__/integration/**/*.test.js',
                '**/__tests__/renderer/**/*.test.js'
            ]
        }
        // Component tests temporarily disabled due to jsdom ESM dependency issues
        // The @exodus/bytes module used by html-encoding-sniffer (jsdom dependency)
        // uses ESM exports which Jest cannot transform in the current setup
    ]
};
