import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/controllers/{attendance,leave,payroll,profile,reimbursement,userManagement}.controller.ts',
        'src/services/{attendance,leave,payroll,profile,reimbursement,userManagement}.service.ts',
      ],
      exclude: ['**/*.test.ts', '**/node_modules/**'],
      functions: 100,
      lines: 0,
      statements: 0,
      branches: 0,
    },
  },
});