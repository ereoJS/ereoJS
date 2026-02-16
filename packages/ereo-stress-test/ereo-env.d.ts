import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicAttributes {
      /** Hydrate island immediately on page load */
      'client:load'?: boolean;
      /** Hydrate island when browser is idle */
      'client:idle'?: boolean;
      /** Hydrate island when element becomes visible */
      'client:visible'?: boolean;
      /** Hydrate island when media query matches */
      'client:media'?: string;
    }
  }
}
