declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        role: 'admin' | 'staff';
        employeeId?: string;
      };
    }
  }
}

export {};
