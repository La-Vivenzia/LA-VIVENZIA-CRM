import { describe, expect, it } from 'vitest';

import {
  normalizeEmail,
  normalizeNameForMatching,
  normalizePhone,
  normalizeWebsiteUrl,
  parseInstagramHandle,
  websiteDomain,
} from 'src/modules/lv-capture/utils/normalize-input';

describe('normalizeWebsiteUrl', () => {
  it('adds a scheme to a bare domain', () => {
    expect(normalizeWebsiteUrl('acme.com')).toBe('https://acme.com');
  });

  it('strips www and a trailing slash', () => {
    expect(normalizeWebsiteUrl('https://www.acme.com/')).toBe('https://acme.com');
  });

  it('lowercases the host but preserves path case', () => {
    expect(normalizeWebsiteUrl('HTTPS://ACME.com/About')).toBe(
      'https://acme.com/About',
    );
  });

  it('drops tracking parameters so two captures collide', () => {
    expect(
      normalizeWebsiteUrl('https://acme.com/x?utm_source=ig&utm_medium=bio&id=7'),
    ).toBe('https://acme.com/x?id=7');
  });

  it('rejects a bare word that is not a domain', () => {
    expect(normalizeWebsiteUrl('villa')).toBeNull();
  });

  it('rejects blank input', () => {
    expect(normalizeWebsiteUrl('   ')).toBeNull();
    expect(normalizeWebsiteUrl(null)).toBeNull();
  });

  it('extracts the domain', () => {
    expect(websiteDomain(normalizeWebsiteUrl('https://www.acme.com/a'))).toBe(
      'acme.com',
    );
  });
});

describe('parseInstagramHandle', () => {
  it('accepts a bare handle', () => {
    expect(parseInstagramHandle('acme')).toBe('acme');
  });

  it('strips a leading @', () => {
    expect(parseInstagramHandle('@Acme_Cafe')).toBe('acme_cafe');
  });

  it('accepts a profile URL', () => {
    expect(parseInstagramHandle('https://www.instagram.com/acme/?hl=en')).toBe('acme');
  });

  it('accepts a scheme-less profile URL', () => {
    expect(parseInstagramHandle('instagram.com/acme')).toBe('acme');
  });

  it('returns null for a post URL, which identifies no account', () => {
    expect(parseInstagramHandle('https://instagram.com/p/Cxyz123/')).toBeNull();
  });

  it('returns null for a reel URL', () => {
    expect(parseInstagramHandle('https://instagram.com/reel/Cxyz123/')).toBeNull();
  });

  it('rejects a non-instagram host', () => {
    expect(parseInstagramHandle('https://facebook.com/acme')).toBeNull();
  });

  it('rejects handles with illegal characters', () => {
    expect(parseInstagramHandle('acme cafe')).toBeNull();
    expect(parseInstagramHandle('acme/cafe')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('lowercases a valid address', () => {
    expect(normalizeEmail('Tim@Apple.DEV')).toBe('tim@apple.dev');
  });

  it('rejects malformed addresses', () => {
    expect(normalizeEmail('tim@apple')).toBeNull();
    expect(normalizeEmail('tim apple.dev')).toBeNull();
    expect(normalizeEmail('@apple.dev')).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('assumes +91 for a bare 10-digit number', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
  });

  it('handles spaces, dashes and brackets', () => {
    expect(normalizePhone('(98765) 43-210')).toBe('+919876543210');
  });

  it('strips a national 0 prefix', () => {
    expect(normalizePhone('09876543210')).toBe('+919876543210');
  });

  it('keeps an explicit country code', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('does not double the country code', () => {
    expect(normalizePhone('919876543210')).toBe('+919876543210');
  });

  it('rejects numbers that are too short to be real', () => {
    expect(normalizePhone('12345')).toBeNull();
  });

  it('rejects text', () => {
    expect(normalizePhone('call me')).toBeNull();
  });
});

describe('normalizeNameForMatching', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeNameForMatching('The Forest Table!')).toBe('forest table');
  });

  it('removes business suffixes', () => {
    expect(normalizeNameForMatching('Acme Pvt Ltd')).toBe('acme');
  });

  it('folds accents so cafe and café match', () => {
    expect(normalizeNameForMatching('Café Bleu')).toBe(
      normalizeNameForMatching('Cafe Bleu'),
    );
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeNameForMatching(null)).toBe('');
  });
});
