export type SignupMode = 'personal' | 'create_group' | 'join_group';

export interface Workspace {
  id: number;
  name: string;
  is_personal: boolean;
  invite_code: string;
}

export type UserRole = 'admin' | 'member';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: UserRole;
  can_edit_properties: boolean;
  workspace: Workspace;
}

export interface WorkspaceMember {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  can_edit_properties: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SignupPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  mode: SignupMode;
  group_name?: string;
  invite_code?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
