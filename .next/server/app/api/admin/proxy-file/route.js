"use strict";(()=>{var e={};e.id=601,e.ids=[601],e.modules={53524:e=>{e.exports=require("@prisma/client")},85890:e=>{e.exports=require("better-sqlite3")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},27790:e=>{e.exports=require("assert")},78893:e=>{e.exports=require("buffer")},61282:e=>{e.exports=require("child_process")},84770:e=>{e.exports=require("crypto")},17702:e=>{e.exports=require("events")},92048:e=>{e.exports=require("fs")},32615:e=>{e.exports=require("http")},35240:e=>{e.exports=require("https")},19801:e=>{e.exports=require("os")},55315:e=>{e.exports=require("path")},86624:e=>{e.exports=require("querystring")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},71568:e=>{e.exports=require("zlib")},3547:(e,n,t)=>{t.r(n),t.d(n,{originalPathname:()=>O,patchFetch:()=>L,requestAsyncStorage:()=>S,routeModule:()=>w,serverHooks:()=>h,staticGenerationAsyncStorage:()=>x});var r={};t.r(r),t.d(r,{DELETE:()=>E,GET:()=>T,POST:()=>g});var i=t(49303),o=t(88716),s=t(60670),l=t(87070),a=t(84427),u=t(92048),c=t.n(u),p=t(55315),d=t.n(p);let f=d().join(process.cwd(),"public","downloads"),m=new Set([".exe",".zip",".sh",".bat",".msi",".dmg",".appimage"]);function A(){c().existsSync(f)||c().mkdirSync(f,{recursive:!0})}async function T(){let{error:e}=await (0,a.oT)();if(e)return e;try{A();let e=c().readdirSync(f).map(e=>{let n=c().statSync(d().join(f,e));return{filename:e,size:n.size,uploadedAt:n.mtime.toISOString(),downloadUrl:`/downloads/${e}`}});return l.NextResponse.json({files:e})}catch(e){return console.error("List proxy files error:",e),l.NextResponse.json({error:"Failed to list files"},{status:500})}}async function g(e){let{error:n}=await (0,a.kF)();if(n)return n;try{A();let n=(await e.formData()).get("file");if(!n)return l.NextResponse.json({error:"No file provided"},{status:400});let t=d().basename(n.name).replace(/[^a-zA-Z0-9._\-]/g,"_");if(!t)return l.NextResponse.json({error:"Invalid filename"},{status:400});let r=d().extname(t).toLowerCase();if(!m.has(r))return l.NextResponse.json({error:`Not allowed extension. Allowed: ${[...m].join(", ")}`},{status:400});let i=Buffer.from(await n.arrayBuffer());return c().writeFileSync(d().join(f,t),i),l.NextResponse.json({success:!0,filename:t,size:i.length,downloadUrl:`/downloads/${t}`})}catch(e){return console.error("Upload proxy file error:",e),l.NextResponse.json({error:"Failed to upload file"},{status:500})}}async function E(e){let{error:n}=await (0,a.kF)();if(n)return n;try{let{filename:n}=await e.json();if(!n)return l.NextResponse.json({error:"Filename required"},{status:400});let t=d().basename(n),r=d().join(f,t);if(!c().existsSync(r))return l.NextResponse.json({error:"File not found"},{status:404});return c().unlinkSync(r),l.NextResponse.json({success:!0})}catch(e){return console.error("Delete proxy file error:",e),l.NextResponse.json({error:"Failed to delete file"},{status:500})}}let w=new i.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/admin/proxy-file/route",pathname:"/api/admin/proxy-file",filename:"route",bundlePath:"app/api/admin/proxy-file/route"},resolvedPagePath:"E:\\Web\\devroot\\PTZ_www\\integrated\\20260302-1403-Base\\ptzcontroller_admin\\app\\api\\admin\\proxy-file\\route.ts",nextConfigOutput:"standalone",userland:r}),{requestAsyncStorage:S,staticGenerationAsyncStorage:x,serverHooks:h}=w,O="/api/admin/proxy-file/route";function L(){return(0,s.patchFetch)({serverHooks:h,staticGenerationAsyncStorage:x})}},84427:(e,n,t)=>{t.d(n,{kF:()=>a,oT:()=>l,xn:()=>u});var r=t(75571),i=t(87070),o=t(38961),s=t(48843);async function l(){let e=await (0,r.getServerSession)(o.L);return e?{session:e,error:null}:await (0,s.ZI)()?{session:null,error:i.NextResponse.json({error:"Unauthorized"},{status:401})}:{session:(0,s.N9)(),error:null}}async function a(){let e=await (0,r.getServerSession)(o.L);if(!e)return await (0,s.ZI)()?{session:null,error:i.NextResponse.json({error:"Unauthorized"},{status:401})}:{session:null,error:i.NextResponse.json({error:"Admin features unavailable in offline mode"},{status:403})};let n=e.user;return n?.role!=="admin"?{session:null,error:i.NextResponse.json({error:"Forbidden"},{status:403})}:{session:e,error:null}}function u(e){return e.user??{}}},38961:(e,n,t)=>{t.d(n,{L:()=>x});var r=t(53797),i=t(13539),o=t(9487),s=t(42023),l=t.n(s),a=t(85890),u=t.n(a),c=t(55315),p=t.n(c),d=t(19801),f=t.n(d),m=t(92048),A=t.n(m);let T=null;function g(){try{let e;let n=("win32"===process.platform?e=p().join(process.env.PROGRAMDATA||"C:\\ProgramData","PTZController"):"darwin"===process.platform?e=p().join(process.env.HOME||f().homedir(),"Library/Application Support/PTZController"):e=p().join(process.env.HOME||f().homedir(),".config/PTZController"),A().existsSync(e)||A().mkdirSync(e,{recursive:!0}),p().join(e,"offline.db"));(T=new(u())(n)).pragma("journal_mode = WAL"),T.pragma("synchronous = NORMAL"),T.exec(`
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
    `),console.log("[OfflineDB] Initialized at:",n)}catch(e){throw console.error("[OfflineDB] Initialization failed:",e),e}}function E(){return T||g(),T}function w(e){return E().prepare("SELECT * FROM offline_users WHERE email = ?").get(e)??null}async function S(e,n,t){let r=w(e);if(!r)return null;if(r.lockedUntil&&new Date(r.lockedUntil)>new Date)return console.warn("[OfflineDB] Account locked until:",r.lockedUntil),null;if(1!==r.isActive)return console.warn("[OfflineDB] Account is inactive"),null;if(!await t.compare(n,r.passwordHash)){let n=(r.failedLoginAttempts??0)+1,t=n>=5;return E().prepare(`
      UPDATE offline_users
      SET 
        failedLoginAttempts = ?,
        lastFailedLoginAt = ?,
        lockedUntil = ?
      WHERE email = ?
    `).run(n,new Date().toISOString(),t?new Date(Date.now()+18e5).toISOString():null,e),console.warn("[OfflineDB] Failed login attempt for:",e,`(${n}/5)`),null}return E().prepare(`
    UPDATE offline_users
    SET 
      failedLoginAttempts = 0,
      lastFailedLoginAt = NULL,
      lockedUntil = NULL,
      lastOnlineLoginAt = ?,
      updatedAt = ?
    WHERE email = ?
  `).run(new Date().toISOString(),new Date().toISOString(),e),w(e)}try{g(),console.log("[Auth] Offline DB initialized successfully")}catch(e){console.warn("[Auth] Offline DB initialization failed (non-critical):",e)}let x={adapter:(0,i.N)(o.prisma),providers:[(0,r.Z)({name:"Credentials",credentials:{email:{label:"Email",type:"email"},password:{label:"Password",type:"password"}},async authorize(e){if(!e?.email||!e?.password)return console.warn("[Auth] Missing email or password"),null;try{console.log("[Auth] Attempting online authentication for:",e.email);let n=await Promise.race([o.prisma.user.findUnique({where:{email:e.email}}),new Promise(e=>setTimeout(()=>e(null),3e3))]);if(n&&n.password){if(await l().compare(e.password,n.password)){console.log("[Auth] Online login successful:",e.email);try{await function(e){let n=E(),t=e.id||`offline-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,r=new Date().toISOString();return w(e.email)?n.prepare(`
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
    `).run(e.name,e.organization??null,e.passwordHash,e.role,e.machineId??null,e.lastMachineId??null,e.licenseStatus??null,e.licenseExpiresAt??null,e.lastOnlineLoginAt??null,e.lastSyncAt??null,e.isInOfflineMode??0,e.offlineSessionToken??null,e.offlineStartedAt??null,e.platform??null,e.appVersion??null,e.failedLoginAttempts??0,e.lastFailedLoginAt??null,e.lockedUntil??null,e.isActive??1,r,e.email):n.prepare(`
      INSERT INTO offline_users (
        id, email, name, organization, passwordHash, role,
        machineId, lastMachineId, licenseStatus, licenseExpiresAt,
        lastOnlineLoginAt, lastSyncAt, isInOfflineMode,
        offlineSessionToken, offlineStartedAt, platform, appVersion,
        failedLoginAttempts, lastFailedLoginAt, lockedUntil, isActive,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(t,e.email,e.name,e.organization??null,e.passwordHash,e.role,e.machineId??null,e.lastMachineId??null,e.licenseStatus??null,e.licenseExpiresAt??null,e.lastOnlineLoginAt??null,e.lastSyncAt??null,e.isInOfflineMode??0,e.offlineSessionToken??null,e.offlineStartedAt??null,e.platform??null,e.appVersion??null,e.failedLoginAttempts??0,e.lastFailedLoginAt??null,e.lockedUntil??null,e.isActive??1,e.createdAt??r,r),w(e.email)}({email:n.email,name:n.name||"User",organization:n.organization||void 0,passwordHash:n.password,role:n.role||"user",lastOnlineLoginAt:new Date().toISOString(),lastSyncAt:new Date().toISOString(),platform:process.platform,appVersion:process.env.npm_package_version}),console.log("[Auth] Offline user saved:",n.email)}catch(e){console.warn("[Auth] Failed to save offline user:",e)}return{id:n.id,email:n.email,name:n.name,role:n.role}}console.warn("[Auth] Online login failed - invalid password:",e.email)}else n?console.warn("[Auth] Online login failed - no password hash:",e.email):console.warn("[Auth] Online login failed - user not found:",e.email)}catch(e){console.error("[Auth] Online DB error:",e.message)}console.log("[Auth] Attempting offline authentication...");try{let t=await S(e.email,e.password,l());if(t){var n;return console.log("[Auth] Offline login successful:",e.email),n=t.email,E().prepare(`
    UPDATE offline_users
    SET 
      isInOfflineMode = ?,
      offlineStartedAt = ?,
      machineId = ?,
      platform = ?,
      appVersion = ?,
      updatedAt = ?
    WHERE email = ?
  `).run(1,new Date().toISOString(),(void 0)??null,process.platform,process.env.npm_package_version??null,new Date().toISOString(),n),{id:t.id,email:t.email,name:t.name,role:t.role}}console.warn("[Auth] Offline login failed:",e.email)}catch(e){console.error("[Auth] Offline authentication error:",e)}return console.warn("[Auth] Login failed for:",e.email),null}})],session:{strategy:"jwt",maxAge:86400},callbacks:{jwt:async({token:e,user:n})=>(n&&(e.role=n?.role??"user",e.id=n?.id),e),session:async({session:e,token:n})=>(e?.user&&(e.user.role=n?.role,e.user.id=n?.id),e)},pages:{signIn:"/login"},secret:process.env.NEXTAUTH_SECRET}}};var n=require("../../../../webpack-runtime.js");n.C(e);var t=e=>n(n.s=e),r=n.X(0,[276,972,23,637,843],()=>t(3547));module.exports=r})();