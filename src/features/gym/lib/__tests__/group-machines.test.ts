import {
  makeBrand,
  makeCategory,
  makeGymMachineWithDetails,
  makeMachineTemplate,
} from '@/test/utils/factories/gym-machine';

import { groupMachinesByBrand, machineDisplayName } from '../group-machines';

describe('groupMachinesByBrand', () => {
  it('groups machines by brand', () => {
    const panattaA = makeGymMachineWithDetails({
      machine: { id: 'gm-1' },
      brand: { id: 'b-pan', name: 'Panatta' },
      template: { name: 'High Row' },
    });
    const panattaB = makeGymMachineWithDetails({
      machine: { id: 'gm-2' },
      brand: { id: 'b-pan', name: 'Panatta' },
      template: { name: 'Low Row' },
    });
    const hammer = makeGymMachineWithDetails({
      machine: { id: 'gm-3' },
      brand: { id: 'b-ham', name: 'Hammer Strength' },
      template: { name: 'Lat Pull Down' },
    });

    const groups = groupMachinesByBrand([panattaA, hammer, panattaB]);

    expect(groups).toHaveLength(2);
    const panattaGroup = groups.find((g) => g.brand.id === 'b-pan');
    const hammerGroup = groups.find((g) => g.brand.id === 'b-ham');
    expect(panattaGroup?.machines).toHaveLength(2);
    expect(hammerGroup?.machines).toHaveLength(1);
  });

  it('sorts brands alphabetically by name', () => {
    const groups = groupMachinesByBrand([
      makeGymMachineWithDetails({ brand: { id: 'b1', name: 'Technogym' } }),
      makeGymMachineWithDetails({ brand: { id: 'b2', name: 'Hammer Strength' } }),
      makeGymMachineWithDetails({ brand: { id: 'b3', name: 'Panatta' } }),
    ]);

    expect(groups.map((g) => g.brand.name)).toEqual(['Hammer Strength', 'Panatta', 'Technogym']);
  });

  it('within a brand, sorts machines by category name then by display name', () => {
    const back = makeCategory({ id: 'c-back', name: 'Back' });
    const chest = makeCategory({ id: 'c-chest', name: 'Chest' });
    const brand = makeBrand({ id: 'b-pan', name: 'Panatta' });

    const machines = [
      makeGymMachineWithDetails({
        machine: { id: 'gm-2' },
        brand,
        category: chest,
        template: makeMachineTemplate({ id: 't-2', name: 'Chest Press' }),
      }),
      makeGymMachineWithDetails({
        machine: { id: 'gm-1' },
        brand,
        category: back,
        template: makeMachineTemplate({ id: 't-1', name: 'Low Row' }),
      }),
      makeGymMachineWithDetails({
        machine: { id: 'gm-3' },
        brand,
        category: back,
        template: makeMachineTemplate({ id: 't-3', name: 'High Row' }),
      }),
    ];

    const [group] = groupMachinesByBrand(machines);
    expect(group?.machines.map((m) => m.id)).toEqual(['gm-3', 'gm-1', 'gm-2']);
  });
});

describe('machineDisplayName', () => {
  it('returns custom_name when is_custom is true', () => {
    const machine = makeGymMachineWithDetails({
      machine: { is_custom: true, custom_name: '수제 머신' },
    });
    expect(machineDisplayName(machine)).toBe('수제 머신');
  });

  it('returns template.name when not custom', () => {
    const machine = makeGymMachineWithDetails({
      template: { name: 'High Row' },
    });
    expect(machineDisplayName(machine)).toBe('High Row');
  });

  it('falls back to template.name when is_custom is true but custom_name is empty', () => {
    const machine = makeGymMachineWithDetails({
      machine: { is_custom: true, custom_name: null },
      template: { name: 'High Row' },
    });
    expect(machineDisplayName(machine)).toBe('High Row');
  });
});
