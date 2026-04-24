import { gymKeys } from '../query-keys';

describe('gymKeys factory', () => {
  it('builds stable root key', () => {
    expect(gymKeys.all).toEqual(['gym']);
  });

  it('scopes details under root', () => {
    expect(gymKeys.details()).toEqual(['gym', 'detail']);
  });

  it('scopes a single gym detail under details', () => {
    expect(gymKeys.detail('g1')).toEqual(['gym', 'detail', 'g1']);
  });

  it('scopes machines under the specific gym detail', () => {
    expect(gymKeys.machines('g1')).toEqual(['gym', 'detail', 'g1', 'machines']);
  });
});
