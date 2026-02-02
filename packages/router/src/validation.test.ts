/**
 * @oreo/router - Validation Tests
 */

import { describe, it, expect } from 'bun:test';
import {
  ParamValidationError,
  validators,
  validateParams,
  safeValidateParams,
  validateSearchParams,
  createRouteValidator,
  matchParamPattern,
  extractParamNames,
} from './validation';

describe('validators.string', () => {
  it('should parse valid strings', () => {
    const validator = validators.string();
    expect(validator.parse('hello')).toBe('hello');
  });

  it('should throw on undefined', () => {
    const validator = validators.string();
    expect(() => validator.parse(undefined)).toThrow(ParamValidationError);
  });

  it('should handle array values (take first)', () => {
    const validator = validators.string();
    expect(validator.parse(['hello', 'world'])).toBe('hello');
  });

  it('should enforce min length', () => {
    const validator = validators.string({ min: 5 });
    expect(() => validator.parse('hi')).toThrow('too short');
    expect(validator.parse('hello')).toBe('hello');
  });

  it('should enforce max length', () => {
    const validator = validators.string({ max: 5 });
    expect(() => validator.parse('hello world')).toThrow('too long');
    expect(validator.parse('hello')).toBe('hello');
  });

  it('should enforce regex pattern', () => {
    const validator = validators.string({ regex: /^[a-z-]+$/ });
    expect(validator.parse('hello-world')).toBe('hello-world');
    expect(() => validator.parse('HelloWorld')).toThrow('pattern');
  });
});

describe('validators.number', () => {
  it('should parse valid numbers', () => {
    const validator = validators.number();
    expect(validator.parse('42')).toBe(42);
    expect(validator.parse('3.14')).toBe(3.14);
  });

  it('should throw on non-numeric strings', () => {
    const validator = validators.number();
    expect(() => validator.parse('not-a-number')).toThrow('must be a number');
  });

  it('should enforce integer constraint', () => {
    const validator = validators.number({ integer: true });
    expect(validator.parse('42')).toBe(42);
    expect(() => validator.parse('3.14')).toThrow('integer');
  });

  it('should enforce min/max', () => {
    const validator = validators.number({ min: 0, max: 100 });
    expect(() => validator.parse('-5')).toThrow('too small');
    expect(() => validator.parse('150')).toThrow('too large');
    expect(validator.parse('50')).toBe(50);
  });
});

describe('validators.int', () => {
  it('should parse integers', () => {
    const validator = validators.int();
    expect(validator.parse('42')).toBe(42);
  });

  it('should reject floats', () => {
    const validator = validators.int();
    expect(() => validator.parse('3.14')).toThrow('integer');
  });

  it('should enforce min/max', () => {
    const validator = validators.int({ min: 1, max: 10 });
    expect(validator.parse('5')).toBe(5);
    expect(() => validator.parse('0')).toThrow('too small');
  });
});

describe('validators.boolean', () => {
  it('should parse true values', () => {
    const validator = validators.boolean();
    expect(validator.parse('true')).toBe(true);
    expect(validator.parse('1')).toBe(true);
    expect(validator.parse('yes')).toBe(true);
    expect(validator.parse('TRUE')).toBe(true);
  });

  it('should parse false values', () => {
    const validator = validators.boolean();
    expect(validator.parse('false')).toBe(false);
    expect(validator.parse('0')).toBe(false);
    expect(validator.parse('no')).toBe(false);
  });

  it('should throw on invalid values', () => {
    const validator = validators.boolean();
    expect(() => validator.parse('maybe')).toThrow('boolean');
  });
});

describe('validators.enum', () => {
  it('should parse valid enum values', () => {
    const validator = validators.enum(['a', 'b', 'c']);
    expect(validator.parse('a')).toBe('a');
    expect(validator.parse('b')).toBe('b');
  });

  it('should throw on invalid values', () => {
    const validator = validators.enum(['a', 'b', 'c']);
    expect(() => validator.parse('d')).toThrow('one of');
  });
});

describe('validators.array', () => {
  it('should parse arrays', () => {
    const validator = validators.array(validators.string());
    expect(validator.parse(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('should wrap single values', () => {
    const validator = validators.array(validators.string());
    expect(validator.parse('a')).toEqual(['a']);
  });

  it('should return empty array for undefined', () => {
    const validator = validators.array(validators.string());
    expect(validator.parse(undefined)).toEqual([]);
  });
});

describe('validators.optional', () => {
  it('should parse valid values', () => {
    const validator = validators.optional(validators.string());
    expect(validator.parse('hello')).toBe('hello');
  });

  it('should return undefined for missing values', () => {
    const validator = validators.optional(validators.string());
    expect(validator.parse(undefined)).toBeUndefined();
  });
});

describe('validators.default', () => {
  it('should parse valid values', () => {
    const validator = validators.default(validators.string(), 'default');
    expect(validator.parse('hello')).toBe('hello');
  });

  it('should use default for missing values', () => {
    const validator = validators.default(validators.string(), 'default');
    expect(validator.parse(undefined)).toBe('default');
  });
});

describe('validateParams', () => {
  it('should validate all params', () => {
    const schema = {
      slug: validators.string({ regex: /^[a-z-]+$/ }),
      id: validators.int({ min: 1 }),
    };

    const result = validateParams({ slug: 'hello-world', id: '42' }, schema);
    expect(result.slug).toBe('hello-world');
    expect(result.id).toBe(42);
  });

  it('should throw on first validation error', () => {
    const schema = {
      slug: validators.string(),
      id: validators.int(),
    };

    expect(() => validateParams({ slug: 'test', id: 'invalid' }, schema)).toThrow(
      ParamValidationError
    );
  });

  it('should handle missing params', () => {
    const schema = {
      required: validators.string(),
    };

    expect(() => validateParams({}, schema)).toThrow('Value is required');
  });
});

describe('safeValidateParams', () => {
  it('should return success for valid params', () => {
    const schema = {
      slug: validators.string(),
    };

    const result = safeValidateParams({ slug: 'test' }, schema);
    expect(result.valid).toBe(true);
    expect(result.data?.slug).toBe('test');
  });

  it('should return failure for invalid params', () => {
    const schema = {
      id: validators.int(),
    };

    const result = safeValidateParams({ id: 'invalid' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('validateSearchParams', () => {
  it('should validate from URLSearchParams', () => {
    const schema = {
      page: validators.default(validators.int({ min: 1 }), 1),
      search: validators.optional(validators.string()),
    };

    const params = new URLSearchParams('page=2&search=hello');
    const result = validateSearchParams(params, schema);
    expect(result.page).toBe(2);
    expect(result.search).toBe('hello');
  });

  it('should use defaults for missing params', () => {
    const schema = {
      page: validators.default(validators.int({ min: 1 }), 1),
      limit: validators.default(validators.int(), 20),
    };

    const result = validateSearchParams('', schema);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should validate from string', () => {
    const schema = {
      filter: validators.enum(['all', 'active', 'inactive']),
    };

    const result = validateSearchParams('filter=active', schema);
    expect(result.filter).toBe('active');
  });
});

describe('createRouteValidator', () => {
  it('should validate both params and search params', () => {
    const validator = createRouteValidator({
      params: {
        slug: validators.string(),
      },
      searchParams: {
        page: validators.default(validators.int(), 1),
      },
    });

    const result = validator.validate({ slug: 'hello' }, 'page=2');
    expect(result.params.slug).toBe('hello');
    expect(result.searchParams.page).toBe(2);
  });

  it('should support safe validation', () => {
    const validator = createRouteValidator({
      params: {
        id: validators.int(),
      },
    });

    const result = validator.safeValidate({ id: 'not-a-number' }, '');
    expect(result.valid).toBe(false);
  });
});

describe('matchParamPattern', () => {
  it('should match static segments', () => {
    expect(matchParamPattern('blog', 'blog')).toBe(true);
    expect(matchParamPattern('blog', 'about')).toBe(false);
  });

  it('should match dynamic params', () => {
    expect(matchParamPattern('[slug]', 'hello-world')).toBe(true);
    expect(matchParamPattern('[slug]', 'hello/world')).toBe(false);
  });

  it('should match optional params', () => {
    expect(matchParamPattern('[[page]]', '2')).toBe(true);
    expect(matchParamPattern('[[page]]', '')).toBe(true);
  });

  it('should match catch-all params', () => {
    expect(matchParamPattern('[...path]', 'a/b/c')).toBe(true);
  });
});

describe('extractParamNames', () => {
  it('should extract simple params', () => {
    expect(extractParamNames('/blog/[slug]')).toEqual(['slug']);
  });

  it('should extract multiple params', () => {
    expect(extractParamNames('/blog/[category]/[slug]')).toEqual(['category', 'slug']);
  });

  it('should extract catch-all params', () => {
    expect(extractParamNames('/docs/[...path]')).toEqual(['path']);
  });

  it('should extract optional params', () => {
    expect(extractParamNames('/blog/[[page]]')).toEqual(['page']);
  });
});
