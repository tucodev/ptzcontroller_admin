"use strict";(()=>{var e={};e.id=912,e.ids=[912],e.modules={53524:e=>{e.exports=require("@prisma/client")},85890:e=>{e.exports=require("better-sqlite3")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},27790:e=>{e.exports=require("assert")},78893:e=>{e.exports=require("buffer")},61282:e=>{e.exports=require("child_process")},84770:e=>{e.exports=require("crypto")},17702:e=>{e.exports=require("events")},92048:e=>{e.exports=require("fs")},32615:e=>{e.exports=require("http")},35240:e=>{e.exports=require("https")},19801:e=>{e.exports=require("os")},55315:e=>{e.exports=require("path")},86624:e=>{e.exports=require("querystring")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},71568:e=>{e.exports=require("zlib")},57109:(e,t,n)=>{n.r(t),n.d(t,{originalPathname:()=>h,patchFetch:()=>g,requestAsyncStorage:()=>f,routeModule:()=>c,serverHooks:()=>m,staticGenerationAsyncStorage:()=>d});var r={};n.r(r),n.d(r,{GET:()=>p,POST:()=>p});var i=n(49303),o=n(88716),s=n(60670),a=n(75571),l=n.n(a),u=n(90455);let p=l()(u.L),c=new i.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/auth/[...nextauth]/route",pathname:"/api/auth/[...nextauth]",filename:"route",bundlePath:"app/api/auth/[...nextauth]/route"},resolvedPagePath:"E:\\Web\\devroot\\PTZ_www\\integrated\\20260302-1403-Base\\ptzcontroller_admin\\app\\api\\auth\\[...nextauth]\\route.ts",nextConfigOutput:"standalone",userland:r}),{requestAsyncStorage:f,staticGenerationAsyncStorage:d,serverHooks:m}=c,h="/api/auth/[...nextauth]/route";function g(){return(0,s.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:d})}},90455:(e,t,n)=>{n.d(t,{L:()=>c});var r=n(53797),i=n(13539),o=n(9487),s=n(42023),a=n.n(s),l=n(66610),u=n(48843);try{(0,l.g0)(),console.log("[Auth] Offline DB initialized successfully")}catch(e){console.warn("[Auth] Offline DB initialization failed (non-critical):",e)}let p="true"===process.env.PTZ_DESKTOP_MODE,c={adapter:(0,i.N)(o.prisma),providers:[(0,r.Z)({name:"Credentials",credentials:{email:{label:"Email",type:"email"},password:{label:"Password",type:"password"}},async authorize(e){if(!e?.email||!e?.password)return console.warn("[Auth] Missing email or password"),null;let t=p?"Desktop":"Admin";try{console.log(`[Auth] Online login attempt (${t}):`,e.email);let n=await Promise.race([o.prisma.user.findUnique({where:{email:e.email},select:{id:!0,email:!0,name:!0,password:!0,role:!0,organization:!0}}),new Promise(e=>setTimeout(()=>e(null),3e3))]);if(n&&n.password&&await a().compare(e.password,n.password)){console.log(`[Auth] OK Online login success (${t}):`,e.email);try{await (0,l.en)({email:n.email,name:n.name||"User",organization:n.organization||void 0,passwordHash:n.password,role:n.role||"user",lastOnlineLoginAt:new Date().toISOString(),lastSyncAt:new Date().toISOString(),platform:process.platform,appVersion:process.env.npm_package_version}),console.log("[Auth] OK Offline DB sync:",e.email)}catch(e){console.warn("[Auth] WARN Offline DB sync failed:",e)}return{id:n.id,email:n.email,name:n.name,role:n.role}}}catch(e){console.log(`[Auth] Online DB unavailable (${t}):`,e instanceof Error?e.message:String(e))}if(p){console.log("[Auth] Desktop offline fallback attempt:",e.email);try{let t=await (0,u.TA)();if(!t.valid)return console.warn("[Auth] FAIL Desktop offline: no valid license, reason:",t.reason),null;console.log("[Auth] OK Desktop license verified:",t.expiresAt);let n=await (0,l.Zz)(e.email,e.password,a());if(n)return console.log("[Auth] OK Desktop offline login success (license + local DB):",e.email),(0,l.LN)(n.email,!0),{id:n.id,email:n.email,name:n.name,role:n.role};console.warn("[Auth] FAIL Desktop offline login: password mismatch")}catch(e){console.error("[Auth] ERROR Desktop offline auth error:",e instanceof Error?e.message:String(e))}}else console.warn("[Auth] FAIL Admin online auth failed, no offline fallback:",e.email);return null}})],session:{strategy:"jwt",maxAge:86400},callbacks:{jwt:async({token:e,user:t})=>(t&&(e.role=t?.role??"user",e.id=t?.id),e),session:async({session:e,token:t})=>(e?.user&&(e.user.role=t?.role,e.user.id=t?.id),e)},pages:{signIn:"/login"},secret:process.env.NEXTAUTH_SECRET}},66610:(e,t,n)=>{n.d(t,{LN:()=>A,Zz:()=>g,en:()=>h,g0:()=>f});var r=n(85890),i=n.n(r),o=n(55315),s=n.n(o),a=n(19801),l=n.n(a),u=n(92048),p=n.n(u);let c=null;function f(){try{let e;let t=("win32"===process.platform?e=s().join(process.env.PROGRAMDATA||"C:\\ProgramData","PTZController"):"darwin"===process.platform?e=s().join(process.env.HOME||l().homedir(),"Library/Application Support/PTZController"):e=s().join(process.env.HOME||l().homedir(),".config/PTZController"),p().existsSync(e)||p().mkdirSync(e,{recursive:!0}),s().join(e,"offline.db"));(c=new(i())(t)).pragma("journal_mode = WAL"),c.pragma("synchronous = NORMAL"),c.exec(`
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
    `),console.log("[OfflineDB] Initialized at:",t)}catch(e){throw console.error("[OfflineDB] Initialization failed:",e),e}}function d(){return c||f(),c}function m(e){return d().prepare("SELECT * FROM offline_users WHERE email = ?").get(e)??null}function h(e){let t=d(),n=e.id||`offline-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,r=new Date().toISOString();return m(e.email)?t.prepare(`
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
    `).run(e.name,e.organization??null,e.passwordHash,e.role,e.machineId??null,e.lastMachineId??null,e.licenseStatus??null,e.licenseExpiresAt??null,e.lastOnlineLoginAt??null,e.lastSyncAt??null,e.isInOfflineMode??0,e.offlineSessionToken??null,e.offlineStartedAt??null,e.platform??null,e.appVersion??null,e.failedLoginAttempts??0,e.lastFailedLoginAt??null,e.lockedUntil??null,e.isActive??1,r,e.email):t.prepare(`
      INSERT INTO offline_users (
        id, email, name, organization, passwordHash, role,
        machineId, lastMachineId, licenseStatus, licenseExpiresAt,
        lastOnlineLoginAt, lastSyncAt, isInOfflineMode,
        offlineSessionToken, offlineStartedAt, platform, appVersion,
        failedLoginAttempts, lastFailedLoginAt, lockedUntil, isActive,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(n,e.email,e.name,e.organization??null,e.passwordHash,e.role,e.machineId??null,e.lastMachineId??null,e.licenseStatus??null,e.licenseExpiresAt??null,e.lastOnlineLoginAt??null,e.lastSyncAt??null,e.isInOfflineMode??0,e.offlineSessionToken??null,e.offlineStartedAt??null,e.platform??null,e.appVersion??null,e.failedLoginAttempts??0,e.lastFailedLoginAt??null,e.lockedUntil??null,e.isActive??1,e.createdAt??r,r),m(e.email)}async function g(e,t,n){let r=m(e);if(!r)return console.warn("[OfflineDB] 사용자 없음:",e),null;if(r.lockedUntil&&new Date(r.lockedUntil)>new Date)return console.warn("[OfflineDB] 계정 잠금 (해제 시간):",r.lockedUntil),null;if(1!==r.isActive)return console.warn("[OfflineDB] 비활성 계정:",e),null;try{if(!await n.compare(t,r.passwordHash)){let t=(r.failedLoginAttempts??0)+1,n=t>=5;return d().prepare(`
                UPDATE offline_users
                SET 
                    failedLoginAttempts = ?,
                    lastFailedLoginAt = ?,
                    lockedUntil = ?
                WHERE email = ?
            `).run(t,new Date().toISOString(),n?new Date(Date.now()+18e5).toISOString():null,e),console.warn("[OfflineDB] ❌ 비밀번호 불일치:",e,`(${t}/5)`),null}return d().prepare(`
            UPDATE offline_users
            SET 
                failedLoginAttempts = 0,
                lastFailedLoginAt = NULL,
                lockedUntil = NULL,
                lastOnlineLoginAt = ?,
                lastSyncAt = ?,
                updatedAt = ?
            WHERE email = ?
        `).run(new Date().toISOString(),new Date().toISOString(),new Date().toISOString(),e),console.log("[OfflineDB] ✅ 오프라인 로그인 성공:",e),m(e)}catch(e){return console.error("[OfflineDB] bcrypt 비교 에러:",e instanceof Error?e.message:String(e)),null}}function A(e,t,n){d().prepare(`
    UPDATE offline_users
    SET 
      isInOfflineMode = ?,
      offlineStartedAt = ?,
      machineId = ?,
      platform = ?,
      appVersion = ?,
      updatedAt = ?
    WHERE email = ?
  `).run(t?1:0,t?new Date().toISOString():null,n??null,process.platform,process.env.npm_package_version??null,new Date().toISOString(),e)}},79925:e=>{var t=Object.defineProperty,n=Object.getOwnPropertyDescriptor,r=Object.getOwnPropertyNames,i=Object.prototype.hasOwnProperty,o={};function s(e){var t;let n=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),r=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===n.length?r:`${r}; ${n.join("; ")}`}function a(e){let t=new Map;for(let n of e.split(/; */)){if(!n)continue;let e=n.indexOf("=");if(-1===e){t.set(n,"true");continue}let[r,i]=[n.slice(0,e),n.slice(e+1)];try{t.set(r,decodeURIComponent(null!=i?i:"true"))}catch{}}return t}function l(e){var t,n;if(!e)return;let[[r,i],...o]=a(e),{domain:s,expires:l,httponly:c,maxage:f,path:d,samesite:m,secure:h,partitioned:g,priority:A}=Object.fromEntries(o.map(([e,t])=>[e.toLowerCase(),t]));return function(e){let t={};for(let n in e)e[n]&&(t[n]=e[n]);return t}({name:r,value:decodeURIComponent(i),domain:s,...l&&{expires:new Date(l)},...c&&{httpOnly:!0},..."string"==typeof f&&{maxAge:Number(f)},path:d,...m&&{sameSite:u.includes(t=(t=m).toLowerCase())?t:void 0},...h&&{secure:!0},...A&&{priority:p.includes(n=(n=A).toLowerCase())?n:void 0},...g&&{partitioned:!0}})}((e,n)=>{for(var r in n)t(e,r,{get:n[r],enumerable:!0})})(o,{RequestCookies:()=>c,ResponseCookies:()=>f,parseCookie:()=>a,parseSetCookie:()=>l,stringifyCookie:()=>s}),e.exports=((e,o,s,a)=>{if(o&&"object"==typeof o||"function"==typeof o)for(let s of r(o))i.call(e,s)||void 0===s||t(e,s,{get:()=>o[s],enumerable:!(a=n(o,s))||a.enumerable});return e})(t({},"__esModule",{value:!0}),o);var u=["strict","lax","none"],p=["low","medium","high"],c=class{constructor(e){this._parsed=new Map,this._headers=e;let t=e.get("cookie");if(t)for(let[e,n]of a(t))this._parsed.set(e,{name:e,value:n})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let n=Array.from(this._parsed);if(!e.length)return n.map(([e,t])=>t);let r="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return n.filter(([e])=>e===r).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,n]=1===e.length?[e[0].name,e[0].value]:e,r=this._parsed;return r.set(t,{name:t,value:n}),this._headers.set("cookie",Array.from(r).map(([e,t])=>s(t)).join("; ")),this}delete(e){let t=this._parsed,n=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>s(t)).join("; ")),n}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},f=class{constructor(e){var t,n,r;this._parsed=new Map,this._headers=e;let i=null!=(r=null!=(n=null==(t=e.getSetCookie)?void 0:t.call(e))?n:e.get("set-cookie"))?r:[];for(let e of Array.isArray(i)?i:function(e){if(!e)return[];var t,n,r,i,o,s=[],a=0;function l(){for(;a<e.length&&/\s/.test(e.charAt(a));)a+=1;return a<e.length}for(;a<e.length;){for(t=a,o=!1;l();)if(","===(n=e.charAt(a))){for(r=a,a+=1,l(),i=a;a<e.length&&"="!==(n=e.charAt(a))&&";"!==n&&","!==n;)a+=1;a<e.length&&"="===e.charAt(a)?(o=!0,a=i,s.push(e.substring(t,r)),t=a):a=r+1}else a+=1;(!o||a>=e.length)&&s.push(e.substring(t,e.length))}return s}(i)){let t=l(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let n=Array.from(this._parsed.values());if(!e.length)return n;let r="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return n.filter(e=>e.name===r)}has(e){return this._parsed.has(e)}set(...e){let[t,n,r]=1===e.length?[e[0].name,e[0].value,e[0]]:e,i=this._parsed;return i.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:n,...r})),function(e,t){for(let[,n]of(t.delete("set-cookie"),e)){let e=s(n);t.append("set-cookie",e)}}(i,this._headers),this}delete(...e){let[t,n,r]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0].path,e[0].domain];return this.set({name:t,path:n,domain:r,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(s).join("; ")}}},49303:(e,t,n)=>{e.exports=n(30517)},92044:(e,t,n)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var n in t)Object.defineProperty(e,n,{enumerable:!0,get:t[n]})}(t,{RequestCookies:function(){return r.RequestCookies},ResponseCookies:function(){return r.ResponseCookies},stringifyCookie:function(){return r.stringifyCookie}});let r=n(79925)}};var t=require("../../../../webpack-runtime.js");t.C(e);var n=e=>t(t.s=e),r=t.X(0,[276,23,637,843],()=>n(57109));module.exports=r})();