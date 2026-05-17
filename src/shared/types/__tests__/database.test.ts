import type {
  Brand,
  Category,
  Gym,
  GymMachine,
  GymMachineWithDetails,
  GymWithMachineCount,
  LoadingType,
  MachinePhoto,
  MachineTemplate,
  MapBounds,
  ReportStatus,
  SearchFilters,
  User,
  UserRole,
} from '../database';

describe('Database types', () => {
  it('Gym has optional operating info and required timestamps', () => {
    const gym: Gym = {
      id: 'uuid',
      name: 'Test',
      address: 'Seoul',
      latitude: 37.5,
      longitude: 127.0,
      phone: null,
      operating_hours: null,
      day_pass_price: null,
      is_verified: true,
      last_verified_at: '2026-03-15',
      created_at: '2026-03-15',
      updated_at: '2026-03-15',
    };
    expect(gym.phone).toBeNull();
    expect(gym.latitude).toBe(37.5);
  });

  it('GymMachine has quantity defaulting to 1+', () => {
    const gm: GymMachine = {
      id: 'uuid',
      gym_id: 'g',
      template_id: 't',
      quantity: 2,
      is_custom: false,
      custom_name: null,
      last_verified_at: null,
      created_at: '2026-03-15',
    };
    expect(gm.quantity).toBeGreaterThanOrEqual(1);
  });

  it('MachinePhoto user_id is nullable for Phase 1 seed', () => {
    const p: MachinePhoto = {
      id: 'uuid',
      gym_machine_id: 'gm',
      user_id: null,
      photo_url: 'https://example.com/photo.webp',
      created_at: '2026-03-10',
      upvote_count: 0,
    };
    expect(p.user_id).toBeNull();
  });

  it('User role is constrained to known roles', () => {
    const role: UserRole = 'admin';
    const user: User = {
      id: 'u1',
      email: 'a@b.com',
      nickname: 'tester',
      role,
      created_at: '2026-03-10',
      updated_at: '2026-03-10',
    };
    expect(user.role).toBe('admin');
  });

  it('LoadingType covers pin and plate', () => {
    const pin: LoadingType = 'pin';
    const plate: LoadingType = 'plate';
    expect([pin, plate]).toEqual(['pin', 'plate']);
  });

  it('ReportStatus covers all review states', () => {
    const statuses: ReportStatus[] = ['pending', 'reviewed', 'dismissed', 'actioned'];
    expect(statuses).toHaveLength(4);
  });

  it('Brand and Category share shape', () => {
    const brand: Brand = { id: 'b1', name: 'Panatta' };
    const category: Category = { id: 'c1', name: 'Row' };
    expect(brand.name).toBe('Panatta');
    expect(category.name).toBe('Row');
  });

  it('MachineTemplate requires brand_id and category_id', () => {
    const tpl: MachineTemplate = {
      id: 't1',
      brand_id: 'b1',
      category_id: 'c1',
      name: 'High Row',
      loading_type: 'plate',
      is_approved: true,
      created_at: '2026-03-01',
    };
    expect(tpl.is_approved).toBe(true);
  });

  it('GymWithMachineCount extends Gym with count', () => {
    const gym: GymWithMachineCount = {
      id: 'uuid',
      name: 'Test',
      address: 'Seoul',
      latitude: 37.5,
      longitude: 127.0,
      phone: null,
      operating_hours: null,
      day_pass_price: null,
      is_verified: true,
      last_verified_at: null,
      created_at: '2026-03-15',
      updated_at: '2026-03-15',
      machine_count: 12,
    };
    expect(gym.machine_count).toBe(12);
  });

  it('GymMachineWithDetails joins template + photos', () => {
    const row: GymMachineWithDetails = {
      id: 'gm1',
      gym_id: 'g1',
      template_id: 't1',
      quantity: 1,
      is_custom: false,
      custom_name: null,
      last_verified_at: null,
      created_at: '2026-03-15',
      template: {
        id: 't1',
        brand_id: 'b1',
        category_id: 'c1',
        name: 'High Row',
        loading_type: 'plate',
        is_approved: true,
        created_at: '2026-03-01',
        brand: { id: 'b1', name: 'Panatta' },
        category: { id: 'c1', name: 'Row' },
      },
      photos: [],
    };
    expect(row.template.brand.name).toBe('Panatta');
    expect(row.photos).toEqual([]);
  });

  it('MapBounds has min/max coordinates', () => {
    const bounds: MapBounds = { minLat: 37.48, minLng: 127.02, maxLat: 37.5, maxLng: 127.04 };
    expect(bounds.maxLat).toBeGreaterThan(bounds.minLat);
  });

  it('SearchFilters accepts empty arrays + or-mode default', () => {
    const filters: SearchFilters = {
      brandIds: [],
      categoryIds: [],
      templateIds: [],
      machineFilterMode: 'or',
    };
    expect(filters.brandIds).toEqual([]);
    expect(filters.machineFilterMode).toBe('or');
  });
});
