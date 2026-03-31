export const authFixtures = {
  superAdmin: {
    isAuthenticated: true,
    isSuperAdmin: true,
    role: 'SUPER_ADMIN',
    user: { id: 'user-super-admin' },
  },
  reviewer: {
    isAuthenticated: true,
    isSuperAdmin: false,
    role: 'REVIEWER',
    user: { id: 'user-reviewer' },
  },
  normalUser: {
    isAuthenticated: true,
    isSuperAdmin: false,
    role: 'USER',
    user: { id: 'user-normal' },
  },
}

export const contextFixtures = {
  dashboard: {
    auth: authFixtures.superAdmin,
    route: { path: '/admin' },
    target: 'admin-dashboard',
  },
  submissions: {
    auth: authFixtures.superAdmin,
    route: { path: '/admin/submissions' },
    target: 'admin-submissions',
    rows: [
      { id: 'sub-1', title: '投稿 1', status: 'PENDING' },
      { id: 'sub-2', title: '投稿 2', status: 'PENDING' },
    ],
    selectedItems: [
      { id: 'sub-1', title: '投稿 1', status: 'PENDING' },
      { id: 'sub-2', title: '投稿 2', status: 'PENDING' },
    ],
  },
  callsign: {
    auth: authFixtures.superAdmin,
    route: { path: '/admin/callsign' },
    target: 'admin-callsign',
    rows: [
      { id: 'app-1', callsign: 'BH1AAA', profiles: { uid: 1001 } },
      { id: 'app-2', callsign: 'BH1BBB', profiles: { uid: 1002 } },
    ],
    selectedItems: [
      { id: 'app-1', callsign: 'BH1AAA', profiles: { uid: 1001 } },
      { id: 'app-2', callsign: 'BH1BBB', profiles: { uid: 1002 } },
    ],
  },
  notifications: {
    auth: authFixtures.superAdmin,
    route: { path: '/admin/notifications' },
  },
}
