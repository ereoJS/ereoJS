/**
 * Tests for Drizzle type definitions.
 */

import { describe, it, expect } from 'bun:test';
import { EDGE_COMPATIBLE_DRIVERS } from './types';

describe('EDGE_COMPATIBLE_DRIVERS', () => {
  it('should mark postgres-js as not edge compatible', () => {
    expect(EDGE_COMPATIBLE_DRIVERS['postgres-js']).toBe(false);
  });

  it('should mark neon-http as edge compatible', () => {
    expect(EDGE_COMPATIBLE_DRIVERS['neon-http']).toBe(true);
  });

  it('should mark neon-websocket as edge compatible', () => {
    expect(EDGE_COMPATIBLE_DRIVERS['neon-websocket']).toBe(true);
  });

  it('should mark planetscale as edge compatible', () => {
    expect(EDGE_COMPATIBLE_DRIVERS['planetscale']).toBe(true);
  });

  it('should mark libsql as edge compatible', () => {
    expect(EDGE_COMPATIBLE_DRIVERS['libsql']).toBe(true);
  });

  it('should mark bun-sqlite as not edge compatible', () => {
    expect(EDGE_COMPATIBLE_DRIVERS['bun-sqlite']).toBe(false);
  });

  it('should mark better-sqlite3 as not edge compatible', () => {
    expect(EDGE_COMPATIBLE_DRIVERS['better-sqlite3']).toBe(false);
  });

  it('should mark d1 as edge compatible', () => {
    expect(EDGE_COMPATIBLE_DRIVERS['d1']).toBe(true);
  });

  it('should cover all drivers', () => {
    const expectedDrivers = [
      'postgres-js',
      'neon-http',
      'neon-websocket',
      'planetscale',
      'libsql',
      'bun-sqlite',
      'better-sqlite3',
      'd1',
    ];

    for (const driver of expectedDrivers) {
      expect(EDGE_COMPATIBLE_DRIVERS).toHaveProperty(driver);
    }
  });
});
