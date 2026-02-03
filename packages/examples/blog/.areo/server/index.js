// @bun
var V=Object.defineProperty;var K=(q,k)=>{for(var J in k)V(q,J,{get:k[J],enumerable:!0,configurable:!0,set:(U)=>k[J]=()=>U})};var L={};K(L,{loader:()=>X,default:()=>Y});import{jsxDEV as H}from"react/jsx-dev-runtime";var W=[{slug:"getting-started-with-areo",title:"Getting Started with Areo",excerpt:"Learn how to build modern web apps with the Areo framework.",date:"2024-01-15"},{slug:"islands-architecture",title:"Understanding Islands Architecture",excerpt:"How selective hydration makes your apps faster.",date:"2024-01-10"},{slug:"bun-performance",title:"Why Bun Makes Areo Fast",excerpt:"Explore the performance benefits of building on Bun.",date:"2024-01-05"}];async function X({context:q}){return q.cache.set({maxAge:60,tags:["posts"]}),{posts:W}}function Y({loaderData:q}){return H("div",{children:[H("h1",{className:"text-3xl font-bold text-gray-900 dark:text-white mb-8",children:"All Posts"},void 0,!1,void 0,this),H("div",{className:"space-y-6",children:q.posts.map((k)=>H("article",{className:"bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6",children:[H("a",{href:`/blog/${k.slug}`,children:H("h2",{className:"text-xl font-semibold text-gray-900 dark:text-white mb-2 hover:text-blue-600",children:k.title},void 0,!1,void 0,this)},void 0,!1,void 0,this),H("p",{className:"text-gray-600 dark:text-gray-300 mb-4",children:k.excerpt},void 0,!1,void 0,this),H("time",{className:"text-sm text-gray-500",children:new Date(k.date).toLocaleDateString()},void 0,!1,void 0,this)]},k.slug,!0,void 0,this))},void 0,!1,void 0,this)]},void 0,!0,void 0,this)}var N={};K(N,{default:()=>Z});import{jsxDEV as w}from"react/jsx-dev-runtime";function Z({children:q}){return w("html",{lang:"en",children:[w("head",{children:[w("meta",{charSet:"utf-8"},void 0,!1,void 0,this),w("meta",{name:"viewport",content:"width=device-width, initial-scale=1"},void 0,!1,void 0,this),w("title",{children:"Areo Blog"},void 0,!1,void 0,this),w("link",{rel:"stylesheet",href:"/__tailwind.css"},void 0,!1,void 0,this)]},void 0,!0,void 0,this),w("body",{className:"min-h-screen bg-gray-50 dark:bg-gray-900",children:[w("header",{className:"bg-white dark:bg-gray-800 shadow-sm",children:w("nav",{className:"max-w-4xl mx-auto px-4 py-4",children:w("div",{className:"flex justify-between items-center",children:[w("a",{href:"/",className:"text-xl font-bold text-gray-900 dark:text-white",children:"Areo Blog"},void 0,!1,void 0,this),w("div",{className:"flex gap-4",children:[w("a",{href:"/",className:"text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white",children:"Home"},void 0,!1,void 0,this),w("a",{href:"/blog",className:"text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white",children:"Blog"},void 0,!1,void 0,this)]},void 0,!0,void 0,this)]},void 0,!0,void 0,this)},void 0,!1,void 0,this)},void 0,!1,void 0,this),w("main",{className:"max-w-4xl mx-auto px-4 py-8",children:q},void 0,!1,void 0,this),w("footer",{className:"max-w-4xl mx-auto px-4 py-8 text-center text-gray-500 dark:text-gray-400",children:"Built with Areo Framework"},void 0,!1,void 0,this)]},void 0,!0,void 0,this)]},void 0,!0,void 0,this)}var O={};K(O,{loader:()=>P,default:()=>y});import{jsxDEV as G}from"react/jsx-dev-runtime";var $={"getting-started-with-areo":{slug:"getting-started-with-areo",title:"Getting Started with Areo",content:`
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
    `.trim(),date:"2024-01-05",author:"Areo Team"}};async function P({params:q,context:k}){let J=$[q.slug];if(!J)throw new Response("Not Found",{status:404});return k.cache.set({maxAge:300,tags:[`post:${q.slug}`]}),{post:J}}function y({loaderData:q}){let{post:k}=q;return G("article",{className:"max-w-2xl mx-auto",children:[G("header",{className:"mb-8",children:[G("h1",{className:"text-4xl font-bold text-gray-900 dark:text-white mb-4",children:k.title},void 0,!1,void 0,this),G("div",{className:"flex items-center gap-4 text-gray-600 dark:text-gray-400",children:[G("span",{children:k.author},void 0,!1,void 0,this),G("span",{children:"\u2022"},void 0,!1,void 0,this),G("time",{children:new Date(k.date).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})},void 0,!1,void 0,this)]},void 0,!0,void 0,this)]},void 0,!0,void 0,this),G("div",{className:"prose prose-lg dark:prose-invert",children:G("pre",{className:"whitespace-pre-wrap text-gray-700 dark:text-gray-300",children:k.content},void 0,!1,void 0,this)},void 0,!1,void 0,this),G("footer",{className:"mt-12 pt-8 border-t border-gray-200 dark:border-gray-700",children:G("a",{href:"/blog",className:"text-blue-600 dark:text-blue-400 hover:underline",children:"\u2190 Back to all posts"},void 0,!1,void 0,this)},void 0,!1,void 0,this)]},void 0,!0,void 0,this)}var Q={};K(Q,{loader:()=>M,default:()=>R});import{jsxDEV as z}from"react/jsx-dev-runtime";var F=[{slug:"getting-started-with-areo",title:"Getting Started with Areo",excerpt:"Learn how to build modern web apps with the Areo framework.",date:"2024-01-15"},{slug:"islands-architecture",title:"Understanding Islands Architecture",excerpt:"How selective hydration makes your apps faster.",date:"2024-01-10"},{slug:"bun-performance",title:"Why Bun Makes Areo Fast",excerpt:"Explore the performance benefits of building on Bun.",date:"2024-01-05"}];async function M({request:q,context:k}){return k.cache.set({maxAge:60,staleWhileRevalidate:300,tags:["posts"]}),{posts:F}}function R({loaderData:q}){return z("div",{children:[z("section",{className:"text-center py-12",children:[z("h1",{className:"text-4xl font-bold text-gray-900 dark:text-white mb-4",children:"Welcome to Areo Blog"},void 0,!1,void 0,this),z("p",{className:"text-lg text-gray-600 dark:text-gray-300",children:"A blog built with Areo - the React fullstack framework."},void 0,!1,void 0,this)]},void 0,!0,void 0,this),z("section",{children:[z("h2",{className:"text-2xl font-bold text-gray-900 dark:text-white mb-6",children:"Latest Posts"},void 0,!1,void 0,this),z("div",{className:"space-y-6",children:q.posts.map((k)=>z("article",{className:"bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow",children:[z("a",{href:`/blog/${k.slug}`,children:z("h3",{className:"text-xl font-semibold text-gray-900 dark:text-white mb-2 hover:text-blue-600 dark:hover:text-blue-400",children:k.title},void 0,!1,void 0,this)},void 0,!1,void 0,this),z("p",{className:"text-gray-600 dark:text-gray-300 mb-4",children:k.excerpt},void 0,!1,void 0,this),z("time",{className:"text-sm text-gray-500 dark:text-gray-400",children:new Date(k.date).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})},void 0,!1,void 0,this)]},k.slug,!0,void 0,this))},void 0,!1,void 0,this)]},void 0,!0,void 0,this)]},void 0,!0,void 0,this)}var S=[{id:"/blog/index",path:"/blog",module:L,index:!0,layout:!1},{id:"/_layout",path:"/",module:N,index:!1,layout:!0},{id:"/blog/[slug]",path:"/blog/[slug]",module:O,index:!1,layout:!1},{id:"/index",path:"/",module:Q,index:!0,layout:!1}],T=new Map(S.map((q)=>[q.path,q]));function f(q){return T.get(q)}function h(){return S.map((q)=>q.path)}var C={routes:S,routeMap:T,findRoute:f,getRoutePaths:h};export{S as routes,T as routeMap,h as getRoutePaths,f as findRoute,C as default};

//# debugId=8C6571E24643C1DB64756E2164756E21
