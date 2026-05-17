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
  /**
   * Task 47 / ADR 0023 Q5: set when an active owner has verified this photo.
   * Optional in the type so fixtures predating Task 47 still satisfy the
   * shape; null means "not verified" at runtime.
   */
  verified_by_owner_at?: string | null;
}

export interface GymWithMachineCount extends Gym {
  machine_count: number;
  // ADR 0022 / Task 45: top 5 matching machines as "Brand TemplateName" strings,
  // sorted alphabetically. Reflects WHERE-filtered set (brand/category/template
  // filters applied). When no filters set, returns the gym's first 5 machines.
  matched_machine_names: readonly string[];
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
  brandIds: readonly string[];
  categoryIds: readonly string[];
  templateIds: readonly string[];
  // ADR 0022 / Task 45: 'or' = gym has at least one matching template (default,
  // matches brand/category semantics). 'and' = gym must have ALL selected
  // templates (the user's "wishlist" compound search). Toggled in UI when 2+
  // templates are selected.
  machineFilterMode: 'or' | 'and';
}
