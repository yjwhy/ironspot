import type {
  Brand,
  Category,
  GymMachineWithDetails,
  MachinePhoto,
  MachineTemplate,
} from '@/shared/types/database';

interface FactoryOverrides {
  machine?: Partial<GymMachineWithDetails>;
  template?: Partial<MachineTemplate>;
  brand?: Partial<Brand>;
  category?: Partial<Category>;
  photos?: MachinePhoto[];
}

export function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return { id: 'b-1', name: 'Panatta', nameKo: '파나타', ...overrides };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'c-1', name: 'Back', ...overrides };
}

export function makeMachineTemplate(overrides: Partial<MachineTemplate> = {}): MachineTemplate {
  return {
    id: 't-1',
    brand_id: 'b-1',
    category_id: 'c-1',
    name_en: 'High Row',
    name_ko: '하이로우',
    loading_type: 'plate',
    is_approved: true,
    created_at: '2026-04-01',
    ...overrides,
  };
}

export function makeMachinePhoto(overrides: Partial<MachinePhoto> = {}): MachinePhoto {
  return {
    id: 'p-1',
    gym_machine_id: 'gm-1',
    user_id: null,
    photo_url: 'https://example.test/photo.webp',
    created_at: '2026-04-01',
    upvote_count: 0,
    ...overrides,
  };
}

export function makeGymMachineWithDetails(overrides: FactoryOverrides = {}): GymMachineWithDetails {
  const brand = makeBrand(overrides.brand);
  const category = makeCategory(overrides.category);
  const template = { ...makeMachineTemplate(overrides.template), brand, category };
  return {
    id: 'gm-1',
    gym_id: 'gym-1',
    template_id: template.id,
    quantity: 1,
    is_custom: false,
    custom_name: null,
    last_verified_at: null,
    created_at: '2026-04-01',
    ...overrides.machine,
    template,
    photos: overrides.photos ?? [],
  };
}
