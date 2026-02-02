/**
 * @areo/router-conventions - Main exports
 */

export {
  parseConvention,
  conventionToRouteConfig,
  hasConvention,
  stripConvention,
  applyConventionConfig,
  getConventionPatterns,
  CONVENTION_SUFFIXES,
} from './conventions';

export type {
  ConventionInfo,
} from './conventions';

// Integration with router
export { integrateConventions } from './integration';
