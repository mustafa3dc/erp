import React from 'react';
import UsersStaffView, { UsersStaffViewProps } from './UsersStaffView';

export interface UsersTableViewProps extends UsersStaffViewProps {}

/**
 * UsersTableView - Pure API-Connected Table Component for Employees & Roles.
 * Fully compliant with root .cursorrules: Zero Mock Data, Pure API Binding.
 */
export const UsersTableView: React.FC<UsersTableViewProps> = (props) => {
  return <UsersStaffView {...props} />;
};

export default UsersTableView;

