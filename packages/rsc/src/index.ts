/**
 * @ereo/rsc - Main exports
 */

export {
  serializeRSC,
  parseRSCStream,
  isServerComponent,
  isClientComponent,
  createRSCRenderConfig,
  markAsServerComponent,
  markAsClientComponent,
  SERVER_COMPONENT,
  CLIENT_COMPONENT,
} from './rsc';

export type {
  RSCConfig,
  RSCChunk,
  MarkedComponent,
} from './rsc';
