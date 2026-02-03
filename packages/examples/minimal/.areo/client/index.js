async function k(){if(document.readyState==="loading")await new Promise((j)=>document.addEventListener("DOMContentLoaded",j));let b=document.getElementById("__AREO_DATA__"),q=b?JSON.parse(b.textContent||"{}"):{};console.log("[Areo] Client hydration initialized");let g=document.querySelectorAll("[data-island]");if(g.length>0)console.log(`[Areo] Found ${g.length} island(s) to hydrate`)}k().catch(console.error);export{k as initClient};

//# debugId=76E622A187D9710564756E2164756E21
