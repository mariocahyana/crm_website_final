# Frontend Portal Architecture Documentation

## Overview
The frontend portal has been restructured from a monolithic `PortalPage.tsx` to a modular, page-based architecture with improved code organization.

## Directory Structure

### `/src/pages/Portal/`
Individual page files for each feature:
- **Dashboard.tsx** - Overview/dashboard page showing summary cards
- **Profile.tsx** - User profile edit page with photo upload
- **UserManagement.tsx** - Admin user management page (CRUD operations)
- **LeaveManagement.tsx** - Leave request management
- **Reimburse.tsx** - Reimbursement request management
- **Attendance.tsx** - Attendance tracking (QR generation, scanning, history)
- **Payroll.tsx** - Payroll management and employee payslip viewing
- **EditUser.tsx** - Individual user edit modal/page
- **ViewUser.tsx** - Individual user view page
- **AssignManager.tsx** - Assign managers to staff
- **UserTree.tsx** - Organization hierarchy view
- **AddSalary.tsx** - Add salary components
- **PayrollAdjustment.tsx** - Payroll adjustment
- **NotFound.tsx** - 404 error page
- **index.ts** - Re-exports all page components

### `/src/components/Portal/`
Portal-specific components:
- **PortalHeader.tsx** - Reusable header with employee info and logout
- **PortalNav.tsx** - Navigation tabs/menu for portal
- **PortalLayout.tsx** - Main layout wrapper combining Header + Nav + content
- **PortalPagesContainer.tsx** - Orchestrator component that routes to individual pages
- **OverviewSection.tsx** - Dashboard summary card component
- **UserManagementSection.tsx** - Complete user management CRUD component
- **index.ts** - Re-exports all portal components

### `/src/components/Modals/`
Modal components:
- **LoginModal.tsx** - Login modal (placeholder)
- **ForgotPasswordModal.tsx** - Forgot password modal (placeholder)
- **index.ts** - Re-exports modal components

## Data Flow Architecture

```
App.tsx
  ├─ /admin route
  │   └─ PortalPagesContainer
  │       ├─ PortalLayout
  │       │   ├─ PortalHeader
  │       │   └─ PortalNav
  │       └─ Page components (render based on activeMenu)
  │           ├─ DashboardPage
  │           ├─ ProfilePage
  │           ├─ UserManagementPage
  │           ├─ LeaveManagementPage
  │           ├─ ReimburseManagementPage
  │           ├─ AttendancePage
  │           └─ PayrollPage
  └─ /staff route
      └─ Same structure as /admin
```

## Component Props Flow

### PortalPagesContainer
**Receives:**
- `currentUser: SessionUser`
- `onLogout: () => void`
- `onEmployeeUpdate: (employee) => void`

**Provides to PortalLayout:**
- `currentUser`
- `onLogout`
- `activeMenu`
- `onMenuChange`

### PortalLayout
**Purpose:** Container with Header + Nav + content outlet

**Props:**
- `currentUser: SessionUser`
- `onLogout: () => void`
- `activeMenu: PortalMenu`
- `onMenuChange: (menu: PortalMenu) => void`
- `children: React.ReactNode` - Page component content

### Individual Pages
Each page receives specific props:
- **DashboardPage:** `{ currentUser }`
- **ProfilePage:** `{ currentUser, onEmployeeUpdate, token }`
- **UserManagementPage:** `{ token }`
- **LeaveManagementPage:** `{ token }`
- **ReimburseManagementPage:** `{ token }`
- **AttendancePage:** `{ currentUser, activeTab, token }`
- **PayrollPage:** `{ currentUser, activeTab, token }`

## State Management Strategy

### Page-Level State
Each page component manages its own state:
- Form data
- Loading/error states
- Lists of items

### Session-Level State (App.tsx)
- `currentUser` - Current user's session data
- `isBootstrapping` - Initial load state
- `isLoginLoading` - Login process state

### Navigation State
- `activeMenu` - Current active menu in PortalPagesContainer
- Routes to pages based on activeMenu selection

## Key Improvements

1. **Modularity** - Each feature has its own page file
2. **Reusability** - Extracted common components (Header, Nav, Layout)
3. **Scalability** - Easy to add new pages/features
4. **Code Organization** - Reduced from 2600+ line PortalPage to focused components
5. **Maintainability** - Clear separation of concerns
6. **Type Safety** - Proper TypeScript interfaces for all props

## Migration Notes

### Old Architecture
- Single `PortalPage.tsx` with all logic (~2600 lines)
- All state in one component
- Tab-based switching with conditional rendering

### New Architecture
- Individual page files per feature
- Orchestrator pattern with PortalPagesContainer
- Layout composition pattern
- Cleaner prop passing

## Future Enhancements

1. Implement React Router for URL-based navigation (e.g., `/portal/users`, `/portal/leave`)
2. Add lazy loading for pages using React.lazy()
3. Implement global state management (Redux/Zustand) if needed
4. Add error boundaries for better error handling
5. Implement page-level data loading skeletons
6. Add breadcrumb navigation for better UX

## File Size Reduction

- **Before:** PortalPage.tsx (~2600 lines)
- **After:** 
  - Distributed across 15+ focused page files
  - Average page file: 50-300 lines
  - Components properly extracted and reusable

## API Integration

Pages communicate with backend through service files:
- `/src/services/users.ts` - User management API
- `/src/services/leaves.ts` - Leave management API
- `/src/services/profile.ts` - Profile API
- `/src/services/attendance.ts` - Attendance API
- `/src/services/payroll.ts` - Payroll API
- `/src/services/reimbursements.ts` - Reimbursement API

Token authentication is passed through props and used in API calls.
