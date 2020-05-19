module.exports = {
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  coveragePathIgnorePatterns: ['/migration'],
  reporters: ['default'],
  preset: 'ts-jest',
  modulePaths: ['src'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
}
