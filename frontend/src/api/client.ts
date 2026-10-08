import axios from 'axios';
import type {
  DealAnalysis,
  PortfolioSummary,
  Property,
  PropertyCreate,
  Tenant,
} from '../types/property';
import type { LoginPayload, SignupPayload, TokenResponse, User, WorkspaceMember } from '../types/auth';

export const TOKEN_STORAGE_KEY = 'auth_token';

export const api = axios.create({
  baseURL: 'http://localhost:8000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

export async function signup(payload: SignupPayload): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/signup', payload);
  return res.data;
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/login', payload);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>('/auth/me');
  return res.data;
}

export async function listWorkspaceMembers(): Promise<WorkspaceMember[]> {
  const res = await api.get<WorkspaceMember[]>('/auth/workspace/members');
  return res.data;
}

export async function updateMemberPermissions(
  memberId: number,
  canEditProperties: boolean,
): Promise<WorkspaceMember> {
  const res = await api.patch<WorkspaceMember>(`/auth/workspace/members/${memberId}`, {
    can_edit_properties: canEditProperties,
  });
  return res.data;
}

export async function listProperties(): Promise<Property[]> {
  const res = await api.get<Property[]>('/properties');
  return res.data;
}

export async function getProperty(id: number): Promise<Property> {
  const res = await api.get<Property>(`/properties/${id}`);
  return res.data;
}

export async function createProperty(payload: PropertyCreate): Promise<Property> {
  const res = await api.post<Property>('/properties', payload);
  return res.data;
}

export async function updateProperty(
  id: number,
  payload: Partial<PropertyCreate>,
): Promise<Property> {
  const res = await api.patch<Property>(`/properties/${id}`, payload);
  return res.data;
}

export async function deleteProperty(id: number): Promise<void> {
  await api.delete(`/properties/${id}`);
}

export async function listTenants(id: number): Promise<Tenant[]> {
  const res = await api.get<Tenant[]>(`/properties/${id}/tenants`);
  return res.data;
}

export async function refreshMarketData(id: number): Promise<Property> {
  const res = await api.post<Property>(`/properties/${id}/refresh-market-data`);
  return res.data;
}

export async function analyzeProperty(id: number): Promise<DealAnalysis> {
  const res = await api.get<DealAnalysis>(`/properties/${id}/analyze`);
  return res.data;
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const res = await api.get<PortfolioSummary>('/portfolio/summary');
  return res.data;
}

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.detail ?? err.message;
  }
  return String(err);
}
