"use strict";(()=>{var e={};e.id=633,e.ids=[633],e.modules={53524:e=>{e.exports=require("@prisma/client")},85890:e=>{e.exports=require("better-sqlite3")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},27790:e=>{e.exports=require("assert")},78893:e=>{e.exports=require("buffer")},61282:e=>{e.exports=require("child_process")},84770:e=>{e.exports=require("crypto")},17702:e=>{e.exports=require("events")},92048:e=>{e.exports=require("fs")},32615:e=>{e.exports=require("http")},35240:e=>{e.exports=require("https")},19801:e=>{e.exports=require("os")},55315:e=>{e.exports=require("path")},86624:e=>{e.exports=require("querystring")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},71568:e=>{e.exports=require("zlib")},99380:(e,t,n)=>{n.r(t),n.d(t,{originalPathname:()=>y,patchFetch:()=>L,requestAsyncStorage:()=>T,routeModule:()=>S,serverHooks:()=>O,staticGenerationAsyncStorage:()=>E});var i={};n.r(i),n.d(i,{GET:()=>w,dynamic:()=>g});var r=n(49303),l=n(88716),o=n(60670),s=n(87070),a=n(75571),c=n(38961),u=n(9487),f=n(24447),d=n(92048),p=n(55315),m=n(84770);let g="force-dynamic",h="PTZ-OFFLINE",A=process.env.LICENSE_SECRET??"TYCHE-PTZ-GOOD-BLESS-2026";async function w(){try{let e=await (0,a.getServerSession)(c.L),t=e?.user,n=t?.id??t?.email??"unknown",i="",r="",l=t?.email??"";try{let e=await u.prisma.user.findUnique({where:{id:n},select:{name:!0,organization:!0,email:!0}});i=e?.name??"",r=e?.organization??"",l=e?.email??l}catch{}let o=(0,f.BD)(),g=o[0]??"UNKNOWN",w=new Date().toISOString(),S={userId:n,userName:i,userOrg:r,userEmail:l,machineId:g,machineIds:o,requestedAt:w,product:h},T=m.createHmac("sha256",A).update(JSON.stringify({machineId:g,machineIds:o,requestedAt:w,product:h})).digest("hex").slice(0,16),E=Buffer.from(JSON.stringify({...S,sig:T},null,2)).toString("base64");try{d.mkdirSync(p.dirname(f.F8),{recursive:!0}),d.writeFileSync(f.F8,E,"utf8")}catch{}return new s.NextResponse(E,{headers:{"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="ptzcontroller-${g}.ptzreq"`}})}catch(e){return console.error("[License] Request file creation error:",e),s.NextResponse.json({error:"요청 파일 생성에 실패했습니다"},{status:500})}}let S=new r.AppRouteRouteModule({definition:{kind:l.x.APP_ROUTE,page:"/api/license/request/route",pathname:"/api/license/request",filename:"route",bundlePath:"app/api/license/request/route"},resolvedPagePath:"E:\\Web\\devroot\\PTZ_www\\integrated\\20260302-1403-Base\\ptzcontroller_admin\\app\\api\\license\\request\\route.ts",nextConfigOutput:"standalone",userland:i}),{requestAsyncStorage:T,staticGenerationAsyncStorage:E,serverHooks:O}=S,y="/api/license/request/route";function L(){return(0,o.patchFetch)({serverHooks:O,staticGenerationAsyncStorage:E})}},38961:(e,t,n)=>{n.d(t,{L:()=>E});var i=n(53797),r=n(13539),l=n(9487),o=n(42023),s=n.n(o),a=n(85890),c=n.n(a),u=n(55315),f=n.n(u),d=n(19801),p=n.n(d),m=n(92048),g=n.n(m);let h=null;function A(){try{let e;let t=("win32"===process.platform?e=f().join(process.env.PROGRAMDATA||"C:\\ProgramData","PTZController"):"darwin"===process.platform?e=f().join(process.env.HOME||p().homedir(),"Library/Application Support/PTZController"):e=f().join(process.env.HOME||p().homedir(),".config/PTZController"),g().existsSync(e)||g().mkdirSync(e,{recursive:!0}),f().join(e,"offline.db"));(h=new(c())(t)).pragma("journal_mode = WAL"),h.pragma("synchronous = NORMAL"),h.exec(`
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
    `),console.log("[OfflineDB] Initialized at:",t)}catch(e){throw console.error("[OfflineDB] Initialization failed:",e),e}}function w(){return h||A(),h}function S(e){return w().prepare("SELECT * FROM offline_users WHERE email = ?").get(e)??null}async function T(e,t,n){let i=S(e);if(!i)return null;if(i.lockedUntil&&new Date(i.lockedUntil)>new Date)return console.warn("[OfflineDB] Account locked until:",i.lockedUntil),null;if(1!==i.isActive)return console.warn("[OfflineDB] Account is inactive"),null;if(!await n.compare(t,i.passwordHash)){let t=(i.failedLoginAttempts??0)+1,n=t>=5;return w().prepare(`
      UPDATE offline_users
      SET 
        failedLoginAttempts = ?,
        lastFailedLoginAt = ?,
        lockedUntil = ?
      WHERE email = ?
    `).run(t,new Date().toISOString(),n?new Date(Date.now()+18e5).toISOString():null,e),console.warn("[OfflineDB] Failed login attempt for:",e,`(${t}/5)`),null}return w().prepare(`
    UPDATE offline_users
    SET 
      failedLoginAttempts = 0,
      lastFailedLoginAt = NULL,
      lockedUntil = NULL,
      lastOnlineLoginAt = ?,
      updatedAt = ?
    WHERE email = ?
  `).run(new Date().toISOString(),new Date().toISOString(),e),S(e)}try{A(),console.log("[Auth] Offline DB initialized successfully")}catch(e){console.warn("[Auth] Offline DB initialization failed (non-critical):",e)}let E={adapter:(0,r.N)(l.prisma),providers:[(0,i.Z)({name:"Credentials",credentials:{email:{label:"Email",type:"email"},password:{label:"Password",type:"password"}},async authorize(e){if(!e?.email||!e?.password)return console.warn("[Auth] Missing email or password"),null;try{console.log("[Auth] Attempting online authentication for:",e.email);let t=await Promise.race([l.prisma.user.findUnique({where:{email:e.email}}),new Promise(e=>setTimeout(()=>e(null),3e3))]);if(t&&t.password){if(await s().compare(e.password,t.password)){console.log("[Auth] Online login successful:",e.email);try{await function(e){let t=w(),n=e.id||`offline-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,i=new Date().toISOString();return S(e.email)?t.prepare(`
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
    `).run(n,e.email,e.name,e.organization??null,e.passwordHash,e.role,e.machineId??null,e.lastMachineId??null,e.licenseStatus??null,e.licenseExpiresAt??null,e.lastOnlineLoginAt??null,e.lastSyncAt??null,e.isInOfflineMode??0,e.offlineSessionToken??null,e.offlineStartedAt??null,e.platform??null,e.appVersion??null,e.failedLoginAttempts??0,e.lastFailedLoginAt??null,e.lockedUntil??null,e.isActive??1,e.createdAt??i,i),S(e.email)}({email:t.email,name:t.name||"User",organization:t.organization||void 0,passwordHash:t.password,role:t.role||"user",lastOnlineLoginAt:new Date().toISOString(),lastSyncAt:new Date().toISOString(),platform:process.platform,appVersion:process.env.npm_package_version}),console.log("[Auth] Offline user saved:",t.email)}catch(e){console.warn("[Auth] Failed to save offline user:",e)}return{id:t.id,email:t.email,name:t.name,role:t.role}}console.warn("[Auth] Online login failed - invalid password:",e.email)}else t?console.warn("[Auth] Online login failed - no password hash:",e.email):console.warn("[Auth] Online login failed - user not found:",e.email)}catch(e){console.error("[Auth] Online DB error:",e.message)}console.log("[Auth] Attempting offline authentication...");try{let n=await T(e.email,e.password,s());if(n){var t;return console.log("[Auth] Offline login successful:",e.email),t=n.email,w().prepare(`
    UPDATE offline_users
    SET 
      isInOfflineMode = ?,
      offlineStartedAt = ?,
      machineId = ?,
      platform = ?,
      appVersion = ?,
      updatedAt = ?
    WHERE email = ?
  `).run(1,new Date().toISOString(),(void 0)??null,process.platform,process.env.npm_package_version??null,new Date().toISOString(),t),{id:n.id,email:n.email,name:n.name,role:n.role}}console.warn("[Auth] Offline login failed:",e.email)}catch(e){console.error("[Auth] Offline authentication error:",e)}return console.warn("[Auth] Login failed for:",e.email),null}})],session:{strategy:"jwt",maxAge:86400},callbacks:{jwt:async({token:e,user:t})=>(t&&(e.role=t?.role??"user",e.id=t?.id),e),session:async({session:e,token:t})=>(e?.user&&(e.user.role=t?.role,e.user.id=t?.id),e)},pages:{signIn:"/login"},secret:process.env.NEXTAUTH_SECRET}},9487:(e,t,n)=>{n.d(t,{prisma:()=>r});var i=n(53524);let r=globalThis.prisma??new i.PrismaClient},24447:(e,t,n)=>{n.d(t,{BD:()=>g,F8:()=>A,L0:()=>E,RU:()=>u,Tx:()=>T,jH:()=>h,mP:()=>S,o7:()=>w});var i=n(84770),r=n(19801),l=n(92048),o=n(55315),s=n(61282);let a=process.env.LICENSE_SECRET??"TYCHE-PTZ-LICENSE-SECRET-2024",c="PTZ-OFFLINE";function u(){if("win32"===process.platform){let e=process.env.PROGRAMDATA||process.env.ALLUSERSPROFILE||"C:\\ProgramData";return o.join(e,"PTZController")}return"darwin"===process.platform?"/Library/Application Support/PTZController":o.join(process.env.HOME||"/etc",".config","PTZController")}function f(e,t,n=3e3){try{let i=(0,s.spawnSync)(e,t,{timeout:n,encoding:"utf8",stdio:["pipe","pipe","pipe"],windowsHide:!0});if(0===i.status&&i.stdout){let e=i.stdout;if("string"==typeof e)return e.trim()}return null}catch(e){return console.warn("[license] spawnSync failed:",e.message),null}}function d(e){try{if(l.existsSync(e))return l.readFileSync(e,"utf8").trim();return null}catch(e){return console.warn("[license] readFile failed:",e.message),null}}function p(e,t){return i.createHash("sha256").update([e,t].join("||")).digest("hex").slice(0,16).toUpperCase()}function m(){let e=[],t=f("getmac",[]);if(t&&"string"==typeof t){let n=t.match(/([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}/g);if(n)for(let t of n){let n=t.replace(/-/g,":").toLowerCase();"00:00:00:00:00:00"!==n&&e.push(n)}}return[...new Set(e)]}function g(){let e=r.platform(),t=function(){let e=r.platform(),t="";try{if("win32"===e){let e=(0,s.spawnSync)("reg",["query","HKLM\\SOFTWARE\\Microsoft\\Cryptography","/v","MachineGuid"],{timeout:3e3,encoding:"utf8",windowsHide:!0});if(0===e.status&&e.stdout){let n=e.stdout;if("string"==typeof n){let e=n.match(/MachineGuid\s+REG_SZ\s+(.+)/);e&&(t=e[1].trim())}}}else if("darwin"===e){let e=f("ioreg",["-rd1","-c","IOPlatformExpertDevice"]);if(e){let n=e.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);n&&(t=n[1])}}else t=d("/etc/machine-id")||d("/var/lib/dbus/machine-id")||""}catch(e){console.warn("[license] OS ID 추출 실패:",e.message)}return t||`${e}-${r.arch()}-${r.totalmem()}`}(),n=[],i=[];for(let r of i="win32"===e?function(){if("win8+"!==function(){try{let e=(0,s.spawnSync)("cmd",["/c","ver"],{timeout:3e3,encoding:"utf8",windowsHide:!0});if(0===e.status&&e.stdout){let t=e.stdout;if("string"==typeof t&&t.includes("Windows 7"))return"win7"}return"win8+"}catch{return"win8+"}}())return console.log("[license] Windows 7 감지 – getmac 사용 (활성만)"),m();{console.log("[license] Windows 8+ 감지 – PowerShell 사용 (비활성 어댑터 포함)");let e=function(){let e=[],t=f("powershell",["-NoProfile","-Command","Get-NetAdapter -Physical | Select-Object -ExpandProperty MacAddress"],5e3);if(t&&"string"==typeof t)for(let n of t.split(/\r?\n/)){let t=n.trim().toLowerCase();/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(t)&&"00:00:00:00:00:00"!==t&&e.push(t)}return e}();return e.length>0?e:(console.warn("[license] PowerShell 실패 – getmac 폴백"),m())}}():"darwin"===e?function(){let e=[],t=f("ifconfig",[]);if(t&&"string"==typeof t){let n=t.match(/ether\s+([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/gi);if(n)for(let t of n){let n=t.split(/\s+/),i=n[1]?.toLowerCase();i&&"00:00:00:00:00:00"!==i&&e.push(i)}}return[...new Set(e)]}():function(){let e=[];try{let t="/sys/class/net";if(!l.existsSync(t))return e;for(let n of l.readdirSync(t)){if("lo"===n||n.startsWith("vnet")||n.startsWith("docker"))continue;let i=o.join(t,n,"address"),r=d(i);r&&"string"==typeof r&&"00:00:00:00:00:00"!==r&&!r.startsWith("02:")&&e.push(r.toLowerCase())}}catch(e){console.warn("[license] Linux MAC 수집 실패:",e.message)}return[...new Set(e)]}())n.push(p(t,r));if("win32"===e&&n.length<2)for(let e of(console.log("[license] NIC 부족 – HDD 시리얼로 보완"),function(){let e=[];try{let t=f("wmic",["logicaldisk","get","volumeserialnumber","/format:table"]);if(t&&"string"==typeof t){let n=t.match(/[0-9A-Fa-f]{8}/g);if(n)for(let t of n)e.push(t)}}catch(e){console.warn("[license] HDD 시리얼 수집 실패:",e.message)}return[...new Set(e)]}()))n.push(p(t,e));return console.log(`[license] getAllMachineIds: ${n.length} IDs (${i.length} NICs + ${n.length-i.length} HDDs) on ${e}`),0===n.length&&(console.warn("[license] No hardware found – using OS UUID"),n.push(p(t,"NO_HW_FALLBACK"))),n}let h=o.join(u(),"offline.ptzlic"),A=o.join(u(),"license.ptzreq");function w(){let e=g(),t={machineId:e[0]??"UNKNOWN",machineIds:e,requestedAt:new Date().toISOString(),product:c},n=i.createHmac("sha256",a).update(JSON.stringify(t)).digest("hex").slice(0,16);return{...t,sig:n}}function S(e){let t=e||w(),n=Buffer.from(JSON.stringify(t,null,2)).toString("base64");return l.mkdirSync(o.dirname(A),{recursive:!0}),l.writeFileSync(A,n,"utf8"),console.log("[license] License request saved at:",A),A}function T(e){try{let t=Buffer.from(e,"base64").toString("utf8"),{sig:n,...r}=JSON.parse(t),l=i.createHmac("sha256",a).update(JSON.stringify(r)).digest("hex");if(n!==l)return{valid:!1,reason:"라이선스 서명이 올바르지 않습니다"};if(r.product!==c)return{valid:!1,reason:"라이선스 제품이 일치하지 않습니다"};let o=g(),s=r.machineIds?.length?r.machineIds:[r.machineId],u=o.filter(e=>s.includes(e));if(0===u.length)return{valid:!1,reason:`이 PC에 발급된 라이선스가 아닙니다 (현재: ${o.length}, 라이선스: ${s.length}, 일치: 0)`};if(new Date(r.expiresAt)<new Date)return{valid:!1,reason:`라이선스가 만료됨 (${r.expiresAt.slice(0,10)})`};return{valid:!0,expiresAt:r.expiresAt,machineId:u[0],matchedIds:u}}catch(e){return console.error("[license] verifyLicense error:",e.message),{valid:!1,reason:"라이선스 파일을 읽을 수 없습니다"}}}function E(){if(!l.existsSync(h))return{valid:!1,reason:"NOT_FOUND"};try{let e=l.readFileSync(h,"utf8").trim();return T(e)}catch(e){return console.error("[license] verifyLicenseFile error:",e.message),{valid:!1,reason:"라이선스 파일을 읽을 수 없습니다"}}}}};var t=require("../../../../webpack-runtime.js");t.C(e);var n=e=>t(t.s=e),i=t.X(0,[276,972,23,637],()=>n(99380));module.exports=i})();