import { describe, expect, it } from 'vitest';

import { normalizeEmail, normalizePhone, parseRawMessage } from 'src/api/capture';

// parseRawMessage — parsing pasted chats, enquiries and emails into draft fields.
//
// These tests exercise the parser rules:
// - WhatsApp header formats (iOS bracketed, Android hyphenated, 12h am/pm, 24h, Unicode spaces)
// - Word-boundary label matching (preventing substrings like 'replace' or 'hotel' matching labels)
// - Preservation of names containing keyword fragments (e.g. 'Theresa' containing 'here')
// - Unicode and Devanagari name support
// - Contact details and requirements extraction

describe('normalizePhone', () => {
  it('normalises 10-digit Indian numbers with +91', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('98765-43210')).toBe('+919876543210');
  });

  it('normalises 0-prefixed 11-digit numbers', () => {
    expect(normalizePhone('09876543210')).toBe('+919876543210');
  });

  it('preserves existing +91 country codes', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhone('+919876543210')).toBe('+919876543210');
  });

  it('returns null for empty or invalid phone strings', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('extracts and lowercases valid email addresses', () => {
    expect(normalizeEmail('Test.User@Example.Com')).toBe('test.user@example.com');
    expect(normalizeEmail('Reach me at rahul@wildnest.in for details')).toBe('rahul@wildnest.in');
  });

  it('returns null when no valid email exists', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('not-an-email')).toBeNull();
  });
});

describe('parseRawMessage', () => {
  describe('WhatsApp timestamp and sender parsing', () => {
    it('supports iOS format with lowercase am/pm', () => {
      const msg = '[24/10/26, 2:45 pm] Rajesh Sharma: Hi team, looking for a villa in Lonavala. Contact: 9876543210';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Rajesh Sharma');
      expect(result.phone).toBe('+919876543210');
      expect(result.location).toBe('Lonavala');
    });

    it('supports iOS format with uppercase AM/PM and narrow space', () => {
      const msg = '[10/24/2026, 11:30\u202FAM] Vikram Patel: Looking for stay in Goa, email vikram@example.com';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Vikram Patel');
      expect(result.email).toBe('vikram@example.com');
      expect(result.location).toBe('Goa');
    });

    it('supports iOS format with seconds', () => {
      const msg = '[12/09/26, 09:15:32 pm] Ananya Roy: Interested in 2BHK in Alibaug. Phone: +91 98111 22334';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Ananya Roy');
      expect(result.phone).toBe('+919811122334');
      expect(result.location).toBe('Alibaug');
    });

    it('supports Android format with am/pm before hyphen', () => {
      const msg = '24/10/26, 2:45 pm - Amit Verma: Need a 3BHK villa in North Goa for Dec. Call 9822012345';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Amit Verma');
      expect(result.phone).toBe('+919822012345');
      expect(result.location).toBe('North Goa');
    });

    it('supports Android format with 24-hour time', () => {
      const msg = '24/10/2026, 14:45 - Sunita Rao: Enquiry for homestay near Pune. Contact: sunita@example.com';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Sunita Rao');
      expect(result.email).toBe('sunita@example.com');
      expect(result.location).toBe('Pune');
    });

    it('extracts phone number when sender is a phone number in header', () => {
      const msg = '[24/10/26, 2:45 pm] +91 98765 43210: Hi, I am looking for a villa in Lonavala.';
      const result = parseRawMessage(msg);

      expect(result.phone).toBe('+919876543210');
      expect(result.location).toBe('Lonavala');
    });
  });

  describe('name preservation (edge cases like Theresa)', () => {
    it('preserves names containing "here" such as Theresa', () => {
      const msg = 'Name: Theresa Mendonca\nPhone: 9876543210\nLocation: Goa\nRequirements: 3BHK villa';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Theresa Mendonca');
    });

    it('preserves single-word name Theresa from WhatsApp header', () => {
      const msg = '[24/10/26, 2:45 pm] Theresa: Looking for a luxury villa in Goa. Phone: 9876543210';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Theresa');
    });

    it('preserves names containing fragments like "from" or "looking" or "contact"', () => {
      const msg = 'Name: Catherine Frommer\nContact: 9876543210\nCity: Mumbai';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Catherine Frommer');
    });

    it('strips actual trailing clauses like "here, looking for" when separate words', () => {
      const msg = '[24/10/26, 2:45 pm] Rajesh here, looking for a villa in Goa: please call 9876543210';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Rajesh');
    });
  });

  describe('Unicode and Devanagari name support', () => {
    it('extracts Devanagari names from labeled input', () => {
      const msg = 'Name: राजेश शर्मा\nPhone: 9876543210\nLocation: Mumbai';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('राजेश शर्मा');
      expect(result.phone).toBe('+919876543210');
      expect(result.location).toBe('Mumbai');
    });

    it('extracts Devanagari names from WhatsApp header', () => {
      const msg = '24/10/26, 11:30 am - प्रियंका पाटिल: नमस्ते, लोनावला में विला चाहिए। फोन 9822012345';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('प्रियंका पाटिल');
      expect(result.phone).toBe('+919822012345');
    });

    it('extracts Devanagari names with matras and conjuncts', () => {
      const msg = 'Name: अमित कुमार\nContact: 9876501234\nCity: Pune';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('अमित कुमार');
    });

    it('supports accented European names', () => {
      const msg = 'Name: Renée Müller\nEmail: renee@example.ch\nPhone: +41 79 123 4567';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Renée Müller');
      expect(result.email).toBe('renee@example.ch');
    });
  });

  describe('safe word-boundary label matching', () => {
    it('does not match "place:" inside words like "replace:" as location', () => {
      const msg = 'Notes: Need to replace: the battery.\nLocation: Bangalore\nPhone: 9876543210';
      const result = parseRawMessage(msg);

      expect(result.location).toBe('Bangalore');
    });

    it('does not match "tel:" inside words like "hotel:" as phone label', () => {
      const msg = 'Hotel: Grand Hyatt Goa\nPhone: 9876543210\nName: Rohan Gupta';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Rohan Gupta');
      expect(result.phone).toBe('+919876543210');
    });

    it('does not match "name:" inside words like "rename:" or "username:" as name label', () => {
      const msg = 'Username: rohan_g\nName: Rohan Gupta\nPhone: 9876543210';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Rohan Gupta');
    });

    it('extracts labeled requirements properly with word boundaries', () => {
      const msg = 'Name: Neha Shah\nPhone: 9876543210\nRequirements: 4BHK sea facing villa in Goa for New Year';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Neha Shah');
      expect(result.requirements).toBe('4BHK sea facing villa in Goa for New Year');
    });
  });

  describe('signoff and intro name detection', () => {
    it('extracts name from self-introduction', () => {
      const msg = 'Hi team, I am Vikram Singhania looking for a property in Pune. Reach me at 9876543210.';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Vikram Singhania');
      expect(result.location).toBe('Pune');
    });

    it('extracts name from email signoff', () => {
      const msg = 'Hi,\nWe need a conference venue near Bangalore for 50 people.\n\nThanks and regards,\nTheresa DSouza\nPhone: 9876543210';
      const result = parseRawMessage(msg);

      expect(result.name).toBe('Theresa DSouza');
      expect(result.location).toBe('Bangalore');
      expect(result.phone).toBe('+919876543210');
    });
  });
});
