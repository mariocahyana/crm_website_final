/** Jest configuration for backend (TypeScript) */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  coverageDirectory: '<rootDir>/coverage',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/controllers/{attendance,leave,payroll,profile,reimbursement,userManagement}.controller.ts',
    'src/services/{attendance,leave,payroll,profile,reimbursement,userManagement}.service.ts',
    '!**/*.test.ts',
    '!**/node_modules/**',
  ],
  coverageReporters: ['text', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      functions: 100,
    },
  },
  // Map imports from 'vitest' to our compatibility shim so existing tests work
  moduleNameMapper: {
    '^vitest$': '<rootDir>/vitest-compat.js',
  },
  // Run tests serially to avoid shared-state issues in mocked DB
  maxConcurrency: 1,
};
