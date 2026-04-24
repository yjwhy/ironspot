import { photoKeys } from '../query-keys';

describe('photoKeys factory', () => {
  it('builds stable root key', () => {
    expect(photoKeys.all).toEqual(['photo']);
  });

  it('scopes list by gym machine id', () => {
    expect(photoKeys.list('gm1')).toEqual(['photo', 'list', 'gm1']);
  });

  it('scopes detail by photo id', () => {
    expect(photoKeys.detail('p1')).toEqual(['photo', 'detail', 'p1']);
  });
});
