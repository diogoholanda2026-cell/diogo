import{b as w,c as J,d as G,e as K,f as Q}from"./parte.20261008151423.ZBDV4FQP.js";import"./parte.20261008151423.32E5XRFC.js";var o0=Object.freeze({PINTURA:0,VIDRO:1,PRETO:2,FAROL:3,LANTERNA:4,CROMADO:5,ARO:6,SOMBRA:7,FRENTE:8,TRASEIRA:9,CACAMBA:10,MADEIRA:11,CARGA:12,TAMBOR:13,BAU:14,PLASTICO:15}),e=o0,D=Object.freeze({c:8.6,l:2.5,h:3.1,cab:1.95,piso:1.28,roda:.52,wc:1.19,yCab:1.1,yVidro:1.95,deita:.2}),t0=Object.freeze({z0:1.85,y0:1.95,z1:-3.6,y1:2.55}),a0=Object.freeze(["basculante","carroceria","betoneira","bau"]),c0=Object.freeze({brita:{corpo:"basculante",cor:[126,124,120]},areia:{corpo:"basculante",cor:[198,170,118]},argila:{corpo:"basculante",cor:[150,84,54]},calcario:{corpo:"basculante",cor:[214,210,200]},tijolo:{corpo:"carroceria",cor:[176,82,50]},cimento:{corpo:"carroceria",cor:[182,182,176]},aco:{corpo:"carroceria",cor:[104,110,118]},vidro:{corpo:"carroceria",cor:[150,186,196]},madeira:{corpo:"carroceria",cor:[132,92,58]},serrada:{corpo:"carroceria",cor:[196,156,104]},concreto:{corpo:"betoneira",cor:[150,150,146]}}),C0=a=>c0[a]??{corpo:"bau",cor:[200,200,196]},_=class{constructor(){this.pos=[],this.nor=[],this.parte=[],this.idx=[]}get nv(){return this.pos.length/3}poli(n,o,r=0,i=null){let[c,t,m]=n,s=[t[0]-c[0],t[1]-c[1],t[2]-c[2]],R=[m[0]-c[0],m[1]-c[1],m[2]-c[2]],A=[s[1]*R[2]-s[2]*R[1],s[2]*R[0]-s[0]*R[2],s[0]*R[1]-s[1]*R[0]];for(let p=3;Math.hypot(...A)<1e-12&&p<n.length;p++)R=[n[p][0]-c[0],n[p][1]-c[1],n[p][2]-c[2]],A=[s[1]*R[2]-s[2]*R[1],s[2]*R[0]-s[0]*R[2],s[0]*R[1]-s[1]*R[0]];let v=Math.hypot(...A)||1,l=this.nv;n.forEach((p,C)=>{this.pos.push(p[0],p[1],p[2]),i?this.nor.push(i[C][0],i[C][1],i[C][2]):this.nor.push(A[0]/v,A[1]/v,A[2]/v),this.parte.push(o,r)});for(let p=1;p+1<n.length;p++)this.idx.push(l,l+p,l+p+1)}get tris(){return this.idx.length/3}fechar(){return{posicao:Float32Array.from(this.pos),normal:Float32Array.from(this.nor),parte:Float32Array.from(this.parte),indices:Uint16Array.from(this.idx),tris:this.idx.length/3}}};function b(a,n,o,r,i,c,t,m,{topo:s=m,frente:R=m,tras:A=m,fundo:v=!1,ci:l=0}={}){a.poli([[i,o,r],[i,c,r],[i,c,t],[i,o,t]],m,l),a.poli([[n,o,t],[n,c,t],[n,c,r],[n,o,r]],m,l),s!==null&&a.poli([[n,c,r],[n,c,t],[i,c,t],[i,c,r]],s,l),R!==null&&a.poli([[n,o,t],[i,o,t],[i,c,t],[n,c,t]],R,l),A!==null&&a.poli([[i,o,r],[n,o,r],[n,c,r],[i,c,r]],A,l),v&&a.poli([[n,o,r],[i,o,r],[i,o,t],[n,o,t]],m,l)}function n0(a,n,o,r,i,c,t,m){a.poli([[i,o,t],[i,c,t],[i,c,r],[i,o,r]],m),a.poli([[n,o,r],[n,c,r],[n,c,t],[n,o,t]],m),a.poli([[i,o,t],[n,o,t],[n,c,t],[i,c,t]],m),a.poli([[n,o,r],[i,o,r],[i,c,r],[n,c,r]],m),a.poli([[n,o,t],[i,o,t],[i,o,r],[n,o,r]],m)}function S(a,n,o,r,i,c,t){let s=[];for(let l=0;l<8;l++){let p=Math.PI*2*l/8+Math.PI/8;s.push([Math.cos(p)*i,Math.sin(p)*i])}let R=n+t*c/2,A=n-t*c/2;for(let l=0;l<8;l++){let[p,C]=s[l],[O,P]=s[(l+1)%8],d=[[R,o+C,r+p],[R,o+P,r+O],[A,o+P,r+O],[A,o+C,r+p]],M=[[0,C/i,p/i],[0,P/i,O/i],[0,P/i,O/i],[0,C/i,p/i]];a.poli(t>0?d:[...d].reverse(),e.PRETO,0,t>0?M:[...M].reverse())}let v=s.map(([l,p])=>[R+t*.004,o+p*.58,r+l*.58]);a.poli(t>0?[...v].reverse():v,e.ARO)}function e0(a){let{c:n,l:o,h:r,cab:i,roda:c,wc:t,yCab:m,yVidro:s,deita:R}=D,A=o/2,v=n/2,l=-n/2,p=v-i,C=r-.1,O=f=>v-.02-R*Math.min(1,Math.max(0,(f-s)/(C-s))),P={poli:(f,u,g)=>a.poli(f,u,0,g)},d=(f,u)=>{let g=t-f;return[[-g,m],[-g,s-.05],[-g+.04,C-.12],[-g+.16,C],[g-.16,C],[g-.04,C-.12],[g,s-.05],[g,m]].map(([E,T])=>[E,T,u===null?p:O(T)-u])},M=[d(0,null),d(0,.34),d(.05,.09),d(.17,0)],I=K(P,M,()=>e.PINTURA);Q(P,M[0],I[0],-1,()=>e.PINTURA);let X=M[3];for(let f of[[0,7,6,1],[1,6,5,2],[2,5,4,3]]){let u=f.map(h=>X[h]),g=G(J(w(u[1],u[0]),w(u[3],u[0])));P.poli(u,e.PINTURA,f.map(h=>G([g[0]+I[3][h][0]*.6,g[1]+I[3][h][1]*.6,g[2]+I[3][h][2]*.6])))}let Y=R/Math.hypot(R,C-s),Z=(C-s)/Math.hypot(R,C-s),B=(f,u,g)=>u<=s?[f,u,O(u)+g]:[f,u+g*Y,O(u)+g*Z],x=(f,u,g,h,E,T,L=f,F=u)=>{a.poli([B(f,g,T),B(u,g,T),B(F,h,T),B(L,h,T)],E)},N=t-.24;x(-N-.05,N+.05,s-.04,C-.12,e.PRETO,.004,-N+.02,N-.02),x(-N,N,s+.02,C-.18,e.VIDRO,.008,-N+.07,N-.07);for(let f of[-.62,.12])x(f,f+.5,s+.05,s+.08,e.PRETO,.012,f+.03,f+.53);for(let f=0;f<4;f++)x(-.78,.78,1.3+.13*f,1.37+.13*f,e.PRETO,.004);x(-.92,.92,m+.04,m+.13,e.PRETO,.004),x(-t+.03,t-.03,.95,m+.005,e.PLASTICO,0),b(a,-t+.12,C-.04,O(C)-.1,t-.12,C+.06,O(C)+.16,e.PRETO,{tras:null});for(let f of[-1,1]){let u=T=>f*(t+.006-.04*Math.max(0,T-(s-.05))/(C-.12-(s-.05))),g=s+.02,h=C-.24,E=[[u(g),g,v-1.05],[u(g),g,O(g)-.42],[u(h),h,O(h)-.42],[u(h),h,v-1.05]];a.poli(f>0?E.reverse():E,e.VIDRO)}a.corpo=a.idx.length,b(a,-A+.04,.42,v-.1,A-.04,.95,v+.14,e.PLASTICO,{tras:null});for(let f of[-1,1]){let u=f>0?A-.5:-A+.12;a.poli([[u,.72,v+.145],[u+.38,.72,v+.145],[u+.38,.9,v+.145],[u,.9,v+.145]],e.FAROL)}a.poli([[-.2,.5,v+.145],[.2,.5,v+.145],[.2,.63,v+.145],[-.2,.63,v+.145]],e.CROMADO);for(let f of[-1,1]){let u=f*t,g=f*(t+.34),h=O(2.3)-.36;b(a,Math.min(u,g),2.36,h-.02,Math.max(u,g),2.4,h+.02,e.PRETO,{frente:null,tras:null});let E=f*(t+.3),T=f*(t+.39);b(a,Math.min(E,T),1.98,h-.05,Math.max(E,T),2.48,h+.03,e.PRETO,{tras:e.CROMADO}),b(a,Math.min(E,T),1.78,h-.04,Math.max(E,T),1.94,h+.03,e.PRETO,{tras:e.CROMADO})}for(let f of[-1,1]){let u=f>0?t-.12:-t-.02,g=f>0?t+.02:-t+.12;for(let h of[.55,.83])b(a,u,h,v-.62,g,h+.05,v-.2,e.PRETO,{tras:null,frente:null})}b(a,A-.75,.48,p-1,A-.12,.98,p-.25,e.CROMADO,{fundo:!0});for(let f of[-1,1])b(a,f*.42-.08,.62,l+.12,f*.42+.08,.92,p,e.PRETO,{topo:null});b(a,-A+.05,.62,l,A-.05,.92,l+.14,e.PRETO,{topo:null});for(let f of[-1,1]){let u=f>0?A-.42:-A+.1;a.poli([[u+.32,.66,l-.006],[u,.66,l-.006],[u,.86,l-.006],[u+.32,.86,l-.006]],e.LANTERNA)}let j=l+1.55,z=l+2.95,H=v-1.28;for(let f of[-1,1]){S(a,f*(A-.18),c,H,c,.32,f),S(a,f*(A-.28),c,j,c,.55,f),S(a,f*(A-.28),c,z,c,.55,f);let u=3;for(let g=0;g<u;g++){let h=Math.PI*g/u,E=Math.PI*(g+1)/u,T=(q,$,y)=>[y,c+Math.sin(q)*$,H+Math.cos(q)*$],L=f*(A-.01),F=f*(A-.36),k=[T(h,c+.03,L),T(h,c+.12,L),T(E,c+.12,L),T(E,c+.03,L)];a.poli(f>0?[...k].reverse():k,e.PRETO);let V=[T(h,c+.12,L),T(h,c+.12,F),T(E,c+.12,F),T(E,c+.12,L)];a.poli(f>0?[...V].reverse():V,e.PRETO)}b(a,f>0?A-.58:-A+.02,1.08,j-.62,f>0?A-.02:-A+.58,1.16,z+.62,e.PRETO)}return{w:A,zF:v,zT:l,zc:p}}function s0(a,n,o,r,i,c,t,m){let A=(l,p)=>{let C=l/4,O=p/6,P=Math.min(C,1-C)*2,d=Math.min(O,1-O)*2;return t+(m-t)*Math.sqrt(Math.max(0,P))*Math.min(1,d*1.6)-(P<.01||d<.01?.05:0)},v=(l,p)=>[n+(o-n)*l/4,A(l,p),r+(i-r)*p/6];for(let l=0;l<6;l++)for(let p=0;p<4;p++)a.poli([v(p,l),v(p,l+1),v(p+1,l+1),v(p+1,l)],e.CARGA)}function r0(a,n){let{w:o,zT:r,zc:i}=n,c=D.piso,t=2.45,m=r+.05,s=i-.12;b(a,-o,c-.12,m,o,t,s,e.CACAMBA,{topo:null,fundo:!0}),n0(a,-o+.08,c,m+.08,o-.08,t,s-.08,e.CACAMBA),a.poli([[-o,t,m],[-o,t,s],[-o+.08,t,s-.08],[-o+.08,t,m+.08]],e.CACAMBA),a.poli([[o-.08,t,m+.08],[o-.08,t,s-.08],[o,t,s],[o,t,m]],e.CACAMBA),a.poli([[-o,t,s],[o,t,s],[o-.08,t,s-.08],[-o+.08,t,s-.08]],e.CACAMBA),a.poli([[o,t,m],[-o,t,m],[-o+.08,t,m+.08],[o-.08,t,m+.08]],e.CACAMBA);for(let R of[-1,1])for(let A=1;A<4;A++)b(a,R>0?o:-o-.05,c,m+(s-m)*A/4-.06,R>0?o+.05:-o,t-.05,m+(s-m)*A/4+.06,e.CACAMBA,{tras:null,frente:null});a.poli([[-o+.1,t,s],[o-.1,t,s],[o-.1,t+.05,s+.55],[-o+.1,t+.05,s+.55]].reverse(),e.CACAMBA),s0(a,-o+.1,o-.1,m+.1,s-.1,c,2.15,2.75)}function i0(a,n){let{w:o,zT:r,zc:i}=n,c=D.piso,t=r+.02,m=i-.1;b(a,-o,c-.18,t,o,c,m,e.MADEIRA,{fundo:!0});for(let A of[-1,1])for(let[v,l]of[[c+.06,c+.3],[c+.38,c+.62]])b(a,A>0?o-.05:-o,v,t,A>0?o:-o+.05,l,m,e.MADEIRA);b(a,-o,c,t,o,c+.62,t+.05,e.MADEIRA,{frente:null}),b(a,-o,c,m-.06,o,c+1.5,m,e.CACAMBA);let s=(m-.12-(t+.12))/5,R=1;for(let A=4;A>=0;A--)for(let v of[-1,1]){let l=t+.12+A*s+.04,p=v>0?.06:-o+.14,C=v>0?o-.14:-.06;b(a,p,c,l,C,c+.14,l+s-.08,e.MADEIRA,{topo:null,ci:R}),b(a,p+.03,c+.14,l+.03,C-.03,c+1,l+s-.11,e.CARGA,{ci:R}),R++}}function l0(a,n){let{w:o,zT:r,zc:i}=n;b(a,-o+.3,1,r+.2,o-.3,1.28,i-.1,e.PRETO),b(a,-.45,1.28,i-.75,.45,2.3,i-.12,e.CROMADO);let c=t0,t=[0,c.y1-c.y0,c.z1-c.z0],m=Math.hypot(t[1],t[2]),s=[0,t[1]/m,t[2]/m],R=[1,0,0],A=[0,-s[2],s[1]],v=[[0,.55],[.08,.98],[.42,1.12],[.72,.95],[.95,.52],[1,.4]],l=10,p=v.map(([C,O])=>{let P=[0,c.y0+t[1]*C,c.z0+t[2]*C],d=[];for(let M=0;M<l;M++){let I=2*Math.PI*M/l;d.push([P[0]+(R[0]*Math.cos(I)+A[0]*Math.sin(I))*O,P[1]+(R[1]*Math.cos(I)+A[1]*Math.sin(I))*O,P[2]+(R[2]*Math.cos(I)+A[2]*Math.sin(I))*O])}return d});for(let C=0;C+1<p.length;C++)for(let O=0;O<l;O++){let P=(O+1)%l;a.poli([p[C][O],p[C+1][O],p[C+1][P],p[C][P]],e.TAMBOR)}a.poli([...p[0]],e.TAMBOR),a.poli([...p[p.length-1]].reverse(),e.PRETO),b(a,-.32,2.2,r-.05,.32,2.65,r+.45,e.CROMADO),a.poli([[-.2,1.45,r-.4],[.2,1.45,r-.4],[.2,2.2,r+.05],[-.2,2.2,r+.05]].reverse(),e.PRETO);for(let C of[i-.4,r+1])b(a,-.7,1.28,C-.12,.7,1.75,C+.12,e.PRETO)}function f0(a,n){let{w:o,zT:r,zc:i}=n;b(a,-o,D.piso-.1,r+.02,o,3.45,i-.12,e.BAU,{fundo:!0,tras:e.BAU}),a.poli([[o-.02,1.3,r-.004],[-o+.02,1.3,r-.004],[-o+.02,3.4,r-.004],[o-.02,3.4,r-.004]],e.CROMADO)}function W(a){let n=D.l/2+.15,o=D.c/2+.2;a.poli([[-n,.03,o],[n,.03,o],[n,.03,-o],[-n,.03,-o]],e.SOMBRA)}function A0(a){let n=new _,o=e0(n);return{basculante:r0,carroceria:i0,betoneira:l0,bau:f0}[a](n,o),W(n),n.fechar()}function p0(a){let n=new _,{c:o,l:r,h:i,cab:c}=D,t=r/2,m=o/2,s=-o/2,R=m-c;b(n,-t,.5,R,t,i,m,e.PINTURA,{frente:e.FRENTE,tras:null});let A=a==="basculante"?e.CACAMBA:a==="carroceria"?e.MADEIRA:a==="betoneira"?e.TAMBOR:e.BAU,v=a==="bau"?3.45:a==="betoneira"?2.9:a==="carroceria"?2.25:2.45;return b(n,-t,.5,s,t,v,R-.1,A,{tras:e.TRASEIRA,frente:null,topo:a==="basculante"||a==="carroceria"?e.CARGA:A}),W(n),n.fechar()}var U=new Map;function u0(a,n=0){if(!a0.includes(a))throw new Error(`carroceria desconhecida: ${a}`);let o=`${a}:${n}`;return U.has(o)||U.set(o,n?p0(a):A0(a)),U.get(o)}var v0=`
attribute vec2 aParte2;
attribute vec4 aCab;
attribute vec4 aCarga;
flat varying vec4 vCab;
flat varying vec4 vCarga;
flat varying float vParte;
varying vec3 vCamLocal;
uniform float gCamTempo;
uniform vec4 gCamTambor;
uniform float gCamPiso;
vec3 camGira(vec3 p,vec3 o,vec3 d,float a){
vec3 v=p - o;
float c=cos(a);
float s=sin(a);
return o + v * c + cross(d,v)* s + d * dot(d,v)*(1.0 - c);
}
`,R0=`
vec3 objectNormal=normal;
vec3 camPos=position;
{
int parte=int(aParte2.x + 0.5);
vParte=aParte2.x;
vCab=aCab;
vCarga=aCarga;
vCamLocal=vec3(position.xy,0.0);
if(parte==12){
float n=aCarga.a;
if(aParte2.y > 0.5){
if(aParte2.y > n + 0.01)camPos=vec3(0.0);
}else{
camPos.y=gCamPiso +(camPos.y - gCamPiso)* clamp(n / 10.0,0.0,1.0);
if(n < 0.5)camPos=vec3(0.0);
}
}
if(parte==13){
vec3 o=vec3(0.0,gCamTambor.x,gCamTambor.y);
vec3 d=normalize(vec3(0.0,gCamTambor.z - gCamTambor.x,gCamTambor.w - gCamTambor.y));
vec3 v=position - o;
float ax=dot(v,d);
vec3 r=v - d * ax;
vec3 e2=vec3(0.0,-d.z,d.y);
vCamLocal.z=atan(dot(r,e2),r.x)/ 6.2831853 + ax * 0.32;
float a=gCamTempo * 1.6 + floor(aCab.a / 4.0)* 0.7;
camPos=camGira(position,o,d,a);
objectNormal=camGira(normal,vec3(0.0),d,a);
}
}
`,g0=`
vec3 transformed=camPos;
`,h0=`
flat varying vec4 vCab;
flat varying vec4 vCarga;
flat varying float vParte;
varying vec3 vCamLocal;
uniform float gCamNoite;
float gCamRug=0.4;
float gCamMetal=0.0;
vec3 camLinear(vec3 s){return pow(s / 255.0,vec3(2.2));}
`,O0=`
{
int p=int(vParte + 0.5);
vec3 cab=min(camLinear(vCab.rgb),vec3(0.75));
vec3 c;
if(p==0 || p==8){c=cab;gCamRug=0.36;}
else if(p==1){c=vec3(0.03,0.034,0.038);gCamRug=0.1;}
else if(p==2){c=vec3(0.025);gCamRug=0.8;}
else if(p==3){c=vec3(0.55,0.55,0.52);gCamRug=0.15;}
else if(p==4){c=vec3(0.25,0.01,0.01);gCamRug=0.2;}
else if(p==5){c=vec3(0.55,0.56,0.56);gCamRug=0.35;gCamMetal=0.6;}
else if(p==6){c=vec3(0.3);gCamRug=0.3;gCamMetal=0.8;}
else if(p==9 || p==10){c=vec3(0.07,0.072,0.075);gCamRug=0.55;gCamMetal=0.3;}
else if(p==11){c=vec3(0.2,0.12,0.065);gCamRug=0.85;}
else if(p==12){c=camLinear(vCarga.rgb);gCamRug=0.95;}
else if(p==13){
float l=step(0.5,fract(vCamLocal.z * 3.0));
c=mix(cab,vec3(0.72,0.72,0.7),l);
gCamRug=0.35;
}
else if(p==14){c=vec3(0.7,0.7,0.68);gCamRug=0.45;}
else if(p==15){c=vec3(0.05,0.052,0.055);gCamRug=0.7;}
else{c=vec3(0.0);gCamRug=1.0;}
diffuseColor.rgb=c;
}
`,b0=`
float roughnessFactor=gCamRug;
`,T0=`
float metalnessFactor=gCamMetal;
`,P0=`
{
int p=int(vParte + 0.5);
int luz=int(mod(vCab.a,4.0)+ 0.5);
if(p==3 &&(luz & 1)!=0)totalEmissiveRadiance +=vec3(1.0,0.88,0.7)* 9.0 * gCamNoite;
if(p==4)totalEmissiveRadiance +=vec3(1.0,0.04,0.02)*(((luz & 2)!=0 ? 5.0 : 0.0)+ 2.5 * gCamNoite * float(luz & 1));
if(p==8 || p==9){
float x=abs(vCamLocal.x);
float par=step(0.45,x)* step(x,1.15)* step(0.55,vCamLocal.y)* step(vCamLocal.y,0.95);
if(p==8 &&(luz & 1)!=0)totalEmissiveRadiance +=vec3(1.0,0.88,0.7)* 6.0 * gCamNoite * par;
if(p==9)totalEmissiveRadiance +=vec3(1.0,0.04,0.02)* par *(((luz & 2)!=0 ? 4.0 : 0.0)+ 1.8 * gCamNoite * float(luz & 1));
}
}
`;function E0(){}export{D as CAMINHAO,O0 as CAMINHAO_FRAGMENTO_COR,P0 as CAMINHAO_FRAGMENTO_EMISSIVO,T0 as CAMINHAO_FRAGMENTO_METAL,h0 as CAMINHAO_FRAGMENTO_PARS,b0 as CAMINHAO_FRAGMENTO_RUGOSIDADE,g0 as CAMINHAO_VERTICE_MAIN,R0 as CAMINHAO_VERTICE_NORMAL,v0 as CAMINHAO_VERTICE_PARS,c0 as CARGAS,a0 as CORPOS,o0 as PARTE_CAMINHAO,t0 as TAMBOR,C0 as cargaDe,u0 as malhaCaminhao,E0 as registrar};
