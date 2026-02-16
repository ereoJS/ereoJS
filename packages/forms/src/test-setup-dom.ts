// Save Bun's native Web API classes before happy-dom overwrites them.
// happy-dom's implementations don't fully support server-side patterns
// (e.g., Request.formData() for URL-encoded bodies, FormData boundary headers).
const NativeRequest = globalThis.Request;
const NativeResponse = globalThis.Response;
const NativeFormData = globalThis.FormData;
const NativeHeaders = globalThis.Headers;
const NativeURL = globalThis.URL;
const NativeURLSearchParams = globalThis.URLSearchParams;
const nativeFetch = globalThis.fetch;
const NativeFile = globalThis.File;
const NativeBlob = globalThis.Blob;

import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

// Restore Bun's native Web API classes (they work correctly for server-side tests)
globalThis.Request = NativeRequest;
globalThis.Response = NativeResponse;
globalThis.FormData = NativeFormData;
globalThis.Headers = NativeHeaders;
globalThis.URL = NativeURL;
globalThis.URLSearchParams = NativeURLSearchParams;
globalThis.fetch = nativeFetch;
globalThis.File = NativeFile;
globalThis.Blob = NativeBlob;

