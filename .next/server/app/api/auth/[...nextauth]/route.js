"use strict";(()=>{var e={};e.id=912,e.ids=[912],e.modules={53524:e=>{e.exports=require("@prisma/client")},85890:e=>{e.exports=require("better-sqlite3")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},27790:e=>{e.exports=require("assert")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},17702:e=>{e.exports=require("events")},92048:e=>{e.exports=require("fs")},32615:e=>{e.exports=require("http")},35240:e=>{e.exports=require("https")},19801:e=>{e.exports=require("os")},55315:e=>{e.exports=require("path")},86624:e=>{e.exports=require("querystring")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},71568:e=>{e.exports=require("zlib")},57109:(e,t,n)=>{n.r(t),n.d(t,{originalPathname:()=>h,patchFetch:()=>g,requestAsyncStorage:()=>d,routeModule:()=>c,serverHooks:()=>m,staticGenerationAsyncStorage:()=>f});var i={};n.r(i),n.d(i,{GET:()=>p,POST:()=>p});var r=n(49303),o=n(88716),a=n(60670),s=n(75571),l=n.n(s),u=n(38961);let p=l()(u.L),c=new r.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/auth/[...nextauth]/route",pathname:"/api/auth/[...nextauth]",filename:"route",bundlePath:"app/api/auth/[...nextauth]/route"},resolvedPagePath:"E:\\Web\\devroot\\PTZ_www\\integrated\\20260302-1403-Base\\ptzcontroller_admin\\app\\api\\auth\\[...nextauth]\\route.ts",nextConfigOutput:"standalone",userland:i}),{requestAsyncStorage:d,staticGenerationAsyncStorage:f,serverHooks:m}=c,h="/api/auth/[...nextauth]/route";function g(){return(0,a.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:f})}},38961:(e,t,n)=>{n.d(t,{L:()=>O});var i=n(53797),r=n(13539),o=n(9487),a=n(42023),s=n.n(a),l=n(85890),u=n.n(l),p=n(55315),c=n.n(p),d=n(19801),f=n.n(d),m=n(92048),h=n.n(m);let g=null;function A(){try{let e;let t=("win32"===process.platform?e=c().join(process.env.PROGRAMDATA||"C:\\ProgramData","PTZController"):"darwin"===process.platform?e=c().join(process.env.HOME||f().homedir(),"Library/Application Support/PTZController"):e=c().join(process.env.HOME||f().homedir(),".config/PTZController"),h().existsSync(e)||h().mkdirSync(e,{recursive:!0}),c().join(e,"offline.db"));(g=new(u())(t)).pragma("journal_mode = WAL"),g.pragma("synchronous = NORMAL"),g.exec(`
      CREATE TABLE IF NOT EXISTS offline_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        organization TEXT,
        lastOnlineLoginAt TEXT,
        lastSyncAt TEXT,
        isInOfflineMode INTEGER DEFAULT 0,
        machineId TEXT,
        lastMachineId TEXT,
        licenseStatus TEXT DEFAULT 'none',
        licenseExpiresAt TEXT,
        failedLoginAttempts INTEGER DEFAULT 0,
        lastFailedLoginAt TEXT,
        lockedUntil TEXT,
        isActive INTEGER DEFAULT 1,
        offlineSessionToken TEXT,
        offlineStartedAt TEXT,
        platform TEXT,
        appVersion TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_offline_users_email ON offline_users(email);
      CREATE INDEX IF NOT EXISTS idx_offline_users_machineId ON offline_users(machineId);
      CREATE INDEX IF NOT EXISTS idx_offline_users_isActive ON offline_users(isActive);
    `),console.log("[OfflineDB] Initialized at:",t)}catch(e){throw console.error("[OfflineDB] Initialization failed:",e),e}}function T(){return g||A(),g}function E(e){return T().prepare("SELECT * FROM offline_users WHERE email = ?").get(e)??null}async function S(e,t,n){let i=E(e);if(!i)return null;if(i.lockedUntil&&new Date(i.lockedUntil)>new Date)return console.warn("[OfflineDB] Account locked until:",i.lockedUntil),null;if(1!==i.isActive)return console.warn("[OfflineDB] Account is inactive"),null;if(!await n.compare(t,i.passwordHash)){let t=(i.failedLoginAttempts??0)+1,n=t>=5;return T().prepare(`
      UPDATE offline_users
      SET 
        failedLoginAttempts = ?,
        lastFailedLoginAt = ?,
        lockedUntil = ?
      WHERE email = ?
    `).run(t,new Date().toISOString(),n?new Date(Date.now()+18e5).toISOString():null,e),console.warn("[OfflineDB] Failed login attempt for:",e,`(${t}/5)`),null}return T().prepare(`
    UPDATE offline_users
    SET 
      failedLoginAttempts = 0,
      lastFailedLoginAt = NULL,
      lockedUntil = NULL,
      lastOnlineLoginAt = ?,
      updatedAt = ?
    WHERE email = ?
  `).run(new Date().toISOString(),new Date().toISOString(),e),E(e)}try{A(),console.log("[Auth] Offline DB initialized successfully")}catch(e){console.warn("[Auth] Offline DB initialization failed (non-critical):",e)}let O={adapter:(0,r.N)(o.prisma),providers:[(0,i.Z)({name:"Credentials",credentials:{email:{label:"Email",type:"email"},password:{label:"Password",type:"password"}},async authorize(e){if(!e?.email||!e?.password)return console.warn("[Auth] Missing email or password"),null;try{console.log("[Auth] Attempting online authentication for:",e.email);let t=await Promise.race([o.prisma.user.findUnique({where:{email:e.email}}),new Promise(e=>setTimeout(()=>e(null),3e3))]);if(t&&t.password){if(await s().compare(e.password,t.password)){console.log("[Auth] Online login successful:",e.email);try{await function(e){let t=T(),n=e.id||`offline-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,i=new Date().toISOString();return E(e.email)?t.prepare(`
      UPDATE offline_users
      SET 
        name = ?,
        organization = ?,
        passwordHash = ?,
        role = ?,
        machineId = ?,
        lastMachineId = ?,
        licenseStatus = ?,
        licenseExpiresAt = ?,
        lastOnlineLoginAt = ?,
        lastSyncAt = ?,
        isInOfflineMode = ?,
        offlineSessionToken = ?,
        offlineStartedAt = ?,
        platform = ?,
        appVersion = ?,
        failedLoginAttempts = ?,
        lastFailedLoginAt = ?,
        lockedUntil = ?,
        isActive = ?,
        updatedAt = ?
      WHERE email = ?
    `).run(e.name,e.organization??null,e.passwordHash,e.role,e.machineId??null,e.lastMachineId??null,e.licenseStatus??null,e.licenseExpiresAt??null,e.lastOnlineLoginAt??null,e.lastSyncAt??null,e.isInOfflineMode??0,e.offlineSessionToken??null,e.offlineStartedAt??null,e.platform??null,e.appVersion??null,e.failedLoginAttempts??0,e.lastFailedLoginAt??null,e.lockedUntil??null,e.isActive??1,i,e.email):t.prepare(`
      INSERT INTO offline_users (
        id, email, name, organization, passwordHash, role,
        machineId, lastMachineId, licenseStatus, licenseExpiresAt,
        lastOnlineLoginAt, lastSyncAt, isInOfflineMode,
        offlineSessionToken, offlineStartedAt, platform, appVersion,
        failedLoginAttempts, lastFailedLoginAt, lockedUntil, isActive,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(n,e.email,e.name,e.organization??null,e.passwordHash,e.role,e.machineId??null,e.lastMachineId??null,e.licenseStatus??null,e.licenseExpiresAt??null,e.lastOnlineLoginAt??null,e.lastSyncAt??null,e.isInOfflineMode??0,e.offlineSessionToken??null,e.offlineStartedAt??null,e.platform??null,e.appVersion??null,e.failedLoginAttempts??0,e.lastFailedLoginAt??null,e.lockedUntil??null,e.isActive??1,e.createdAt??i,i),E(e.email)}({email:t.email,name:t.name||"User",organization:t.organization||void 0,passwordHash:t.password,role:t.role||"user",lastOnlineLoginAt:new Date().toISOString(),lastSyncAt:new Date().toISOString(),platform:process.platform,appVersion:process.env.npm_package_version}),console.log("[Auth] Offline user saved:",t.email)}catch(e){console.warn("[Auth] Failed to save offline user:",e)}return{id:t.id,email:t.email,name:t.name,role:t.role}}console.warn("[Auth] Online login failed - invalid password:",e.email)}else t?console.warn("[Auth] Online login failed - no password hash:",e.email):console.warn("[Auth] Online login failed - user not found:",e.email)}catch(e){console.error("[Auth] Online DB error:",e.message)}console.log("[Auth] Attempting offline authentication...");try{let n=await S(e.email,e.password,s());if(n){var t;return console.log("[Auth] Offline login successful:",e.email),t=n.email,T().prepare(`
    UPDATE offline_users
    SET 
      isInOfflineMode = ?,
      offlineStartedAt = ?,
      machineId = ?,
      platform = ?,
      appVersion = ?,
      updatedAt = ?
    WHERE email = ?
  `).run(1,new Date().toISOString(),(void 0)??null,process.platform,process.env.npm_package_version??null,new Date().toISOString(),t),{id:n.id,email:n.email,name:n.name,role:n.role}}console.warn("[Auth] Offline login failed:",e.email)}catch(e){console.error("[Auth] Offline authentication error:",e)}return console.warn("[Auth] Login failed for:",e.email),null}})],session:{strategy:"jwt",maxAge:86400},callbacks:{jwt:async({token:e,user:t})=>(t&&(e.role=t?.role??"user",e.id=t?.id),e),session:async({session:e,token:t})=>(e?.user&&(e.user.role=t?.role,e.user.id=t?.id),e)},pages:{signIn:"/login"},secret:process.env.NEXTAUTH_SECRET}},9487:(e,t,n)=>{n.d(t,{prisma:()=>r});var i=n(53524);let r=globalThis.prisma??new i.PrismaClient},79925:e=>{var t=Object.defineProperty,n=Object.getOwnPropertyDescriptor,i=Object.getOwnPropertyNames,r=Object.prototype.hasOwnProperty,o={};function a(e){var t;let n=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),i=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===n.length?i:`${i}; ${n.join("; ")}`}function s(e){let t=new Map;for(let n of e.split(/; */)){if(!n)continue;let e=n.indexOf("=");if(-1===e){t.set(n,"true");continue}let[i,r]=[n.slice(0,e),n.slice(e+1)];try{t.set(i,decodeURIComponent(null!=r?r:"true"))}catch{}}return t}function l(e){var t,n;if(!e)return;let[[i,r],...o]=s(e),{domain:a,expires:l,httponly:c,maxage:d,path:f,samesite:m,secure:h,partitioned:g,priority:A}=Object.fromEntries(o.map(([e,t])=>[e.toLowerCase(),t]));return function(e){let t={};for(let n in e)e[n]&&(t[n]=e[n]);return t}({name:i,value:decodeURIComponent(r),domain:a,...l&&{expires:new Date(l)},...c&&{httpOnly:!0},..."string"==typeof d&&{maxAge:Number(d)},path:f,...m&&{sameSite:u.includes(t=(t=m).toLowerCase())?t:void 0},...h&&{secure:!0},...A&&{priority:p.includes(n=(n=A).toLowerCase())?n:void 0},...g&&{partitioned:!0}})}((e,n)=>{for(var i in n)t(e,i,{get:n[i],enumerable:!0})})(o,{RequestCookies:()=>c,ResponseCookies:()=>d,parseCookie:()=>s,parseSetCookie:()=>l,stringifyCookie:()=>a}),e.exports=((e,o,a,s)=>{if(o&&"object"==typeof o||"function"==typeof o)for(let a of i(o))r.call(e,a)||void 0===a||t(e,a,{get:()=>o[a],enumerable:!(s=n(o,a))||s.enumerable});return e})(t({},"__esModule",{value:!0}),o);var u=["strict","lax","none"],p=["low","medium","high"],c=class{constructor(e){this._parsed=new Map,this._headers=e;let t=e.get("cookie");if(t)for(let[e,n]of s(t))this._parsed.set(e,{name:e,value:n})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let n=Array.from(this._parsed);if(!e.length)return n.map(([e,t])=>t);let i="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return n.filter(([e])=>e===i).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,n]=1===e.length?[e[0].name,e[0].value]:e,i=this._parsed;return i.set(t,{name:t,value:n}),this._headers.set("cookie",Array.from(i).map(([e,t])=>a(t)).join("; ")),this}delete(e){let t=this._parsed,n=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>a(t)).join("; ")),n}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},d=class{constructor(e){var t,n,i;this._parsed=new Map,this._headers=e;let r=null!=(i=null!=(n=null==(t=e.getSetCookie)?void 0:t.call(e))?n:e.get("set-cookie"))?i:[];for(let e of Array.isArray(r)?r:function(e){if(!e)return[];var t,n,i,r,o,a=[],s=0;function l(){for(;s<e.length&&/\s/.test(e.charAt(s));)s+=1;return s<e.length}for(;s<e.length;){for(t=s,o=!1;l();)if(","===(n=e.charAt(s))){for(i=s,s+=1,l(),r=s;s<e.length&&"="!==(n=e.charAt(s))&&";"!==n&&","!==n;)s+=1;s<e.length&&"="===e.charAt(s)?(o=!0,s=r,a.push(e.substring(t,i)),t=s):s=i+1}else s+=1;(!o||s>=e.length)&&a.push(e.substring(t,e.length))}return a}(r)){let t=l(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let n=Array.from(this._parsed.values());if(!e.length)return n;let i="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return n.filter(e=>e.name===i)}has(e){return this._parsed.has(e)}set(...e){let[t,n,i]=1===e.length?[e[0].name,e[0].value,e[0]]:e,r=this._parsed;return r.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:n,...i})),function(e,t){for(let[,n]of(t.delete("set-cookie"),e)){let e=a(n);t.append("set-cookie",e)}}(r,this._headers),this}delete(...e){let[t,n,i]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0].path,e[0].domain];return this.set({name:t,path:n,domain:i,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(a).join("; ")}}},49303:(e,t,n)=>{e.exports=n(30517)},92044:(e,t,n)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var n in t)Object.defineProperty(e,n,{enumerable:!0,get:t[n]})}(t,{RequestCookies:function(){return i.RequestCookies},ResponseCookies:function(){return i.ResponseCookies},stringifyCookie:function(){return i.stringifyCookie}});let i=n(79925)}};var t=require("../../../../webpack-runtime.js");t.C(e);var n=e=>t(t.s=e),i=t.X(0,[276,23,637],()=>n(57109));module.exports=i})();