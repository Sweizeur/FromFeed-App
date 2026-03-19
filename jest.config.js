/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  globals: {
    __DEV__: true,
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'utils/**/*.ts',
    'lib/**/*.ts',
    'features/**/hooks/*.ts',
    '!**/__tests__/**',
    '!**/*.d.ts',
  ],
};
