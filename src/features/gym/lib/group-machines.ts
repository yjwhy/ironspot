import { snakeCaseTemplateDisplayName } from '@/shared/lib/template-display-name';
import type { Brand, GymMachineWithDetails } from '@/shared/types/database';

export interface BrandGroup {
  readonly brand: Brand;
  readonly machines: readonly GymMachineWithDetails[];
}

export function machineDisplayName(machine: GymMachineWithDetails): string {
  if (machine.is_custom && machine.custom_name) {
    return machine.custom_name;
  }
  return snakeCaseTemplateDisplayName(machine.template);
}

export function groupMachinesByBrand(machines: readonly GymMachineWithDetails[]): BrandGroup[] {
  const byBrandId = new Map<string, { brand: Brand; machines: GymMachineWithDetails[] }>();

  for (const machine of machines) {
    const { brand } = machine.template;
    const existing = byBrandId.get(brand.id);
    if (existing) {
      existing.machines.push(machine);
    } else {
      byBrandId.set(brand.id, { brand, machines: [machine] });
    }
  }

  return Array.from(byBrandId.values())
    .sort((a, b) => a.brand.name.localeCompare(b.brand.name))
    .map(({ brand, machines: list }) => ({
      brand,
      machines: [...list].sort(byCategoryThenName),
    }));
}

function byCategoryThenName(a: GymMachineWithDetails, b: GymMachineWithDetails): number {
  const categoryDiff = a.template.category.name.localeCompare(b.template.category.name);
  if (categoryDiff !== 0) return categoryDiff;
  return machineDisplayName(a).localeCompare(machineDisplayName(b));
}
