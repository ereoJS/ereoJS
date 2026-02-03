// @bun
import{jsxDEV as e}from"react/jsx-dev-runtime";var o={"getting-started-with-areo":{slug:"getting-started-with-areo",title:"Getting Started with Areo",content:`
Areo is a React fullstack framework built on Bun that prioritizes simplicity,
performance, and developer experience.

## Installation

\`\`\`bash
bunx create-areo my-app
cd my-app
bun run dev
\`\`\`

## Key Features

- **File-based routing** - Just create files in \`app/routes\`
- **Data loading** - Simple \`loader\` and \`action\` pattern
- **Islands architecture** - Selective hydration for optimal performance
- **Bun-first** - 5-6x faster than Node.js

Get started today!
    `.trim(),date:"2024-01-15",author:"Areo Team"},"islands-architecture":{slug:"islands-architecture",title:"Understanding Islands Architecture",content:`
Islands architecture lets you choose exactly which components need JavaScript.

## How It Works

By default, components render as static HTML. Add hydration directives to make them interactive:

\`\`\`tsx
<SearchBar client:load />      // Hydrate immediately
<Comments client:visible />    // Hydrate when visible
<Chart client:idle />          // Hydrate when browser is idle
\`\`\`

## Benefits

- **Faster page loads** - Less JavaScript to download
- **Better performance** - Only hydrate what needs interactivity
- **SEO friendly** - Static HTML for search engines
    `.trim(),date:"2024-01-10",author:"Areo Team"},"bun-performance":{slug:"bun-performance",title:"Why Bun Makes Areo Fast",content:`
Bun is a new JavaScript runtime that's significantly faster than Node.js.

## Performance Benefits

- **5-6x faster HTTP server** - Bun.serve() is incredibly fast
- **Native bundling** - No need for Webpack or Vite
- **Built-in TypeScript** - Zero-config TypeScript support
- **Fast file I/O** - Native system calls

## Real-World Impact

With Areo on Bun, you get:

- Sub-100ms HMR updates
- Fast production builds
- Lower server costs
- Better developer experience
    `.trim(),date:"2024-01-05",author:"Areo Team"}};async function n({params:a,context:t}){let r=o[a.slug];if(!r)throw new Response("Not Found",{status:404});return t.cache.set({maxAge:300,tags:[`post:${a.slug}`]}),{post:r}}function s({loaderData:a}){let{post:t}=a;return e("article",{className:"max-w-2xl mx-auto",children:[e("header",{className:"mb-8",children:[e("h1",{className:"text-4xl font-bold text-gray-900 dark:text-white mb-4",children:t.title},void 0,!1,void 0,this),e("div",{className:"flex items-center gap-4 text-gray-600 dark:text-gray-400",children:[e("span",{children:t.author},void 0,!1,void 0,this),e("span",{children:"\u2022"},void 0,!1,void 0,this),e("time",{children:new Date(t.date).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})},void 0,!1,void 0,this)]},void 0,!0,void 0,this)]},void 0,!0,void 0,this),e("div",{className:"prose prose-lg dark:prose-invert",children:e("pre",{className:"whitespace-pre-wrap text-gray-700 dark:text-gray-300",children:t.content},void 0,!1,void 0,this)},void 0,!1,void 0,this),e("footer",{className:"mt-12 pt-8 border-t border-gray-200 dark:border-gray-700",children:e("a",{href:"/blog",className:"text-blue-600 dark:text-blue-400 hover:underline",children:"\u2190 Back to all posts"},void 0,!1,void 0,this)},void 0,!1,void 0,this)]},void 0,!0,void 0,this)}export{n as loader,s as default};

//# debugId=1F5CDC5EB784DF0E64756E2164756E21
