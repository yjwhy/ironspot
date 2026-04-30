import { fireEvent, render } from '@testing-library/react-native';

import {
  makeBrand,
  makeCategory,
  makeGymMachineWithDetails,
  makeMachinePhoto,
  makeMachineTemplate,
} from '@/test/utils/factories/gym-machine';

import { MachineList } from '../MachineList';

const panatta = makeBrand({ id: 'b-pan', name: 'Panatta' });
const hammer = makeBrand({ id: 'b-ham', name: 'Hammer Strength' });
const back = makeCategory({ id: 'c-back', name: 'Back' });

const panattaHigh = makeGymMachineWithDetails({
  machine: { id: 'gm-1', quantity: 1 },
  brand: panatta,
  category: back,
  template: makeMachineTemplate({ id: 't-1', name: 'High Row' }),
  photos: [makeMachinePhoto({ id: 'p-1' }), makeMachinePhoto({ id: 'p-2' })],
});

const panattaLow = makeGymMachineWithDetails({
  machine: { id: 'gm-2', quantity: 3 },
  brand: panatta,
  category: back,
  template: makeMachineTemplate({ id: 't-2', name: 'Low Row' }),
  photos: [],
});

const hammerLat = makeGymMachineWithDetails({
  machine: { id: 'gm-3', quantity: 1 },
  brand: hammer,
  category: back,
  template: makeMachineTemplate({ id: 't-3', name: 'Lat Pull Down' }),
  photos: [makeMachinePhoto({ id: 'p-3' })],
});

const all = [panattaHigh, panattaLow, hammerLat];

describe('MachineList', () => {
  it('renders one header per brand', () => {
    const { getAllByRole, getByRole } = render(
      <MachineList machines={all} onPressMachine={() => undefined} />,
    );
    expect(getAllByRole('header')).toHaveLength(2);
    expect(getByRole('header', { name: 'Panatta' })).toBeTruthy();
    expect(getByRole('header', { name: 'Hammer Strength' })).toBeTruthy();
  });

  it('renders each machine display name as a button', () => {
    const { getByRole } = render(<MachineList machines={all} onPressMachine={() => undefined} />);
    expect(getByRole('button', { name: /^High Row/ })).toBeTruthy();
    expect(getByRole('button', { name: /^Low Row/ })).toBeTruthy();
    expect(getByRole('button', { name: /^Lat Pull Down/ })).toBeTruthy();
  });

  it('shows a quantity badge when quantity >= 2', () => {
    const { getByText } = render(<MachineList machines={all} onPressMachine={() => undefined} />);
    expect(getByText('x3')).toBeTruthy();
  });

  it('omits the quantity badge when quantity === 1', () => {
    const { queryByText } = render(
      <MachineList machines={[panattaHigh]} onPressMachine={() => undefined} />,
    );
    expect(queryByText(/^x\d/)).toBeNull();
  });

  it('renders the photo count for each machine row', () => {
    const { getByText } = render(<MachineList machines={all} onPressMachine={() => undefined} />);
    expect(getByText('사진 2')).toBeTruthy();
    expect(getByText('사진 0')).toBeTruthy();
  });

  it('calls onPressMachine with the gym_machine id when a row is tapped', () => {
    const onPressMachine = jest.fn();
    const { getByRole } = render(<MachineList machines={all} onPressMachine={onPressMachine} />);
    fireEvent.press(getByRole('button', { name: /^Low Row/ }));
    expect(onPressMachine).toHaveBeenCalledWith('gm-2');
  });

  it('collapses a brand section when its header is tapped, hiding the rows', () => {
    const { getByRole, queryByRole } = render(
      <MachineList machines={all} onPressMachine={() => undefined} />,
    );
    fireEvent.press(getByRole('button', { name: 'Panatta 섹션 접기' }));
    expect(queryByRole('button', { name: /^High Row/ })).toBeNull();
    expect(queryByRole('button', { name: /^Low Row/ })).toBeNull();
    expect(queryByRole('button', { name: /^Lat Pull Down/ })).toBeTruthy();
  });

  it('expands a previously-collapsed brand section when its header is tapped again', () => {
    const { getByRole } = render(<MachineList machines={all} onPressMachine={() => undefined} />);
    fireEvent.press(getByRole('button', { name: 'Panatta 섹션 접기' }));
    fireEvent.press(getByRole('button', { name: 'Panatta 섹션 펼치기' }));
    expect(getByRole('button', { name: /^High Row/ })).toBeTruthy();
  });
});
