/**
 * @oreo/client-sdk - Main exports
 */

export {
  ApiClient,
  createClient,
  getGlobalClient,
  configureClient,
  api,
} from './client';

export type {
  HttpMethod,
  ApiRoutes,
  ApiPaths,
  MethodsFor,
  RequestBody,
  ResponseType,
  QueryParams,
  PathParams,
  ApiRequestConfig,
  ApiResponse,
  ApiError,
  ClientConfig,
  DefineApiTypes,
} from './types';
