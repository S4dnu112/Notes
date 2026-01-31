module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'lib/**/*.js',
        'renderer/modules/**/*.js',
        '!**/*.test.js',
        '!**/node_modules/**'
    ],
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    moduleFileExtensions: ['js', 'json'],
    testTimeout: 10000,
    verbose: true
};
