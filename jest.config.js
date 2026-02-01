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
        '!**/__tests__/component/**'  // Temporarily skip due to jsdom ESM issues
    ],
    moduleFileExtensions: ['js', 'ts', 'json'],
    testTimeout: 10000,
    verbose: true,
    // Use ts-jest for TypeScript, babel-jest for JavaScript
    transform: {
        '^.+\.ts$': 'ts-jest',
        '^.+\\.js$': 'babel-jest'
    },
    // Transform ES modules in node_modules
    transformIgnorePatterns: [
        'node_modules/(?!(@exodus|html-encoding-sniffer|jsdom)/)'
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
        // Temporarily disabled jsdom tests due to ESM dependency issues
        // Will re-enable after TypeScript migration with proper ESM support
    ]
};
