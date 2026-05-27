import axios from 'axios'
import { getToken, clearToken } from './auth'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: AppUser
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/login', { email, password })
  return res.data
}

export async function fetchMe(): Promise<AppUser> {
  const res = await apiClient.get<AppUser>('/auth/me')
  return res.data
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type HostState = 'Enabled' | 'Disabled'
export type VMState = 'Running' | 'Stopped'
export type StorageState = 'Enabled' | 'Disabled'
export type SyncStatus = 'success' | 'partial' | 'failed'
export type UserRole = 'Admin' | 'Operator' | 'Viewer'
export type UserStatus = 'Active' | 'Inactive'
export type AppModule =
  | 'Dashboard'
  | 'Hosts'
  | 'VMs'
  | 'Storage'
  | 'Projects'
  | 'Resource Groups'
  | 'Reports'
  | 'Disk Health'
  | 'User Management'
export type PermissionMap = Record<AppModule, { view: boolean; manage: boolean }>

export const APP_MODULES: AppModule[] = [
  'Dashboard', 'Hosts', 'VMs', 'Storage', 'Projects', 'Resource Groups', 'Reports', 'Disk Health', 'User Management',
]

const ADMIN_ONLY: AppModule[] = ['User Management']

export function defaultPermissions(role: UserRole): PermissionMap {
  if (role === 'Admin') {
    return Object.fromEntries(APP_MODULES.map((mod) => [mod, { view: true, manage: true }])) as PermissionMap
  }
  if (role === 'Viewer') {
    return Object.fromEntries(
      APP_MODULES.map((mod) => [mod, { view: !ADMIN_ONLY.includes(mod), manage: false }])
    ) as PermissionMap
  }
  // Operator
  const OP_NO_MANAGE: AppModule[] = ['Dashboard', 'Reports', 'User Management']
  return Object.fromEntries(
    APP_MODULES.map((mod) => [
      mod,
      {
        view: !ADMIN_ONLY.includes(mod),
        manage: !OP_NO_MANAGE.includes(mod) && !ADMIN_ONLY.includes(mod),
      },
    ])
  ) as PermissionMap
}

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  created_at: string
  last_login: string | null
  permissions: PermissionMap
}

export interface Host {
  id: string
  name: string
  management_ip: string
  state: HostState
  vcpu_allocated: number
  vcpu_total: number
  memory_allocated_gb: number
  memory_total_gb: number
  vm_count: number
}

export interface CephPool {
  pool_name: string
  alias_name: string | null
  total_tb: number
  used_tb: number
  util_pct: number
}

export interface StoragePool {
  id: string
  name: string
  type: string
  state: StorageState
  total_tb: number
  used_tb: number
  total_physical_tb: number
  used_physical_tb: number
  volume_count?: number
  ceph_pools?: CephPool[] | null
}

export interface VolumeInfo {
  name: string
  type: string
  size_gb: number
  storage_name: string | null
}

export interface VM {
  id: string
  name: string
  state: VMState
  host: string | null
  platform: string | null
  private_ip: string | null
  eip: string | null
  vcpu: number
  vram_gb: number
  storage_gb: number
  created_at: string
  project_name: string | null
  root_volume: VolumeInfo | null
  data_volumes: VolumeInfo[]
}

export interface ProjectQuota {
  vm_num: number | null
  vcpu_num: number | null
  memory_gb: number | null
  storage_tb: number | null
  volume_num: number | null
  eip_num: number | null
}

export interface Project {
  id: string
  name: string
  state: string | null
  vm_count: number
  vcpu_total: number
  vram_total_gb: number
  storage_total_tb: number
  quota: ProjectQuota | null
}

export interface ResourceGroup {
  id: string
  name: string
  description: string | null
  projects: string[]
  project_ids: string[]
  vm_count: number
  vcpu_total: number
  vram_gb: number
  storage_gb: number
}

export interface SyncInfo {
  last_sync: string
  status: SyncStatus
}

export interface DashboardSummary {
  total_hosts: number
  running_vms: number
  stopped_vms: number
  total_storage_used_tb: number
  total_storage_tb: number
  total_cpu_allocated: number
  total_cpu_total: number
  total_memory_allocated_gb: number
  total_memory_total_gb: number
  sync_info: SyncInfo
}

export interface VMTrendPoint {
  date: string
  count: number
}

export interface ProvisioningPoint {
  date: string
  value: number
}

export interface ComputePoint {
  date: string
  vcpu: number
  ram_gb: number
}

export interface HostTrendPoint {
  date: string
  cpu_allocated: number
  cpu_total: number
  memory_allocated_gb: number
  memory_total_gb: number
}

export interface StorageCapacityPoint {
  date: string
  capacity_total_tb: number
  capacity_used_tb: number
}

export type DiskSummary = 'Good' | 'Warning' | 'Not good'

export interface DiskHealthRecord {
  id: string
  hostname: string
  nvme_device: string
  model_number: string | null
  capacity_tb: number | null
  tbw: number | null
  endurance_used_pct: number | null
  life_remaining_pct: number | null
  available_spare_pct: number | null
  disk_health: string
  summary: DiskSummary | null
  notes: string | null
  collected_at: string
}

export interface CollectResult {
  nodes_collected: number
  nodes_failed: number
  files_parsed: number
  parse_errors: number
  message: string
}

export interface StorageNode {
  id: string
  hostname: string
  ssh_host: string
  ssh_port: number
  ssh_user: string
  ssh_key_path: string
  remote_dir: string
  enabled: boolean
  last_collected_at: string | null
  last_collect_status: string | null
  last_collect_error: string | null
  created_at: string
}

export interface StorageNodeCreate {
  hostname: string
  ssh_host: string
  ssh_port: number
  ssh_user: string
  ssh_key_path: string
  remote_dir: string
  enabled: boolean
}

export interface StorageNodeUpdate {
  hostname?: string
  ssh_host?: string
  ssh_port?: number
  ssh_user?: string
  ssh_key_path?: string
  remote_dir?: string
  enabled?: boolean
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

export const MOCK_HOSTS: Host[] = [
  {
    id: 'h1',
    name: 'host-01',
    management_ip: '192.168.10.1',
    state: 'Enabled',
    vcpu_allocated: 48,
    vcpu_total: 120,
    memory_allocated_gb: 64,
    memory_total_gb: 128,
    vm_count: 12,
  },
  {
    id: 'h2',
    name: 'host-02',
    management_ip: '192.168.10.2',
    state: 'Enabled',
    vcpu_allocated: 96,
    vcpu_total: 120,
    memory_allocated_gb: 110,
    memory_total_gb: 128,
    vm_count: 24,
  },
  {
    id: 'h3',
    name: 'host-03',
    management_ip: '192.168.10.3',
    state: 'Disabled',
    vcpu_allocated: 0,
    vcpu_total: 120,
    memory_allocated_gb: 0,
    memory_total_gb: 128,
    vm_count: 0,
  },
]

export const MOCK_STORAGE: StoragePool[] = [
  {
    id: 's1',
    name: 'ceph-pool-01',
    type: 'Ceph',
    state: 'Enabled',
    total_tb: 50,
    used_tb: 32,
    total_physical_tb: 45,
    used_physical_tb: 28,
  },
  {
    id: 's2',
    name: 'local-storage-01',
    type: 'LocalStorage',
    state: 'Enabled',
    total_tb: 10,
    used_tb: 6,
    total_physical_tb: 10,
    used_physical_tb: 6,
  },
]

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1', name: 'project-alpha', state: 'Enabled',
    vm_count: 18, vcpu_total: 36, vram_total_gb: 72, storage_total_tb: 3.6,
    quota: { vm_num: 40, vcpu_num: 80, memory_gb: 160, storage_tb: 10, volume_num: 40, eip_num: 20 },
  },
  {
    id: 'p2', name: 'project-beta', state: 'Enabled',
    vm_count: 12, vcpu_total: 24, vram_total_gb: 48, storage_total_tb: 2.4,
    quota: { vm_num: 20, vcpu_num: 40, memory_gb: 80, storage_tb: 5, volume_num: 20, eip_num: 10 },
  },
  {
    id: 'p3', name: 'project-gamma', state: 'Enabled',
    vm_count: 6, vcpu_total: 12, vram_total_gb: 24, storage_total_tb: 1.2,
    quota: { vm_num: 20, vcpu_num: 40, memory_gb: 80, storage_tb: 5, volume_num: 20, eip_num: 10 },
  },
]

function _mockVol(name: string, type: string, size_gb: number, storage_name: string | null): VolumeInfo {
  return { name, type, size_gb, storage_name }
}

export const MOCK_VMS: VM[] = [
  { id: 'vm1', name: 'web-01', state: 'Running', host: 'host-01', platform: 'Linux', private_ip: '192.168.1.10', eip: '203.0.113.10', vcpu: 2, vram_gb: 4, storage_gb: 80, created_at: '2025-01-15', project_name: 'Project Alpha', root_volume: _mockVol('ROOT-web-01', 'Root', 50, 'SSD-Pool'), data_volumes: [_mockVol('DATA-web-01', 'Data', 30, 'SSD-Pool')] },
  { id: 'vm2', name: 'web-02', state: 'Running', host: 'host-01', platform: 'Linux', private_ip: '192.168.1.11', eip: null, vcpu: 2, vram_gb: 4, storage_gb: 80, created_at: '2025-01-20', project_name: 'Project Alpha', root_volume: _mockVol('ROOT-web-02', 'Root', 50, 'SSD-Pool'), data_volumes: [_mockVol('DATA-web-02', 'Data', 30, 'SSD-Pool')] },
  { id: 'vm3', name: 'db-01', state: 'Running', host: 'host-02', platform: 'Linux', private_ip: '192.168.1.20', eip: null, vcpu: 8, vram_gb: 32, storage_gb: 500, created_at: '2025-02-01', project_name: 'Project Beta', root_volume: _mockVol('ROOT-db-01', 'Root', 100, 'SSD-Pool'), data_volumes: [_mockVol('DATA-db-01-a', 'Data', 200, 'Ceph-HDD'), _mockVol('DATA-db-01-b', 'Data', 200, 'Ceph-HDD')] },
  { id: 'vm4', name: 'app-01', state: 'Stopped', host: 'host-02', platform: 'Windows', private_ip: '192.168.1.30', eip: null, vcpu: 4, vram_gb: 8, storage_gb: 100, created_at: '2025-02-15', project_name: 'Project Beta', root_volume: _mockVol('ROOT-app-01', 'Root', 80, 'SSD-Pool'), data_volumes: [_mockVol('DATA-app-01', 'Data', 20, 'SSD-Pool')] },
  { id: 'vm5', name: 'cache-01', state: 'Running', host: 'host-01', platform: 'Linux', private_ip: '192.168.1.40', eip: null, vcpu: 2, vram_gb: 8, storage_gb: 50, created_at: '2025-03-01', project_name: 'Project Gamma', root_volume: _mockVol('ROOT-cache-01', 'Root', 50, 'SSD-Pool'), data_volumes: [] },
  { id: 'vm6', name: 'worker-01', state: 'Running', host: 'host-02', platform: 'Linux', private_ip: '192.168.1.50', eip: null, vcpu: 4, vram_gb: 8, storage_gb: 100, created_at: '2025-03-10', project_name: 'Project Gamma', root_volume: _mockVol('ROOT-worker-01', 'Root', 50, 'SSD-Pool'), data_volumes: [_mockVol('DATA-worker-01', 'Data', 50, 'Ceph-HDD')] },
  { id: 'vm7', name: 'worker-02', state: 'Running', host: 'host-01', platform: 'Linux', private_ip: '192.168.1.60', eip: null, vcpu: 4, vram_gb: 8, storage_gb: 100, created_at: '2025-03-15', project_name: null, root_volume: _mockVol('ROOT-worker-02', 'Root', 50, 'SSD-Pool'), data_volumes: [_mockVol('DATA-worker-02', 'Data', 50, 'Ceph-HDD')] },
  { id: 'vm8', name: 'monitor-01', state: 'Running', host: 'host-02', platform: 'Windows', private_ip: '192.168.1.70', eip: '203.0.113.20', vcpu: 2, vram_gb: 4, storage_gb: 50, created_at: '2025-04-01', project_name: 'Project Alpha', root_volume: _mockVol('ROOT-monitor-01', 'Root', 50, 'SSD-Pool'), data_volumes: [] },
  { id: 'vm9', name: 'dev-01', state: 'Stopped', host: 'host-01', platform: 'Linux', private_ip: '192.168.1.80', eip: null, vcpu: 2, vram_gb: 4, storage_gb: 50, created_at: '2025-04-10', project_name: null, root_volume: _mockVol('ROOT-dev-01', 'Root', 50, 'SSD-Pool'), data_volumes: [] },
  { id: 'vm10', name: 'staging-01', state: 'Running', host: 'host-02', platform: 'Linux', private_ip: '192.168.1.90', eip: null, vcpu: 4, vram_gb: 8, storage_gb: 100, created_at: '2025-04-20', project_name: 'Project Beta', root_volume: _mockVol('ROOT-staging-01', 'Root', 50, 'SSD-Pool'), data_volumes: [_mockVol('DATA-staging-01-a', 'Data', 25, 'Ceph-HDD'), _mockVol('DATA-staging-01-b', 'Data', 25, 'Ceph-HDD')] },
]

export const MOCK_RESOURCE_GROUPS: ResourceGroup[] = [
  { id: 'rg1', name: 'Production', description: 'Production workloads', projects: ['Project Alpha', 'Project Beta'], project_ids: [], vm_count: 7, vcpu_total: 26, vram_gb: 60, storage_gb: 960 },
  { id: 'rg2', name: 'Development', description: 'Development and staging environments', projects: ['Project Gamma'], project_ids: [], vm_count: 3, vcpu_total: 10, vram_gb: 24, storage_gb: 250 },
]

export const MOCK_USERS: AppUser[] = [
  { id: 'u1', name: 'Elit Admin', email: 'elit@elitery.com', role: 'Admin', status: 'Active', created_at: '2025-01-01', last_login: '2026-05-22T10:30:00', permissions: defaultPermissions('Admin') },
  { id: 'u2', name: 'Sarah Ops', email: 'sarah.ops@elitery.com', role: 'Operator', status: 'Active', created_at: '2025-03-15', last_login: '2026-05-22T08:15:00', permissions: defaultPermissions('Operator') },
  { id: 'u3', name: 'John Viewer', email: 'john.viewer@elitery.com', role: 'Viewer', status: 'Active', created_at: '2025-06-01', last_login: '2026-05-20T14:22:00', permissions: defaultPermissions('Viewer') },
  { id: 'u4', name: 'Alice Infrastructure', email: 'alice.infra@elitery.com', role: 'Operator', status: 'Active', created_at: '2025-08-10', last_login: '2026-05-21T16:45:00', permissions: defaultPermissions('Operator') },
  { id: 'u5', name: 'Bob Tester', email: 'bob.test@elitery.com', role: 'Viewer', status: 'Inactive', created_at: '2025-09-20', last_login: '2026-02-10T09:00:00', permissions: defaultPermissions('Viewer') },
]

const TREND_COUNTS = [2, 0, 3, 1, 0, 0, 4, 2, 1, 3, 0, 0, 2, 5, 1, 0, 0, 3, 2, 1, 4, 0, 0, 2, 1, 3, 0, 0, 2, 1]
const STORAGE_TREND_GB = [160, 0, 240, 80, 0, 0, 580, 160, 80, 240, 0, 0, 160, 600, 80, 0, 0, 250, 160, 80, 450, 0, 0, 160, 80, 350, 0, 0, 160, 80]
const COMPUTE_TREND_VCPU = [4, 0, 8, 2, 0, 0, 16, 4, 2, 8, 0, 0, 4, 20, 2, 0, 0, 8, 4, 2, 12, 0, 0, 4, 2, 8, 0, 0, 4, 2]
const COMPUTE_TREND_RAM_GB = [8, 0, 16, 4, 0, 0, 32, 8, 4, 16, 0, 0, 8, 64, 4, 0, 0, 16, 8, 4, 32, 0, 0, 8, 4, 16, 0, 0, 8, 4]

// Mock host trend: CPU and memory allocation % rising over 30 days
const HOST_TREND_CPU_ALLOC = [40, 42, 41, 43, 44, 45, 46, 47, 47, 48, 49, 50, 51, 50, 52, 53, 54, 55, 54, 56, 57, 58, 58, 60, 61, 62, 63, 63, 65, 66]
const HOST_TREND_CPU_TOTAL = Array(30).fill(240) as number[]
const HOST_TREND_MEM_ALLOC_GB = [256, 260, 258, 262, 268, 272, 274, 280, 276, 284, 288, 292, 288, 296, 300, 308, 304, 312, 316, 320, 316, 324, 328, 332, 336, 340, 336, 344, 348, 352]
const HOST_TREND_MEM_TOTAL_GB = Array(30).fill(768) as number[]

// Mock storage capacity trend: slowly growing used capacity
const STORAGE_CAP_TOTAL_TB = Array(30).fill(60) as number[]
const STORAGE_CAP_USED_TB = [20, 20.2, 20.5, 20.5, 21, 21.2, 21.5, 22, 22, 22.5, 23, 23, 23.5, 24, 24, 24.5, 25, 25.2, 25.5, 26, 26, 26.5, 27, 27.2, 27.5, 28, 28, 28.5, 29, 29.5]

export const MOCK_SYNC_INFO: SyncInfo = {
  last_sync: '2026-05-22T10:30:00',
  status: 'success',
}

function makeDates(count: number): string[] {
  const dates: string[] = []
  const base = new Date('2026-04-22')
  for (let i = 0; i < count; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

export function getMockVMTrend(startDate?: string, endDate?: string): VMTrendPoint[] {
  const dates = makeDates(30)
  const points: VMTrendPoint[] = TREND_COUNTS.map((count, i) => ({ date: dates[i], count }))
  if (startDate && endDate) return points.filter((p) => p.date >= startDate && p.date <= endDate)
  return points
}

function buildProvisioningTrend(values: number[], startDate?: string, endDate?: string): ProvisioningPoint[] {
  const dates = makeDates(30)
  const points: ProvisioningPoint[] = values.map((value, i) => ({ date: dates[i], value }))
  if (startDate && endDate) return points.filter((p) => p.date >= startDate && p.date <= endDate)
  return points
}

export function getMockStorageTrend(startDate?: string, endDate?: string): ProvisioningPoint[] {
  return buildProvisioningTrend(STORAGE_TREND_GB, startDate, endDate)
}

export function getMockComputeTrend(startDate?: string, endDate?: string): ComputePoint[] {
  const dates = makeDates(30)
  const points: ComputePoint[] = COMPUTE_TREND_VCPU.map((vcpu, i) => ({ date: dates[i], vcpu, ram_gb: COMPUTE_TREND_RAM_GB[i] }))
  if (startDate && endDate) return points.filter((p) => p.date >= startDate && p.date <= endDate)
  return points
}

export function getMockHostTrend(startDate?: string, endDate?: string): HostTrendPoint[] {
  const dates = makeDates(30)
  const points: HostTrendPoint[] = dates.map((date, i) => ({
    date,
    cpu_allocated: HOST_TREND_CPU_ALLOC[i],
    cpu_total: HOST_TREND_CPU_TOTAL[i],
    memory_allocated_gb: HOST_TREND_MEM_ALLOC_GB[i],
    memory_total_gb: HOST_TREND_MEM_TOTAL_GB[i],
  }))
  if (startDate && endDate) return points.filter((p) => p.date >= startDate && p.date <= endDate)
  return points
}

export function getMockStorageCapacityTrend(startDate?: string, endDate?: string): StorageCapacityPoint[] {
  const dates = makeDates(30)
  const points: StorageCapacityPoint[] = dates.map((date, i) => ({
    date,
    capacity_total_tb: STORAGE_CAP_TOTAL_TB[i],
    capacity_used_tb: STORAGE_CAP_USED_TB[i],
  }))
  if (startDate && endDate) return points.filter((p) => p.date >= startDate && p.date <= endDate)
  return points
}

export const MOCK_STORAGE_NODES: StorageNode[] = [
  { id: 'sn1', hostname: 'zs-storage01', ssh_host: '10.0.0.1', ssh_port: 22, ssh_user: 'root', ssh_key_path: '/app/ssh_keys/storage.pem', remote_dir: '/root/smartctl', enabled: true, last_collected_at: '2026-05-25T12:33:00Z', last_collect_status: 'success', last_collect_error: null, created_at: '2026-05-25T00:00:00Z' },
  { id: 'sn2', hostname: 'zs-storage02', ssh_host: '10.0.0.2', ssh_port: 22, ssh_user: 'root', ssh_key_path: '/app/ssh_keys/storage.pem', remote_dir: '/root/smartctl', enabled: true, last_collected_at: '2026-05-25T12:33:52Z', last_collect_status: 'success', last_collect_error: null, created_at: '2026-05-25T00:00:00Z' },
  { id: 'sn3', hostname: 'zs-storage03', ssh_host: '10.0.0.3', ssh_port: 22, ssh_user: 'root', ssh_key_path: '/app/ssh_keys/storage.pem', remote_dir: '/root/smartctl', enabled: true, last_collected_at: '2026-05-25T12:34:10Z', last_collect_status: 'success', last_collect_error: null, created_at: '2026-05-25T00:00:00Z' },
  { id: 'sn4', hostname: 'zs-storage04', ssh_host: '10.0.0.4', ssh_port: 22, ssh_user: 'root', ssh_key_path: '/app/ssh_keys/storage.pem', remote_dir: '/root/smartctl', enabled: true, last_collected_at: null, last_collect_status: null, last_collect_error: null, created_at: '2026-05-25T00:00:00Z' },
  { id: 'sn5', hostname: 'zs-storage05', ssh_host: '10.0.0.5', ssh_port: 22, ssh_user: 'root', ssh_key_path: '/app/ssh_keys/storage.pem', remote_dir: '/root/smartctl', enabled: true, last_collected_at: null, last_collect_status: null, last_collect_error: null, created_at: '2026-05-25T00:00:00Z' },
  { id: 'sn6', hostname: 'zs-storage06', ssh_host: '10.0.0.6', ssh_port: 22, ssh_user: 'root', ssh_key_path: '/app/ssh_keys/storage.pem', remote_dir: '/root/smartctl', enabled: false, last_collected_at: null, last_collect_status: null, last_collect_error: null, created_at: '2026-05-25T00:00:00Z' },
]

export const MOCK_DISK_HEALTH: DiskHealthRecord[] = [
  { id: 'd01', hostname: 'zs-storage01', nvme_device: 'nvme0n1', model_number: 'Dell Express Flash NVMe P4610 3.2TB SFF', capacity_tb: 3.20, tbw: 528.0, endurance_used_pct: 4, life_remaining_pct: 96, available_spare_pct: 99, disk_health: 'PASSED', summary: 'Good', notes: 'All indicators nominal', collected_at: '2026-05-25T12:33:28Z' },
  { id: 'd02', hostname: 'zs-storage01', nvme_device: 'nvme3n1', model_number: 'Dell Express Flash NVMe P4610 3.2TB SFF', capacity_tb: 3.20, tbw: 612.0, endurance_used_pct: 6, life_remaining_pct: 94, available_spare_pct: 99, disk_health: 'PASSED', summary: 'Good', notes: 'All indicators nominal', collected_at: '2026-05-25T12:33:28Z' },
  { id: 'd03', hostname: 'zs-storage02', nvme_device: 'nvme0n1', model_number: 'Dell Express Flash NVMe SM1715 3.2TB SFF', capacity_tb: 3.20, tbw: 731.0, endurance_used_pct: 0, life_remaining_pct: 100, available_spare_pct: 78, disk_health: 'PASSED', summary: 'Warning', notes: 'Available Spare 78%', collected_at: '2026-05-25T12:33:52Z' },
  { id: 'd04', hostname: 'zs-storage02', nvme_device: 'nvme5n1', model_number: 'Dell Express Flash NVMe SM1715 3.2TB SFF', capacity_tb: 3.20, tbw: 698.0, endurance_used_pct: 0, life_remaining_pct: 100, available_spare_pct: 82, disk_health: 'PASSED', summary: 'Warning', notes: 'Available Spare 82%', collected_at: '2026-05-25T12:33:52Z' },
  { id: 'd05', hostname: 'zs-storage03', nvme_device: 'nvme0n1', model_number: 'Dell Express Flash PM1725b 3.2TB SFF', capacity_tb: 3.20, tbw: 412.0, endurance_used_pct: 3, life_remaining_pct: 97, available_spare_pct: 100, disk_health: 'PASSED', summary: 'Good', notes: 'All indicators nominal', collected_at: '2026-05-25T12:34:10Z' },
  { id: 'd06', hostname: 'zs-storage04', nvme_device: 'nvme0n1', model_number: 'Dell Express Flash NVMe P4610 3.2TB SFF', capacity_tb: 3.20, tbw: 885.0, endurance_used_pct: 10, life_remaining_pct: 90, available_spare_pct: 98, disk_health: 'PASSED', summary: 'Good', notes: 'All indicators nominal', collected_at: '2026-05-25T12:34:22Z' },
  { id: 'd07', hostname: 'zs-storage05', nvme_device: 'nvme0n1', model_number: 'Dell Express Flash NVMe P4610 3.2TB SFF', capacity_tb: 3.20, tbw: 944.0, endurance_used_pct: 12, life_remaining_pct: 88, available_spare_pct: 97, disk_health: 'PASSED', summary: 'Good', notes: 'All indicators nominal', collected_at: '2026-05-25T12:34:38Z' },
  { id: 'd08', hostname: 'zs-storage06', nvme_device: 'nvme0n1', model_number: 'Dell Ent NVMe CM6 MU 3.2TB', capacity_tb: 3.20, tbw: 321.0, endurance_used_pct: 2, life_remaining_pct: 98, available_spare_pct: 100, disk_health: 'PASSED', summary: 'Good', notes: 'All indicators nominal', collected_at: '2026-05-25T12:34:55Z' },
]

// ─── API Functions (with mock fallback) ──────────────────────────────────────

export async function fetchHosts(): Promise<Host[]> {
  try {
    const res = await apiClient.get<Host[]>('/hosts')
    return res.data
  } catch {
    return MOCK_HOSTS
  }
}

export async function fetchStorage(): Promise<StoragePool[]> {
  try {
    const res = await apiClient.get<StoragePool[]>('/storage')
    return res.data
  } catch {
    return MOCK_STORAGE
  }
}

export async function fetchVMs(): Promise<VM[]> {
  try {
    const res = await apiClient.get<VM[]>('/vms', { params: { per_page: 2000 } })
    return res.data
  } catch {
    return MOCK_VMS
  }
}

export async function fetchVMsCreatedInRange(startDate: string, endDate: string): Promise<VM[]> {
  try {
    const res = await apiClient.get<VM[]>('/vms/created-in-range', {
      params: { start_date: startDate, end_date: endDate },
    })
    return res.data
  } catch {
    return []
  }
}

export async function fetchProjects(): Promise<Project[]> {
  try {
    const res = await apiClient.get<Project[]>('/projects')
    return res.data
  } catch {
    return MOCK_PROJECTS
  }
}

export async function fetchUsers(): Promise<AppUser[]> {
  try {
    const res = await apiClient.get<AppUser[]>('/users')
    return res.data
  } catch {
    return MOCK_USERS
  }
}

export async function createUser(data: {
  name: string; email: string; role: UserRole; status: UserStatus; password: string
}): Promise<AppUser> {
  const res = await apiClient.post<AppUser>('/users', data)
  return res.data
}

export async function updateUser(id: string, data: {
  name?: string; email?: string; role?: UserRole; status?: UserStatus; password?: string
}): Promise<AppUser> {
  const res = await apiClient.put<AppUser>(`/users/${id}`, data)
  return res.data
}

export async function updateUserPermissions(id: string, permissions: PermissionMap): Promise<AppUser> {
  const res = await apiClient.put<AppUser>(`/users/${id}/permissions`, { permissions })
  return res.data
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`)
}

export async function fetchResourceGroups(): Promise<ResourceGroup[]> {
  try {
    const res = await apiClient.get<ResourceGroup[]>('/resource-groups')
    return res.data
  } catch {
    return MOCK_RESOURCE_GROUPS
  }
}

export async function createResourceGroup(data: { name: string; description?: string; project_ids: string[] }): Promise<ResourceGroup> {
  const res = await apiClient.post<ResourceGroup>('/resource-groups', data)
  return res.data
}

export async function updateResourceGroup(id: string, data: { name?: string; description?: string; project_ids?: string[] }): Promise<ResourceGroup> {
  const res = await apiClient.put<ResourceGroup>(`/resource-groups/${id}`, data)
  return res.data
}

export async function deleteResourceGroup(id: string): Promise<void> {
  await apiClient.delete(`/resource-groups/${id}`)
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  try {
    const res = await apiClient.get<DashboardSummary>('/dashboard/summary')
    return res.data
  } catch {
    const totalStorage = MOCK_STORAGE.reduce((a, s) => a + s.total_tb, 0)
    const usedStorage = MOCK_STORAGE.reduce((a, s) => a + s.used_tb, 0)
    const totalCpuAlloc = MOCK_HOSTS.reduce((a, h) => a + h.vcpu_allocated, 0)
    const totalCpuTotal = MOCK_HOSTS.reduce((a, h) => a + h.vcpu_total, 0)
    const totalMemAlloc = MOCK_HOSTS.reduce((a, h) => a + h.memory_allocated_gb, 0)
    const totalMemTotal = MOCK_HOSTS.reduce((a, h) => a + h.memory_total_gb, 0)
    return {
      total_hosts: MOCK_HOSTS.length,
      running_vms: MOCK_VMS.filter((v) => v.state === 'Running').length,
      stopped_vms: MOCK_VMS.filter((v) => v.state === 'Stopped').length,
      total_storage_used_tb: usedStorage,
      total_storage_tb: totalStorage,
      total_cpu_allocated: totalCpuAlloc,
      total_cpu_total: totalCpuTotal,
      total_memory_allocated_gb: totalMemAlloc,
      total_memory_total_gb: totalMemTotal,
      sync_info: MOCK_SYNC_INFO,
    }
  }
}

export async function fetchVMTrend(startDate?: string, endDate?: string): Promise<VMTrendPoint[]> {
  try {
    const params: Record<string, string> = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    const res = await apiClient.get<VMTrendPoint[]>('/vms/trend', { params })
    return res.data
  } catch {
    return getMockVMTrend(startDate, endDate)
  }
}

export async function fetchStorageTrend(startDate?: string, endDate?: string): Promise<ProvisioningPoint[]> {
  try {
    const params: Record<string, string> = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    const res = await apiClient.get<ProvisioningPoint[]>('/storage/trend', { params })
    return res.data
  } catch {
    return getMockStorageTrend(startDate, endDate)
  }
}

export async function fetchComputeTrend(startDate?: string, endDate?: string): Promise<ComputePoint[]> {
  try {
    const params: Record<string, string> = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    const res = await apiClient.get<ComputePoint[]>('/compute/trend', { params })
    return res.data
  } catch {
    return getMockComputeTrend(startDate, endDate)
  }
}

export async function fetchHostTrend(
  startDate?: string,
  endDate?: string,
  hostId?: string,
): Promise<HostTrendPoint[]> {
  try {
    const params: Record<string, string> = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    if (hostId) params.host_id = hostId
    const res = await apiClient.get<HostTrendPoint[]>('/hosts/trend', { params })
    return res.data
  } catch {
    return getMockHostTrend(startDate, endDate)
  }
}

export async function fetchStorageCapacityTrend(
  startDate?: string,
  endDate?: string,
  storageId?: string,
): Promise<StorageCapacityPoint[]> {
  try {
    const params: Record<string, string> = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    if (storageId) params.storage_id = storageId
    const res = await apiClient.get<StorageCapacityPoint[]>('/storage/capacity-trend', { params })
    return res.data
  } catch {
    return getMockStorageCapacityTrend(startDate, endDate)
  }
}

export async function fetchSmartctlLastUpdated(): Promise<string | null> {
  try {
    const res = await apiClient.get<{ last_updated: string | null }>('/disk-health/last-updated')
    return res.data.last_updated
  } catch {
    return null
  }
}

export async function fetchDiskHealth(hostname?: string, health?: string): Promise<DiskHealthRecord[]> {
  try {
    const params: Record<string, string> = {}
    if (hostname) params.hostname = hostname
    if (health) params.health = health
    const res = await apiClient.get<DiskHealthRecord[]>('/disk-health', { params })
    return res.data
  } catch {
    return MOCK_DISK_HEALTH
  }
}

export async function refreshDiskHealth(): Promise<CollectResult> {
  const res = await apiClient.post<CollectResult>('/disk-health/refresh')
  return res.data
}

export async function fetchStorageNodes(): Promise<StorageNode[]> {
  try {
    const res = await apiClient.get<StorageNode[]>('/storage-nodes')
    return res.data
  } catch {
    return MOCK_STORAGE_NODES
  }
}

export async function createStorageNode(data: StorageNodeCreate): Promise<StorageNode> {
  const res = await apiClient.post<StorageNode>('/storage-nodes', data)
  return res.data
}

export async function updateStorageNode(id: string, data: StorageNodeUpdate): Promise<StorageNode> {
  const res = await apiClient.put<StorageNode>(`/storage-nodes/${id}`, data)
  return res.data
}

export async function deleteStorageNode(id: string): Promise<void> {
  await apiClient.delete(`/storage-nodes/${id}`)
}
