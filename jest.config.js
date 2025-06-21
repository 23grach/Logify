module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/*.test.ts'
  ],
  collectCoverageFrom: [
    'code.ts',
    '!node_modules/**',
    '!tests/**',
    '!dist/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ]
}; 