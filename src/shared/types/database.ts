export type LoadingType = 'pin' | 'plate';
export type UserRole = 'admin' | 'user' | 'owner';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned';

export interface User {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

/**
 * RPC output shape returned by `search_gyms_in_bounds` (lat/lng already
 * decomposed via ST_Y/ST_X). NOT the raw `gyms` table row, which stores
 * `location geography(Point)` as a single PostGIS column. See
 * docs/plans/architecture-design.md §6 for the underlying table schema.
 */
export interface Gym {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  operating_hours: string | null;
  day_pass_price: number | null;
  is_verified: boolean;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface MachineTemplate {
  id: string;
  brand_id: string;
  category_id: string;
  name: string;
  loading_type: LoadingType;
  is_approved: boolean;
  created_at: string;
}

export interface GymMachine {
  id: string;
  gym_id: string;
  template_id: string;
  quantity: number;
  is_custom: boolean;
  custom_name: string | null;
  last_verified_at: string | null;
  created_at: string;
}

export interface MachinePhoto {
  id: string;
  gym_machine_id: string;
  user_id: string | null;
  photo_url: string;
  created_at: string;
  upvote_count: number;
  is_upvoted_by_me?: boolean;
}

export interface GymWithMachineCount extends Gym {
  machine_count: number;
}

export interface GymMachineWithDetails extends GymMachine {
  template: MachineTemplate & { brand: Brand; category: Category };
  photos: MachinePhoto[];
}

export interface MapBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface SearchFilters {
  brandId: string | null;
  categoryId: string | null;
  loadingType: LoadingType | null;
}
