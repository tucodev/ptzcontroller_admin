"use strict";(()=>{var e={};e.id=633,e.ids=[633],e.modules={53524:e=>{e.exports=require("@prisma/client")},85890:e=>{e.exports=require("better-sqlite3")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},27790:e=>{e.exports=require("assert")},78893:e=>{e.exports=require("buffer")},61282:e=>{e.exports=require("child_process")},84770:e=>{e.exports=require("crypto")},17702:e=>{e.exports=require("events")},92048:e=>{e.exports=require("fs")},32615:e=>{e.exports=require("http")},35240:e=>{e.exports=require("https")},19801:e=>{e.exports=require("os")},55315:e=>{e.exports=require("path")},86624:e=>{e.exports=require("querystring")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},71568:e=>{e.exports=require("zlib")},99380:(e,t,n)=>{n.r(t),n.d(t,{originalPathname:()=>O,patchFetch:()=>L,requestAsyncStorage:()=>E,routeModule:()=>w,serverHooks:()=>y,staticGenerationAsyncStorage:()=>T});var r={};n.r(r),n.d(r,{GET:()=>A,dynamic:()=>g});var i=n(49303),s=n(88716),o=n(60670),l=n(87070),a=n(75571),c=n(38961),u=n(9487),f=n(24447),p=n(92048),d=n(55315),m=n(84770);let g="force-dynamic",h="PTZ-OFFLINE",S=process.env.LICENSE_SECRET??"TYCHE-PTZ-GOOD-BLESS-2026";async function A(){try{let e=await (0,a.getServerSession)(c.L),t=e?.user,n=t?.id??t?.email??"unknown",r="",i="",s=t?.email??"";try{let e=await u.prisma.user.findUnique({where:{id:n},select:{name:!0,organization:!0,email:!0}});r=e?.name??"",i=e?.organization??"",s=e?.email??s}catch{}let o=(0,f.BD)(),g=o[0]??"UNKNOWN",A=new Date().toISOString(),w={userId:n,userName:r,userOrg:i,userEmail:s,machineId:g,machineIds:o,requestedAt:A,product:h},E=m.createHmac("sha256",S).update(JSON.stringify({machineId:g,machineIds:o,requestedAt:A,product:h})).digest("hex").slice(0,16),T=Buffer.from(JSON.stringify({...w,sig:E},null,2)).toString("base64");try{p.mkdirSync(d.dirname(f.F8),{recursive:!0}),p.writeFileSync(f.F8,T,"utf8")}catch{}return new l.NextResponse(T,{headers:{"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="ptzcontroller-${g}.ptzreq"`}})}catch(e){return console.error("[License] Request file creation error:",e),l.NextResponse.json({error:"요청 파일 생성에 실패했습니다"},{status:500})}}let w=new i.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/license/request/route",pathname:"/api/license/request",filename:"route",bundlePath:"app/api/license/request/route"},resolvedPagePath:"E:\\Web\\devroot\\PTZ_www\\integrated\\20260302-1403-Base\\ptzcontroller_admin\\app\\api\\license\\request\\route.ts",nextConfigOutput:"standalone",userland:r}),{requestAsyncStorage:E,staticGenerationAsyncStorage:T,serverHooks:y}=w,O="/api/license/request/route";function L(){return(0,o.patchFetch)({serverHooks:y,staticGenerationAsyncStorage:T})}},38961:(e,t,n)=>{n.d(t,{L:()=>T});var r=n(53797),i=n(13539),s=n(9487),o=n(42023),l=n.n(o),a=n(85890),c=n.n(a),u=n(55315),f=n.n(u),p=n(19801),d=n.n(p),m=n(92048),g=n.n(m);let h=null;function S(){try{let e;let t=("win32"===process.platform?e=f().join(process.env.PROGRAMDATA||"C:\\ProgramData","PTZController"):"darwin"===process.platform?e=f().join(process.env.HOME||d().homedir(),"Library/Application Support/PTZController"):e=f().join(process.env.HOME||d().homedir(),".config/PTZController"),g().existsSync(e)||g().mkdirSync(e,{recursive:!0}),f().join(e,"offline.db"));(h=new(c())(t)).pragma("journal_mode = WAL"),h.pragma("synchronous = NORMAL"),h.exec(`
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
    `),console.log("[OfflineDB] Initialized at:",t)}catch(e){throw console.error("[OfflineDB] Initialization failed:",e),e}}function A(){return h||S(),h}function w(e){return A().prepare("SELECT * FROM offline_users WHERE email = ?").get(e)??null}async function E(e,t,n){let r=w(e);if(!r)return console.warn("[OfflineDB] 사용자 없음:",e),null;if(r.lockedUntil&&new Date(r.lockedUntil)>new Date)return console.warn("[OfflineDB] 계정 잠금 (해제 시간):",r.lockedUntil),null;if(1!==r.isActive)return console.warn("[OfflineDB] 비활성 계정:",e),null;try{if(!await n.compare(t,r.passwordHash)){let t=(r.failedLoginAttempts??0)+1,n=t>=5;return A().prepare(`
                UPDATE offline_users
                SET 
                    failedLoginAttempts = ?,
                    lastFailedLoginAt = ?,
                    lockedUntil = ?
                WHERE email = ?
            `).run(t,new Date().toISOString(),n?new Date(Date.now()+18e5).toISOString():null,e),console.warn("[OfflineDB] ❌ 비밀번호 불일치:",e,`(${t}/5)`),null}return A().prepare(`
            UPDATE offline_users
            SET 
                failedLoginAttempts = 0,
                lastFailedLoginAt = NULL,
                lockedUntil = NULL,
                lastOnlineLoginAt = ?,
                lastSyncAt = ?,
                updatedAt = ?
            WHERE email = ?
        `).run(new Date().toISOString(),new Date().toISOString(),new Date().toISOString(),e),console.log("[OfflineDB] ✅ 오프라인 로그인 성공:",e),w(e)}catch(e){return console.error("[OfflineDB] bcrypt 비교 에러:",e instanceof Error?e.message:String(e)),null}}try{S(),console.log("[Auth] Offline DB initialized successfully")}catch(e){console.warn("[Auth] Offline DB initialization failed (non-critical):",e)}let T={adapter:(0,i.N)(s.prisma),providers:[(0,r.Z)({name:"Credentials",credentials:{email:{label:"Email",type:"email"},password:{label:"Password",type:"password"}},async authorize(e){if(!e?.email||!e?.password)return console.warn("[Auth] Missing email or password"),null;try{console.log("[Auth] 온라인 로그인 시도:",e.email);let t=await Promise.race([s.prisma.user.findUnique({where:{email:e.email},select:{id:!0,email:!0,name:!0,password:!0,role:!0,organization:!0}}),new Promise(e=>setTimeout(()=>e(null),3e3))]);if(t&&t.password&&await l().compare(e.password,t.password)){console.log("[Auth] ✅ 온라인 로그인 성공:",e.email);try{let e=await function(e){let t=A(),n=e.id||`offline-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,r=new Date().toISOString();return w(e.email)?t.prepare(`
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
    `).run(n,e.email,e.name,e.organization??null,e.passwordHash,e.role,e.machineId??null,e.lastMachineId??null,e.licenseStatus??null,e.licenseExpiresAt??null,e.lastOnlineLoginAt??null,e.lastSyncAt??null,e.isInOfflineMode??0,e.offlineSessionToken??null,e.offlineStartedAt??null,e.platform??null,e.appVersion??null,e.failedLoginAttempts??0,e.lastFailedLoginAt??null,e.lockedUntil??null,e.isActive??1,e.createdAt??r,r),w(e.email)}({email:t.email,name:t.name||"User",organization:t.organization||void 0,passwordHash:t.password,role:t.role||"user",lastOnlineLoginAt:new Date().toISOString(),lastSyncAt:new Date().toISOString(),platform:process.platform,appVersion:process.env.npm_package_version});console.log("[Auth] ✅ 오프라인 DB 저장 완료:",e.email)}catch(e){console.error("[Auth] ❌ 오프라인 DB 저장 실패:",e)}return{id:t.id,email:t.email,name:t.name,role:t.role}}}catch(e){console.error("[Auth] 온라인 DB 에러:",e instanceof Error?e.message:String(e))}console.log("[Auth] 오프라인 로그인 시도 중...");try{let n=await E(e.email,e.password,l());if(n){var t;return console.log("[Auth] ✅ 오프라인 로그인 성공:",e.email),t=n.email,A().prepare(`
    UPDATE offline_users
    SET 
      isInOfflineMode = ?,
      offlineStartedAt = ?,
      machineId = ?,
      platform = ?,
      appVersion = ?,
      updatedAt = ?
    WHERE email = ?
  `).run(1,new Date().toISOString(),(void 0)??null,process.platform,process.env.npm_package_version??null,new Date().toISOString(),t),{id:n.id,email:n.email,name:n.name,role:n.role}}console.warn("[Auth] ❌ 오프라인 로그인 실패:",e.email)}catch(e){console.error("[Auth] 오프라인 인증 에러:",e instanceof Error?e.message:String(e))}return console.warn("[Auth] ❌ 로그인 실패 (온라인/오프라인 모두):",e.email),null}})],session:{strategy:"jwt",maxAge:86400},callbacks:{jwt:async({token:e,user:t})=>(t&&(e.role=t?.role??"user",e.id=t?.id),e),session:async({session:e,token:t})=>(e?.user&&(e.user.role=t?.role,e.user.id=t?.id),e)},pages:{signIn:"/login"},secret:process.env.NEXTAUTH_SECRET}},9487:(e,t,n)=>{n.d(t,{prisma:()=>i});var r=n(53524);let i=globalThis.prisma??new r.PrismaClient},24447:(e,t,n)=>{n.d(t,{BD:()=>g,F8:()=>S,L0:()=>T,RU:()=>u,Tx:()=>E,jH:()=>h,mP:()=>w,o7:()=>A});var r=n(84770),i=n(19801),s=n(92048),o=n(55315),l=n(61282);let a=process.env.LICENSE_SECRET??"TYCHE-PTZ-LICENSE-SECRET-2024",c="PTZ-OFFLINE";function u(){if("win32"===process.platform){let e=process.env.PROGRAMDATA||process.env.ALLUSERSPROFILE||"C:\\ProgramData";return o.join(e,"PTZController")}return"darwin"===process.platform?"/Library/Application Support/PTZController":o.join(process.env.HOME||"/etc",".config","PTZController")}function f(e,t,n=3e3){try{let r=(0,l.spawnSync)(e,t,{timeout:n,encoding:"utf8",stdio:["pipe","pipe","pipe"],windowsHide:!0});if(0===r.status&&r.stdout){let e=r.stdout;if("string"==typeof e)return e.trim()}return null}catch(e){return console.warn("[license] spawnSync failed:",e.message),null}}function p(e){try{if(s.existsSync(e))return s.readFileSync(e,"utf8").trim();return null}catch(e){return console.warn("[license] readFile failed:",e.message),null}}function d(e,t){return r.createHash("sha256").update([e,t].join("||")).digest("hex").slice(0,16).toUpperCase()}function m(){let e=[],t=f("getmac",[]);if(t&&"string"==typeof t){let n=t.match(/([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}/g);if(n)for(let t of n){let n=t.replace(/-/g,":").toLowerCase();"00:00:00:00:00:00"!==n&&e.push(n)}}return[...new Set(e)]}function g(){let e=i.platform(),t=function(){let e=i.platform(),t="";try{if("win32"===e){let e=(0,l.spawnSync)("reg",["query","HKLM\\SOFTWARE\\Microsoft\\Cryptography","/v","MachineGuid"],{timeout:3e3,encoding:"utf8",windowsHide:!0});if(0===e.status&&e.stdout){let n=e.stdout;if("string"==typeof n){let e=n.match(/MachineGuid\s+REG_SZ\s+(.+)/);e&&(t=e[1].trim())}}}else if("darwin"===e){let e=f("ioreg",["-rd1","-c","IOPlatformExpertDevice"]);if(e){let n=e.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);n&&(t=n[1])}}else t=p("/etc/machine-id")||p("/var/lib/dbus/machine-id")||""}catch(e){console.warn("[license] OS ID 추출 실패:",e.message)}return t||`${e}-${i.arch()}-${i.totalmem()}`}(),n=[],r=[];for(let i of r="win32"===e?function(){if("win8+"!==function(){try{let e=(0,l.spawnSync)("cmd",["/c","ver"],{timeout:3e3,encoding:"utf8",windowsHide:!0});if(0===e.status&&e.stdout){let t=e.stdout;if("string"==typeof t&&t.includes("Windows 7"))return"win7"}return"win8+"}catch{return"win8+"}}())return console.log("[license] Windows 7 감지 – getmac 사용 (활성만)"),m();{console.log("[license] Windows 8+ 감지 – PowerShell 사용 (비활성 어댑터 포함)");let e=function(){let e=[],t=f("powershell",["-NoProfile","-Command","Get-NetAdapter -Physical | Select-Object -ExpandProperty MacAddress"],5e3);if(t&&"string"==typeof t)for(let n of t.split(/\r?\n/)){let t=n.trim().toLowerCase();/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(t)&&"00:00:00:00:00:00"!==t&&e.push(t)}return e}();return e.length>0?e:(console.warn("[license] PowerShell 실패 – getmac 폴백"),m())}}():"darwin"===e?function(){let e=[],t=f("ifconfig",[]);if(t&&"string"==typeof t){let n=t.match(/ether\s+([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/gi);if(n)for(let t of n){let n=t.split(/\s+/),r=n[1]?.toLowerCase();r&&"00:00:00:00:00:00"!==r&&e.push(r)}}return[...new Set(e)]}():function(){let e=[];try{let t="/sys/class/net";if(!s.existsSync(t))return e;for(let n of s.readdirSync(t)){if("lo"===n||n.startsWith("vnet")||n.startsWith("docker"))continue;let r=o.join(t,n,"address"),i=p(r);i&&"string"==typeof i&&"00:00:00:00:00:00"!==i&&!i.startsWith("02:")&&e.push(i.toLowerCase())}}catch(e){console.warn("[license] Linux MAC 수집 실패:",e.message)}return[...new Set(e)]}())n.push(d(t,i));if("win32"===e&&n.length<2)for(let e of(console.log("[license] NIC 부족 – HDD 시리얼로 보완"),function(){let e=[];try{let t=f("wmic",["logicaldisk","get","volumeserialnumber","/format:table"]);if(t&&"string"==typeof t){let n=t.match(/[0-9A-Fa-f]{8}/g);if(n)for(let t of n)e.push(t)}}catch(e){console.warn("[license] HDD 시리얼 수집 실패:",e.message)}return[...new Set(e)]}()))n.push(d(t,e));return console.log(`[license] getAllMachineIds: ${n.length} IDs (${r.length} NICs + ${n.length-r.length} HDDs) on ${e}`),0===n.length&&(console.warn("[license] No hardware found – using OS UUID"),n.push(d(t,"NO_HW_FALLBACK"))),n}let h=o.join(u(),"offline.ptzlic"),S=o.join(u(),"license.ptzreq");function A(){let e=g(),t={machineId:e[0]??"UNKNOWN",machineIds:e,requestedAt:new Date().toISOString(),product:c},n=r.createHmac("sha256",a).update(JSON.stringify(t)).digest("hex").slice(0,16);return{...t,sig:n}}function w(e){let t=e||A(),n=Buffer.from(JSON.stringify(t,null,2)).toString("base64");return s.mkdirSync(o.dirname(S),{recursive:!0}),s.writeFileSync(S,n,"utf8"),console.log("[license] License request saved at:",S),S}function E(e){try{let t=Buffer.from(e,"base64").toString("utf8"),{sig:n,...i}=JSON.parse(t),s=r.createHmac("sha256",a).update(JSON.stringify(i)).digest("hex");if(n!==s)return{valid:!1,reason:"라이선스 서명이 올바르지 않습니다"};if(i.product!==c)return{valid:!1,reason:"라이선스 제품이 일치하지 않습니다"};let o=g(),l=i.machineIds?.length?i.machineIds:[i.machineId],u=o.filter(e=>l.includes(e));if(0===u.length)return{valid:!1,reason:`이 PC에 발급된 라이선스가 아닙니다 (현재: ${o.length}, 라이선스: ${l.length}, 일치: 0)`};if(new Date(i.expiresAt)<new Date)return{valid:!1,reason:`라이선스가 만료됨 (${i.expiresAt.slice(0,10)})`};return{valid:!0,expiresAt:i.expiresAt,machineId:u[0],matchedIds:u}}catch(e){return console.error("[license] verifyLicense error:",e.message),{valid:!1,reason:"라이선스 파일을 읽을 수 없습니다"}}}function T(){if(!s.existsSync(h))return{valid:!1,reason:"NOT_FOUND"};try{let e=s.readFileSync(h,"utf8").trim();return E(e)}catch(e){return console.error("[license] verifyLicenseFile error:",e.message),{valid:!1,reason:"라이선스 파일을 읽을 수 없습니다"}}}}};var t=require("../../../../webpack-runtime.js");t.C(e);var n=e=>t(t.s=e),r=t.X(0,[276,972,23,637],()=>n(99380));module.exports=r})();