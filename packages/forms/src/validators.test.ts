import { describe, expect, test } from 'bun:test';
import {
  required,
  email,
  url,
  date,
  phone,
  minLength,
  maxLength,
  min,
  max,
  pattern,
  number,
  integer,
  positive,
  custom,
  async as asyncValidator,
  matches,
  oneOf,
  notOneOf,
  fileSize,
  fileType,
  compose,
  when,
  v,
} from './validators';

describe('required', () => {
  const validate = required();

  test('fails on empty string', () => {
    expect(validate('')).toBe('This field is required');
  });

  test('fails on null', () => {
    expect(validate(null)).toBe('This field is required');
  });

  test('fails on undefined', () => {
    expect(validate(undefined)).toBe('This field is required');
  });

  test('fails on empty array', () => {
    expect(validate([])).toBe('This field is required');
  });

  test('passes on non-empty string', () => {
    expect(validate('hello')).toBeUndefined();
  });

  test('passes on number', () => {
    expect(validate(0)).toBeUndefined();
  });

  test('passes on non-empty array', () => {
    expect(validate([1])).toBeUndefined();
  });

  test('custom message', () => {
    expect(required('Name is required')('')).toBe('Name is required');
  });

  test('has _isRequired marker', () => {
    expect(validate._isRequired).toBe(true);
  });
});

describe('email', () => {
  const validate = email();

  test('valid emails', () => {
    expect(validate('test@example.com')).toBeUndefined();
    expect(validate('user+tag@domain.co')).toBeUndefined();
  });

  test('invalid emails', () => {
    expect(validate('notanemail')).toBe('Invalid email address');
    expect(validate('missing@')).toBe('Invalid email address');
    expect(validate('@domain.com')).toBe('Invalid email address');
  });

  test('skips empty values', () => {
    expect(validate('')).toBeUndefined();
  });
});

describe('url', () => {
  const validate = url();

  test('valid urls', () => {
    expect(validate('https://example.com')).toBeUndefined();
    expect(validate('http://localhost:3000')).toBeUndefined();
  });

  test('invalid urls', () => {
    expect(validate('not-a-url')).toBe('Invalid URL');
  });

  test('skips empty', () => {
    expect(validate('')).toBeUndefined();
  });
});

describe('date', () => {
  const validate = date();

  test('valid dates', () => {
    expect(validate('2024-01-15')).toBeUndefined();
    expect(validate('January 1, 2024')).toBeUndefined();
  });

  test('invalid dates', () => {
    expect(validate('not-a-date')).toBe('Invalid date');
  });

  test('skips empty', () => {
    expect(validate('')).toBeUndefined();
  });
});

describe('phone', () => {
  const validate = phone();

  test('valid phones', () => {
    expect(validate('+1 555-123-4567')).toBeUndefined();
    expect(validate('(555) 123-4567')).toBeUndefined();
    expect(validate('5551234567')).toBeUndefined();
  });

  test('invalid phones', () => {
    expect(validate('abc')).toBe('Invalid phone number');
    expect(validate('12')).toBe('Invalid phone number');
  });

  test('skips empty', () => {
    expect(validate('')).toBeUndefined();
  });
});

describe('minLength', () => {
  test('passes when length >= min', () => {
    expect(minLength(3)('abc')).toBeUndefined();
    expect(minLength(3)('abcd')).toBeUndefined();
  });

  test('fails when length < min', () => {
    expect(minLength(3)('ab')).toBe('Must be at least 3 characters');
  });

  test('custom message', () => {
    expect(minLength(3, 'Too short')('ab')).toBe('Too short');
  });

  test('skips empty', () => {
    expect(minLength(3)('')).toBeUndefined();
  });
});

describe('maxLength', () => {
  test('passes when length <= max', () => {
    expect(maxLength(3)('abc')).toBeUndefined();
    expect(maxLength(3)('ab')).toBeUndefined();
  });

  test('fails when length > max', () => {
    expect(maxLength(3)('abcd')).toBe('Must be at most 3 characters');
  });
});

describe('min', () => {
  test('passes when value >= min', () => {
    expect(min(5)(5)).toBeUndefined();
    expect(min(5)(10)).toBeUndefined();
  });

  test('fails when value < min', () => {
    expect(min(5)(3)).toBe('Must be at least 5');
  });

  test('skips empty', () => {
    expect(min(5)(null as any)).toBeUndefined();
    expect(min(5)('' as any)).toBeUndefined();
  });
});

describe('max', () => {
  test('passes when value <= max', () => {
    expect(max(10)(10)).toBeUndefined();
    expect(max(10)(5)).toBeUndefined();
  });

  test('fails when value > max', () => {
    expect(max(10)(15)).toBe('Must be at most 10');
  });
});

describe('pattern', () => {
  test('matches pattern', () => {
    expect(pattern(/^\d+$/)('123')).toBeUndefined();
  });

  test('fails when pattern does not match', () => {
    expect(pattern(/^\d+$/)('abc')).toBe('Invalid format');
  });

  test('custom message', () => {
    expect(pattern(/^\d+$/, 'Numbers only')('abc')).toBe('Numbers only');
  });
});

describe('number', () => {
  test('valid numbers', () => {
    expect(number()(42)).toBeUndefined();
    expect(number()('3.14')).toBeUndefined();
    expect(number()(0)).toBeUndefined();
  });

  test('invalid numbers', () => {
    expect(number()('abc')).toBe('Must be a number');
  });

  test('skips empty', () => {
    expect(number()('')).toBeUndefined();
    expect(number()(null)).toBeUndefined();
  });
});

describe('integer', () => {
  test('valid integers', () => {
    expect(integer()(42)).toBeUndefined();
    expect(integer()('10')).toBeUndefined();
  });

  test('invalid integers', () => {
    expect(integer()(3.14)).toBe('Must be an integer');
    expect(integer()('abc')).toBe('Must be an integer');
  });
});

describe('positive', () => {
  test('positive numbers pass', () => {
    expect(positive()(1)).toBeUndefined();
    expect(positive()(100)).toBeUndefined();
  });

  test('zero and negative fail', () => {
    expect(positive()(0)).toBe('Must be a positive number');
    expect(positive()(-1)).toBe('Must be a positive number');
  });
});

describe('custom', () => {
  test('runs custom function', () => {
    const validate = custom<string>((v) => (v === 'bad' ? 'Bad value' : undefined));
    expect(validate('bad')).toBe('Bad value');
    expect(validate('good')).toBeUndefined();
  });
});

describe('async', () => {
  test('returns async validator with marker', () => {
    const validate = asyncValidator(async (v) => (v === 'taken' ? 'Already taken' : undefined));
    expect(validate._isAsync).toBe(true);
  });

  test('async validator executes', async () => {
    const validate = asyncValidator<string>(async (v) => (v === 'taken' ? 'Already taken' : undefined));
    expect(await validate('taken')).toBe('Already taken');
    expect(await validate('available')).toBeUndefined();
  });

  test('debounce option sets _debounce', () => {
    const validate = asyncValidator(async () => undefined, { debounce: 500 });
    expect(validate._debounce).toBe(500);
  });
});

describe('matches', () => {
  test('matches when values equal', () => {
    const validate = matches('password');
    const context = {
      getValue: (path: string) => (path === 'password' ? 'secret' : undefined),
      getValues: () => ({ password: 'secret' }),
    };
    expect(validate('secret', context)).toBeUndefined();
  });

  test('fails when values differ', () => {
    const validate = matches('password');
    const context = {
      getValue: (path: string) => (path === 'password' ? 'secret' : undefined),
      getValues: () => ({ password: 'secret' }),
    };
    expect(validate('different', context)).toBe('Must match password');
  });

  test('has _crossField marker', () => {
    expect(matches('other')._crossField).toBe(true);
  });
});

describe('oneOf', () => {
  test('passes when value is in list', () => {
    expect(oneOf(['a', 'b', 'c'])('b')).toBeUndefined();
  });

  test('fails when value not in list', () => {
    expect(oneOf(['a', 'b', 'c'])('d')).toBe('Must be one of: a, b, c');
  });
});

describe('notOneOf', () => {
  test('passes when value not in list', () => {
    expect(notOneOf(['a', 'b'])('c')).toBeUndefined();
  });

  test('fails when value in list', () => {
    expect(notOneOf(['a', 'b'])('a')).toBe('Must not be one of: a, b');
  });
});

describe('compose', () => {
  test('runs validators in order, stops on first error', async () => {
    const validate = compose(
      required(),
      minLength(3),
      maxLength(10)
    );
    expect(await validate('')).toBe('This field is required');
    expect(await validate('ab')).toBe('Must be at least 3 characters');
    expect(await validate('abc')).toBeUndefined();
  });

  test('preserves markers', () => {
    const validate = compose(required(), asyncValidator(async () => undefined));
    expect(validate._isRequired).toBe(true);
    expect(validate._isAsync).toBe(true);
  });

  test('propagates _debounce from rules', () => {
    const validate = compose(
      required(),
      asyncValidator(async () => undefined, { debounce: 500 })
    );
    expect(validate._debounce).toBe(500);
  });

  test('uses max debounce from multiple async rules', () => {
    const validate = compose(
      asyncValidator(async () => undefined, { debounce: 200 }),
      asyncValidator(async () => undefined, { debounce: 800 })
    );
    expect(validate._debounce).toBe(800);
  });

  test('no _debounce when no async rules have debounce', () => {
    const validate = compose(required(), minLength(3));
    expect(validate._debounce).toBeUndefined();
  });
});

describe('when', () => {
  test('applies rule when condition is true', async () => {
    const validate = when<string>((v) => v.length > 0, minLength(3));
    expect(await validate('ab')).toBe('Must be at least 3 characters');
  });

  test('skips rule when condition is false', async () => {
    const validate = when<string>((v) => v.length > 0, minLength(3));
    expect(await validate('')).toBeUndefined();
  });
});

describe('v (short alias)', () => {
  test('has all validators', () => {
    expect(v.required).toBe(required);
    expect(v.email).toBe(email);
    expect(v.url).toBe(url);
    expect(v.minLength).toBe(minLength);
    expect(v.maxLength).toBe(maxLength);
    expect(v.min).toBe(min);
    expect(v.max).toBe(max);
    expect(v.pattern).toBe(pattern);
    expect(v.compose).toBe(compose);
    expect(v.when).toBe(when);
  });
});
