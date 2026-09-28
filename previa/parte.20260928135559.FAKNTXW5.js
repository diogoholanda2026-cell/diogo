import{a as X}from"./parte.20260928135559.3MU2RXFU.js";var Q={};X(Q,{copas:()=>Y,espectroOndas:()=>O,fbm:()=>Z,gradiente:()=>$,hash2:()=>w,hashF:()=>b,registrar:()=>K,texturaOndas:()=>J,valor:()=>S,worley:()=>k});function w(t,a,l=0){let e=(Math.imul(t|0,668265261)^Math.imul(a|0,374761393)^Math.imul(l|0,2654435761))>>>0;return e^=e>>>16,e=Math.imul(e,2146121005),e^=e>>>15,e=Math.imul(e,2221713035),e^=e>>>16,e>>>0}var b=(t,a,l=0)=>w(t,a,l)/4294967296,y=(t,a)=>(t%a+a)%a,C=t=>t*t*t*(t*(t*6-15)+10);function S(t,a,l=0,e=0){let s=Math.floor(t),m=Math.floor(a),u=C(t-s),f=C(a-m),c=(h,R)=>e>0?b(y(h,e),y(R,e),l):b(h,R,l),i=c(s,m),x=c(s+1,m),p=c(s,m+1),n=c(s+1,m+1);return i+(x-i)*u+(p-i)*f+(i-x-p+n)*u*f}var N=new Float64Array(256),L=new Float64Array(256);for(let t=0;t<256;t++)N[t]=Math.cos((t+.5)/256*Math.PI*2),L[t]=Math.sin((t+.5)/256*Math.PI*2);function $(t,a,l=0,e=0){let s=Math.floor(t),m=Math.floor(a),u=t-s,f=a-m,c=(o,d,P,F)=>{let M=(e>0?w(y(o,e),y(d,e),l):w(o,d,l))>>>24;return N[M]*P+L[M]*F},i=C(u),x=C(f),p=c(s,m,u,f),n=c(s+1,m,u-1,f),h=c(s,m+1,u,f-1),R=c(s+1,m+1,u-1,f-1),T=p+(n-p)*i,r=h+(R-h)*i;return(T+(r-T)*x)*1.4142}function Z(t,a,{s:l=0,oitavas:e=5,periodo:s=0,ganho:m=.5,tipo:u="valor"}={}){let f=u==="gradiente"?$:S,c=0,i=1,x=0,p=1;for(let n=0;n<e;n++)c+=i*f(t*p,a*p,l+n*1013|0,s>0?s*p:0),x+=i,i*=m,p*=2;return c/x}function k(t,a,l=0,e=0){let s=Math.floor(t),m=Math.floor(a),u=9,f=9,c=0;for(let i=-1;i<=1;i++)for(let x=-1;x<=1;x++){let p=s+x,n=m+i,h=e>0?y(p,e):p,R=e>0?y(n,e):n,T=p+b(h,R,l)-t,r=n+b(h,R,l+7)-a,o=Math.sqrt(T*T+r*r);o<u?(f=u,u=o,c=w(h,R,l+13)):o<f&&(f=o)}return{f1:u,f2:f,id:c}}var G=t=>Math.max(0,Math.min(255,Math.round(t*255)));function Y(t,a,l=0){let e=0;for(let[s,m,u]of[[16,1.25,l],[26,1.5,l+57]]){let f=k(t*s,a*s,u,s),c=.45+.55*((f.id>>>8)/16777216),i=m*(.8+.5*((f.id&255)/255));e=Math.max(e,c*Math.max(0,1-f.f1*i))}return e}function O(t=7,{componentes:a=128,kMin:l=2,kMax:e=40}={}){let s=[],m=new Set,u=Math.log(l),f=Math.log(Math.max(l+1,e));for(let c=0;s.length<a&&c<a*12;c++){let i=Math.exp(u+b(c,1,t)*(f-u)),x=b(c,4,t)<.2,p=x?1.9+(b(c,2,t)-.5)*.9:(b(c,2,t)-.5)*2.1,n=Math.round(i*Math.cos(p)),h=Math.round(i*Math.sin(p));if(!n&&!h||m.has(`${n},${h}`)||m.has(`${-n},${-h}`))continue;m.add(`${n},${h}`);let R=Math.hypot(n,h),T=1-Math.exp(-((R/6)**2));s.push({kx:n,kz:h,amp:R**-1.35*T*(x?.6:1),fase:b(c,3,t)*Math.PI*2})}return s}function J(t=256,a=7){let l=O(a,{kMin:2,kMax:Math.max(3,Math.floor(t/6))}),e=new Float32Array(t*t),s=new Float32Array(t),m=new Float32Array(t),u=new Float32Array(t),f=new Float32Array(t),c=2*Math.PI/t;for(let r of l){for(let o=0;o<t;o++)s[o]=Math.sin(c*r.kx*o)*r.amp,m[o]=Math.cos(c*r.kx*o)*r.amp,u[o]=Math.sin(c*r.kz*o+r.fase),f[o]=Math.cos(c*r.kz*o+r.fase);for(let o=0;o<t;o++){let d=o*t,P=f[o],F=u[o];for(let M=0;M<t;M++)e[d+M]+=s[M]*P+m[M]*F}}let i=new Float32Array(t*t),x=new Float32Array(t*t),p=0,n=0;for(let r=0;r<t;r++)for(let o=0;o<t;o++){let d=r*t+o;i[d]=(e[r*t+y(o+1,t)]-e[r*t+y(o-1,t)])/2,x[d]=(e[y(r+1,t)*t+o]-e[y(r-1,t)*t+o])/2,p+=i[d]*i[d]+x[d]*x[d],n+=e[d]*e[d]}let h=.5/Math.max(1e-9,Math.sqrt(p/(t*t))),R=.092/Math.max(1e-9,Math.sqrt(n/(t*t))),T=new Uint8Array(t*t*4);for(let r=0;r<t*t;r++){let o=i[r]*h,d=x[r]*h,P=Math.hypot(o,1,d);T[4*r]=G(.5-.5*o/P),T[4*r+1]=G(.5-.5*d/P),T[4*r+2]=255,T[4*r+3]=G(.5+e[r]*R)}return T}function K(){}var A=Object.freeze({sombra:"#141c0f",escura:"#27351d",media:"#344428",clara:"#4a5731",embauba:"#626b52",ipe:"#9c873f",quaresmeira:"#65465f"}),tt=t=>{let a=l=>{let e=parseInt(t.slice(1+2*l,3+2*l),16)/255;return e<=.04045?e/12.92:((e+.055)/1.055)**2.4};return[a(0),a(1),a(2)]},g=t=>`vec3(${tt(t).map(a=>a.toFixed(5)).join(", ")})`,U=`
float copaSecundaria(vec4 rc,vec4 rm){return smoothstep(0.42,0.78,rm.x * 0.6 + rc.y * 0.4);}
vec3 copaCor(vec4 rc,vec4 rf,vec4 rm){
float sec=copaSecundaria(rc,rm);
vec3 c=mix(${g(A.escura)},${g(A.media)},smoothstep(0.25,0.75,rc.y * 0.5 + rf.y * 0.5));
c=mix(c,${g(A.clara)},sec * 0.55 + smoothstep(0.7,0.92,rf.w)* 0.25);
c=mix(c,${g(A.embauba)},smoothstep(0.78,0.95,rf.x * 0.5 + rc.x * 0.5)* 0.5);
float flor=smoothstep(0.9,0.97,rf.w * 0.5 + rc.w * 0.5);
c=mix(c,mix(${g(A.ipe)},${g(A.quaresmeira)},step(0.5,rm.y)),flor * 0.55);
float coroa=mix(rc.z,rf.z,sec);
return mix(${g(A.sombra)},c,0.3 + 0.7 * smoothstep(0.04,0.5,coroa));
}
float copaRelevo(vec4 rc,vec4 rf,vec4 rm,float kf){
float sec=copaSecundaria(rc,rm);
return(mix(2.6 * rc.z + 0.7 * rf.z * kf,1.6 * rf.z * kf + 0.6 * rc.z,sec)+ 0.3 * rf.w * kf)*(0.6 + 0.8 * rf.y);
}
float copaRelevo(vec4 rc,vec4 rf,vec4 rm){return copaRelevo(rc,rf,rm,1.0);}
`;var B=Object.freeze([{id:"grama",nome:"grama tropical",cor:"#5f6536",rug:.93,escala:3.1,relevo:.05},{id:"capim",nome:"capim seco",cor:"#8e8257",rug:.94,escala:3.7,relevo:.06},{id:"terraRoxa",nome:"terra roxa",cor:"#855a46",rug:.96,escala:4.3,relevo:.04},{id:"terraClara",nome:"terra clara",cor:"#a48763",rug:.95,escala:4.1,relevo:.05},{id:"granito",nome:"granito",cor:"#7f7a73",rug:.74,escala:6.3,relevo:.14},{id:"areia",nome:"areia de praia",cor:"#bba986",rug:.9,escala:2.3,relevo:.025},{id:"folhico",nome:"folhiço",cor:"#4d4030",rug:.95,escala:2.9,relevo:.05},{id:"concreto",nome:"piso de concreto",cor:"#9b978f",rug:.86,escala:4.7,relevo:.015}]),E=Object.freeze({gramaVerde:"#56623a",gramaSeca:"#6f6a3c",gramado:"#66703f",asfalto:"#4a4b4c",restinga:"#48503a"}),v=B.length,W=9,et=16,ot=.65,at=ot.toFixed(2),q=t=>Number.isInteger(t)?`${t}.0`:String(t),_=t=>t.map(q).join(", "),z=`
uniform highp sampler2D uTerDados;
uniform highp sampler2D uTerRuido;
uniform vec4 uTerGrade;
uniform vec4 uTerMapa;
uniform vec4 uTerFora;
uniform float uTerEstacao;
vec2 terUVDados(vec2 w){return((w - uTerGrade.xy)/ uTerGrade.z + 0.5)/ uTerGrade.w;}
vec2 terUVMapa(vec2 w){return(w - uTerMapa.xy)* uTerMapa.w;}
float terDistFora(vec2 w){
vec2 d=max(uTerMapa.xy - w,w -(uTerMapa.xy + uTerMapa.z));
return max(d.x,d.y);
}
vec3 terNormalDados(vec4 d){
vec2 t=d.rg * 2.0 - 1.0;
return vec3(t.x,sqrt(max(0.0,1.0 - dot(t,t))),t.y);
}
float terCopa(float mata){return smoothstep(0.4,0.66,mata);}
float terParedao(float incl,float r){return smoothstep(0.5,0.7,incl +(r - 0.5)* 0.12);}
float terCostaoBase(float mar,float agua,float incl,float h,float r){
float topo=3.0 + 28.0 * r * r + 10.0 * smoothstep(0.25,0.55,incl);
float pe=mix(smoothstep(0.16,0.3,incl),1.0,smoothstep(0.5,1.1,h));
return mar *(1.0 - smoothstep(40.0,90.0,agua))*(1.0 - smoothstep(topo * 0.55,topo,h))
* smoothstep(0.08,0.2,incl +(r - 0.5)* 0.08)* pe;
}
vec2 terAgua(float a){
float v=a * 255.0;
float mar=step(127.5,v);
return vec2((v - 128.0 * mar)* 2.0,mar);
}
vec2 terAguaExata(vec2 w){
float n=uTerGrade.w;
vec2 fr=clamp((w - uTerGrade.xy)/ uTerGrade.z,vec2(0.0),vec2(n - 1.0));
vec2 i=min(floor(fr),vec2(n - 2.0));
vec2 t=fr - i;
ivec2 k=ivec2(i);
vec2 a00=terAgua(texelFetch(uTerDados,k,0).a);
vec2 a10=terAgua(texelFetch(uTerDados,k + ivec2(1,0),0).a);
vec2 a01=terAgua(texelFetch(uTerDados,k + ivec2(0,1),0).a);
vec2 a11=terAgua(texelFetch(uTerDados,k + ivec2(1,1),0).a);
return mix(mix(a00,a10,t.x),mix(a01,a11,t.x),t.y);
}
`,j=`
uniform highp sampler2D uTerAltura;
float terAlturaBase(vec2 w){
float n=uTerGrade.w;
vec2 fr=clamp((w - uTerGrade.xy)/ uTerGrade.z,vec2(0.0),vec2(n - 1.0));
vec2 i=min(floor(fr),vec2(n - 2.0));
vec2 t=fr - i;
ivec2 k=ivec2(i);
float h00=texelFetch(uTerAltura,k,0).r;
float h10=texelFetch(uTerAltura,k + ivec2(1,0),0).r;
float h01=texelFetch(uTerAltura,k + ivec2(0,1),0).r;
float h11=texelFetch(uTerAltura,k + ivec2(1,1),0).r;
return(h00 *(1.0 - t.x)+ h10 * t.x)*(1.0 - t.y)+(h01 *(1.0 - t.x)+ h11 * t.x)* t.y;
}
float terMinimoNivel(vec2 w,int l){
ivec2 tam=textureSize(uTerAltura,l);
float esc=exp2(float(l));
vec2 fr=clamp((w - uTerGrade.xy)/(uTerGrade.z * esc)- 0.5,vec2(0.0),vec2(tam - 1));
vec2 i=min(floor(fr),vec2(max(tam - 2,ivec2(0))));
vec2 t=fr - i;
ivec2 k=ivec2(i);
ivec2 k1=min(k + 1,tam - 1);
float h00=texelFetch(uTerAltura,k,l).r;
float h10=texelFetch(uTerAltura,ivec2(k1.x,k.y),l).r;
float h01=texelFetch(uTerAltura,ivec2(k.x,k1.y),l).r;
float h11=texelFetch(uTerAltura,k1,l).r;
return mix(mix(h00,h10,t.x),mix(h01,h11,t.x),t.y);
}
float terMinimo(vec2 w,float nivel){
float l0=floor(nivel);
return mix(terMinimoNivel(w,int(l0)),terMinimoNivel(w,int(l0)+ 1),nivel - l0);
}
float terAltura(vec2 w){
float h=terAlturaBase(w);
float fo=terDistFora(w);
if(uTerFora.x < 0.5 || fo <=0.0)return h;
float k=smoothstep(0.0,uTerFora.y,fo);
vec4 r1=textureLod(uTerRuido,w *(1.0 / 5300.0),0.0);
vec4 r2=textureLod(uTerRuido,w *(1.0 / 1700.0)+ vec2(0.19,0.41),0.0);
float terra=smoothstep(-2.0,8.0,h);
float serra=uTerFora.z * smoothstep(0.2,0.85,r1.x * 0.7 + r2.y * 0.3);
float mar=-uTerFora.w *(0.6 + 0.4 * r1.y);
return h + k * mix(mar,serra,terra);
}
`,D=B,rt=D.map(t=>g(t.cor)),H=`
${U}
const vec3 TER_COR[ ${v} ]=vec3[ ${v} ](${rt.join(", ")});
const float TER_RUG[ ${v} ]=float[ ${v} ](${_(D.map(t=>t.rug))});
const float TER_ESC[ ${v} ]=float[ ${v} ](${_(D.map(t=>t.escala))});
const float TER_RELEVO[ ${v} ]=float[ ${v} ](${_(D.map(t=>t.relevo))});
const vec3 TER_GRAMA_VERDE=${g(E.gramaVerde)};
const vec3 TER_GRAMA_SECA=${g(E.gramaSeca)};
const vec3 TER_GRAMADO=${g(E.gramado)};
const vec3 TER_ASFALTO=${g(E.asfalto)};
struct TerEntrada{
vec2 w;
float h;
vec3 n;
float mata;
float agua;
float mar;
vec4 uso;
};
vec4 terR1;
vec4 terR2;
vec4 terR3;
float terCostao(TerEntrada e){return terCostaoBase(e.mar,e.agua,1.0 - e.n.y,e.h,terR3.x * 0.4 + terR2.y * 0.3 + terR3.z * 0.3);}
float terMargem;
float terLimitePraia(){return 16.0 + 30.0 * terR2.x + 10.0 * terR3.y;}
float terCotaPraia(){return 3.0 + 2.6 * terR3.y + 1.2 * terR2.w;}
void terRuidos(vec2 w){
terR1=texture(uTerRuido,w *(1.0 / 2300.0));
terR2=texture(uTerRuido,w *(1.0 / 263.0)+ vec2(0.31,0.17));
terR3=texture(uTerRuido,w *(1.0 / 71.0)+ vec2(0.57,0.83));
}
void terPesos(TerEntrada e,out float p[ ${v} ],out float asf,out float jar){
float incl=1.0 - e.n.y;
float sub=1.0 - smoothstep(-0.6,0.4,e.h);
float cst=terCostao(e);
float lim=terLimitePraia();
float cotaPraia=terCotaPraia();
float praia=e.mar *(1.0 - smoothstep(lim - 2.5,lim + 2.5,e.agua))
*(1.0 - smoothstep(cotaPraia - 0.35,cotaPraia + 0.35,e.h))*(1.0 - smoothstep(0.3,0.7,cst));
terMargem=(1.0 - e.mar)*(1.0 - smoothstep(3.0,14.0 + 12.0 * terR3.x,e.agua))*(1.0 - smoothstep(2.5,7.0,e.h));
float rocha=smoothstep(0.29,0.45,incl +(terR3.x - 0.5)* 0.16)
+ smoothstep(140.0,280.0,e.h)* smoothstep(0.5,0.74,terR2.y)* 0.8;
rocha=clamp(rocha + cst * 1.3,0.0,1.0);
float erosao=smoothstep(0.12,0.3,incl)*(1.0 - rocha)* smoothstep(0.5,0.75,terR2.x * 0.6 + terR3.y * 0.4);
float roxa=smoothstep(0.74,0.9,terR2.x * 0.45 + terR1.y * 0.35 + terR3.y * 0.2)* smoothstep(0.45,0.7,terR1.x)*(1.0 - smoothstep(0.07,0.2,incl));
float capim=smoothstep(0.55,0.8,terR1.x * 0.5 + terR2.y * 0.3 + terR3.w * 0.2 + uTerEstacao * 0.18 + incl * 0.45);
float folhico=smoothstep(0.35,0.62,e.mata);
p[ 0 ]=1.0;
p[ 1 ]=capim * 1.1;
p[ 2 ]=roxa * 1.2;
p[ 3 ]=erosao * 0.9 + roxa * 0.15 + terMargem * 1.8;
p[ 4 ]=rocha * 2.4;
p[ 5 ]=praia * 2.8 + sub * 4.0 * e.mar;
p[ 3 ] +=sub * 4.0 *(1.0 - e.mar);
p[ 6 ]=folhico * 2.2;
p[ 7 ]=0.0;
float urb=clamp(e.uso.r + e.uso.g + e.uso.b + e.uso.a,0.0,1.0)*(1.0 - sub);
for(int i=0;i < 7;i ++)p[ i ] *=1.0 - urb;
asf=e.uso.r * 4.0;
jar=e.uso.a * 4.0;
p[ 7 ]=e.uso.g * 4.0 + asf;
p[ 3 ] +=e.uso.b * 4.0;
p[ 0 ] +=jar;
}
void terCores(TerEntrada e,float p[ ${v} ],float asf,float jar,out vec3 c[ ${v} ]){
vec3 grama=mix(TER_GRAMA_VERDE,TER_GRAMA_SECA,smoothstep(0.35,0.8,terR1.y * 0.65 + terR3.y * 0.2 + uTerEstacao * 0.35));
grama=mix(grama,TER_COR[ 0 ],0.45)*(0.86 + 0.28 * terR2.w);
c[ 0 ]=mix(grama,TER_GRAMADO,jar / max(p[ 0 ],1e-4));
c[ 1 ]=TER_COR[ 1 ] *(0.9 + 0.2 * terR2.x);
c[ 2 ]=TER_COR[ 2 ] *(0.88 + 0.24 * terR3.y);
c[ 3 ]=mix(TER_COR[ 3 ],TER_COR[ 2 ],smoothstep(0.55,0.78,terR1.y)* 0.45)*(0.92 + 0.16 * terR3.x);
c[ 3 ]=mix(c[ 3 ],TER_COR[ 3 ] * vec3(0.52,0.55,0.5),clamp(terMargem * 1.5,0.0,1.0));
c[ 3 ]=mix(c[ 3 ],TER_COR[ 2 ] *(0.9 + 0.2 * terR3.x),clamp(e.uso.b * 2.5,0.0,1.0)*(0.35 + 0.35 * terR2.y));
float plano4=1.0 - smoothstep(0.2,0.45,1.0 - e.n.y);
c[ 4 ]=TER_COR[ 4 ] * mix(0.85,0.6 + 0.55 * smoothstep(0.05,0.7,terR3.z),plano4)*(0.8 + 0.34 * terR2.w);
float cst=smoothstep(0.3,0.7,terCostao(e));
c[ 4 ] *=mix(vec3(1.0),vec3(0.78,0.74,0.68)*(0.85 + 0.3 * terR3.y),cst);
c[ 4 ] *=1.0 - 0.62 * cst *(1.0 - smoothstep(1.5 + 1.5 * terR3.x,3.5 + 2.5 * terR3.x,e.h));
c[ 5 ]=TER_COR[ 5 ] *(0.93 + 0.1 * terR2.y);
c[ 6 ]=TER_COR[ 6 ] *(0.9 + 0.2 * terR3.z);
c[ 7 ]=mix(TER_COR[ 7 ],TER_ASFALTO,asf / max(p[ 7 ],1e-4));
}
float terVegetacao(TerEntrada e,out vec3 cor){
float urb=clamp(e.uso.r + e.uso.g + e.uso.b + e.uso.a,0.0,1.0);
float costao=terCostao(e);
float incl=1.0 - e.n.y;
float copa=terCopa(e.mata)*(1.0 - urb)*(1.0 - smoothstep(0.35,0.8,costao))*(1.0 - terParedao(incl,terR3.x));
float arb=max(smoothstep(0.06,0.42,e.mata),costao * 0.6 * step(0.2,e.mata))*(1.0 - copa)*(1.0 - urb);
float moita=arb * smoothstep(0.5,0.72,terR3.z * 0.4 + terR3.w * 0.25 + terR2.x * 0.2 + arb * 0.35);
float areal=e.mar *(1.0 - smoothstep(25.0,90.0,e.agua));
float pasto=(1.0 - urb)*(1.0 - copa)*(1.0 - areal)*(1.0 - smoothstep(0.2,0.35,incl))* step(0.5,e.h);
moita=max(moita,pasto * smoothstep(0.6,0.76,terR3.z * 0.45 + terR3.w * 0.35 + terR2.w * 0.2)* smoothstep(0.35,0.75,terR1.y * 0.6 + terR2.x * 0.5));
float grupo=smoothstep(0.5,0.82,terR1.x * 0.5 + terR2.y * 0.5);
float arvore=pasto * grupo * smoothstep(0.72,0.84,terR2.z);
float lim=terLimitePraia();
float cota=terCotaPraia();
float fimAreia=max(smoothstep(lim - 1.5,lim + 2.5,e.agua),smoothstep(cota - 0.35,cota + 0.35,e.h));
float faixaR=e.mar * fimAreia *(1.0 - smoothstep(lim + 40.0 + 45.0 * terR2.x,lim + 80.0 + 60.0 * terR2.x,e.agua));
float frente=(1.0 - smoothstep(lim + 3.0,lim + 22.0,e.agua))*(1.0 - smoothstep(cota + 0.5,cota + 4.0,e.h));
float restinga=faixaR *(1.0 - urb)*(1.0 - copa)* step(0.6,e.h)*(1.0 - smoothstep(9.0,16.0,e.h))
*(1.0 - smoothstep(0.25,0.45,incl))
* smoothstep(0.4,0.56,terR3.x * 0.45 + terR2.w * 0.35 + terR3.z * 0.2 + frente * 0.12 -(1.0 - faixaR)* 0.25);
float ciliar=(1.0 - e.mar)* smoothstep(4.0,9.0,e.agua)*(1.0 - smoothstep(22.0 + 20.0 * terR3.x,40.0 + 30.0 * terR3.x,e.agua))
*(1.0 - urb)*(1.0 - copa)* step(0.2,e.h)* smoothstep(0.35,0.6,terR3.z * 0.6 + terR2.y * 0.5);
float encosta=e.mar *(1.0 - smoothstep(70.0,170.0,e.agua))* smoothstep(0.1,0.26,incl)*(1.0 - urb)
*(1.0 - smoothstep(0.2,0.55,costao))*(1.0 - terParedao(incl,terR3.x))* step(0.5,e.h);
float mata=max(max(max(copa,moita * 0.85),max(arvore * 0.92,ciliar * 0.88)),encosta *(0.82 + 0.16 * terR3.z));
float rest=restinga * 0.9 *(1.0 - mata);
vec3 cc=copaCor(terR2,terR3,terR1);
vec3 cr=mix(cc * vec3(1.05,1.0,0.82),${g(E.restinga)},0.45);
float cob=1.0 -(1.0 - mata)*(1.0 - rest);
cor=mix(cc,cr,rest / max(cob,1e-4));
return cob;
}
float terCobVeg(float cob,vec3 cor){
float vao=1.0 - smoothstep(0.013,0.026,dot(cor,vec3(0.2126,0.7152,0.0722)));
return cob *(1.0 - vao *(1.0 - smoothstep(0.4,0.95,cob)));
}
void terAcabamento(TerEntrada e,inout vec3 alb,inout float rug){
float sub=1.0 - smoothstep(-0.6,0.4,e.h);
float molhado=max((1.0 - smoothstep(1.5,9.0,e.agua))*(1.0 - smoothstep(0.3,1.6,e.h)),
e.mar *(1.0 - smoothstep(20.0,40.0,e.agua))*(1.0 - smoothstep(0.5,1.3,e.h)))*(1.0 - sub);
alb *=1.0 - 0.36 * molhado;
rug=mix(rug,0.4,molhado);
vec3 cv;
float veg=terCobVeg(terVegetacao(e,cv),cv);
alb=mix(alb,cv,veg);
rug=mix(rug,0.82,veg);
}
vec4 terMisturaLinear(TerEntrada e){
float p[ ${v} ];
vec3 c[ ${v} ];
float asf;
float jar;
terPesos(e,p,asf,jar);
terCores(e,p,asf,jar,c);
vec3 soma=vec3(0.0);
float ps=0.0;
float r=0.0;
for(int i=0;i < ${v};i ++){
soma +=c[ i ] * p[ i ];
r +=TER_RUG[ i ] * p[ i ];
ps +=p[ i ];
}
vec3 alb=soma / max(ps,1e-4);
r /=max(ps,1e-4);
terAcabamento(e,alb,r);
return vec4(alb,r);
}
float terGramado(TerEntrada e){
float p[ ${v} ];
float asf;
float jar;
terPesos(e,p,asf,jar);
float ps=0.0;
for(int i=0;i < ${v};i ++)ps +=p[ i ];
return(p[ 0 ] + p[ 1 ])/ max(ps,1e-4)*(1.0 - terCopa(e.mata));
}
`,lt={pars:`
${z}
${j}
attribute vec4 aNo;
uniform vec2 uTerMorph[ ${W} ];
uniform vec4 uTerCopaV;
varying vec3 vTer;
`,normal:`
vec2 tG=position.xz;
float tPasso=aNo.z / ${q(et)};
int tNivel=int(aNo.w + 0.5);
vec2 tW=aNo.xy + tG * tPasso;
float tH=terAltura(tW);
float tD=distance(cameraPosition,vec3(tW.x,tH,tW.y));
for(int s=0;s < 3;s ++){
int l=min(tNivel + s,${W-1});
float k=clamp((tD - uTerMorph[ l ].x)* uTerMorph[ l ].y,0.0,1.0);
if(k > 0.0){
float e=float(1 << s);
vec2 gs=tG / e;
gs -=fract(gs * 0.5)* 2.0 * k;
tG=gs * e;
tW=aNo.xy + tG * tPasso;
tH=terAltura(tW);
tD=distance(cameraPosition,vec3(tW.x,tH,tW.y));
}
}
vec4 tDados=textureLod(uTerDados,terUVDados(tW),0.0);
vec3 tNV=terNormalDados(tDados);
vec2 tAguaV=terAguaExata(tW);
float tCopa=smoothstep(0.42,0.85,tDados.b)*(1.0 - smoothstep(0.02,0.3,terCostaoBase(tAguaV.y,tAguaV.x,1.0 - tNV.y,tH,0.85)))
*(1.0 - terParedao(1.0 - tNV.y,0.5));
if(tCopa > 0.0){
vec4 tRc=textureLod(uTerRuido,tW *(1.0 / 263.0)+ vec2(0.31,0.17),0.0);
tCopa *=uTerCopaV.x *(0.72 + 0.5 * tRc.z);
if(uTerCopaV.y > 0.0)tCopa *=smoothstep(uTerCopaV.y - uTerCopaV.z,uTerCopaV.y,tD);
}
float tPassoEf=max(uTerGrade.z,uTerGrade.z * tD * ${at} / uTerMorph[ 0 ].x);
float tNivelMin=min(log2(tPassoEf / uTerGrade.z),8.0);
float tPertoAgua=(1.0 - smoothstep(tPassoEf,2.0 * tPassoEf,tAguaV.x))* smoothstep(1.0,2.0,tNivelMin)*(1.0 - tAguaV.y);
float tHChao=tH;
if(tPertoAgua > 0.0)tH=mix(tH,min(tH,terMinimo(tW,tNivelMin)),tPertoAgua);
vec3 objectNormal=tNV;
vTer=vec3(tHChao,tCopa,tD);
`,posicao:`
vec3 transformed=vec3(tW.x,tH + tCopa,tW.y);
`},it={pars:`
${z}
${H}
uniform highp sampler2D uTerCor;
uniform highp sampler2D uTerUso;
uniform highp sampler2D uTerSobre;
uniform vec4 uTerDetalhe;
uniform vec3 uTerGanho[ ${v} ];
uniform vec4 uTerSobreModo;
uniform vec4 uTerSobreRet;
uniform vec3 uTerSobreRampa[ 8 ];
uniform vec4 uTerPincel;
uniform vec4 uTerLadrilho;
uniform float uTerMascara;
#ifdef TER_DETALHE
uniform highp sampler2DArray uTerCamadas;
#endif
#ifdef TER_AB
uniform highp sampler2DArray uTerCamadasB;
uniform vec3 uTerGanhoB[ ${v} ];
uniform vec4 uTerAB;
#endif
varying vec3 vTer;
vec3 terNormalFinal;
float terRug;
float terMasc;
vec3 terLinha;
vec3 terRelevo(vec3 n,float h){
vec3 dpx=dFdx(vGPosMundo);
vec3 dpy=dFdy(vGPosMundo);
float dhx=dFdx(h);
float dhy=dFdy(h);
vec3 r1=cross(dpy,n);
vec3 r2=cross(n,dpx);
float det=dot(dpx,r1);
vec3 g=sign(det)*(dhx * r1 + dhy * r2);
float ad=abs(det);
float lg=length(g);
if(lg > 1.2 * ad)g *=1.2 * ad / lg;
vec3 r=ad * n - g;
return dot(r,r)> 1e-24 ? normalize(r): n;
}
#ifdef TER_DETALHE
vec4 terDetalhe(int i,vec2 w,vec2 dx,vec2 dy,bool ladoB){
float s=1.0 / TER_ESC[ i ];
vec2 uv1=w * s;
mat2 rot=mat2(0.8,-0.6,0.6,0.8);
float s2=s * 0.38;
vec2 uv2=rot * w * s2 + vec2(0.37,0.71);
vec4 a;
vec4 b;
#ifdef TER_AB
if(ladoB){
a=textureGrad(uTerCamadasB,vec3(uv1,float(i)),dx * s,dy * s);
b=textureGrad(uTerCamadasB,vec3(uv2,float(i)),rot * dx * s2,rot * dy * s2);
vec4 m=mix(a,b,smoothstep(0.3,0.7,terR3.w));
return vec4(m.rgb * 2.0 * uTerGanhoB[ i ],m.a);
}
#endif
a=textureGrad(uTerCamadas,vec3(uv1,float(i)),dx * s,dy * s);
b=textureGrad(uTerCamadas,vec3(uv2,float(i)),rot * dx * s2,rot * dy * s2);
vec4 m=mix(a,b,smoothstep(0.3,0.7,terR3.w));
return vec4(m.rgb * 2.0 * uTerGanho[ i ],m.a);
}
#endif
vec3 terRampa(float t){
float n=max(uTerSobreModo.y,1.0);
float x=clamp(t,0.0,1.0)*(n - 1.0);
int i=int(floor(x));
int j=min(i + 1,int(n)- 1);
return mix(uTerSobreRampa[ i ],uTerSobreRampa[ j ],fract(x));
}
`,cor:`
vec2 tW=vGPosMundo.xz;
float tDist=vTer.z;
vec4 tDados=texture(uTerDados,terUVDados(tW));
vec2 tUVM=terUVMapa(tW);
vec4 tUso=texture(uTerUso,tUVM);
terRuidos(tW);
bool tDentro=all(greaterThanEqual(tUVM,vec2(0.0)))&& all(lessThanEqual(tUVM,vec2(1.0)));
vec3 tN=terNormalDados(tDados);
vec3 tNFc=cross(dFdx(vGPosMundo),dFdy(vGPosMundo));
float tNFq=dot(tNFc,tNFc);
vec3 tNF=tNFq > 1e-24 && tNFq < 1e30 ? tNFc * inversesqrt(tNFq): tN;
tNF *=sign(tNF.y + 1e-5);
float tFora=smoothstep(0.0,200.0,terDistFora(tW));
tN=normalize(mix(tN,tNF,tFora));
vec2 tDx=dFdx(tW);
vec2 tDy=dFdy(tW);
vec2 tAgua=terAgua(tDados.a);
if(tDentro && tDist < uTerDetalhe.w)tAgua=terAguaExata(tW);
TerEntrada tE=TerEntrada(tW,vTer.x,tN,tDados.b,tAgua.x,tAgua.y,tDentro ? tUso : vec4(0.0));
vec4 tCorLonge=texture(uTerCor,tUVM);
vec3 tAlb=tCorLonge.rgb * tCorLonge.rgb;
float tRug=tCorLonge.a;
if(!tDentro){
vec4 tm=terMisturaLinear(tE);
tAlb=tm.rgb;
tRug=tm.a;
}
float tRel=0.0;
#ifdef TER_DETALHE
float tPerto=1.0 - smoothstep(uTerDetalhe.x - uTerDetalhe.y,uTerDetalhe.x,tDist);
if(tPerto > 0.0 && tDentro){
float p[ ${v} ];
vec3 c[ ${v} ];
float asf;
float jar;
terPesos(tE,p,asf,jar);
terCores(tE,p,asf,jar,c);
int i1=0;
float m1=p[ 0 ];
for(int i=1;i < ${v};i ++)if(p[ i ] > m1){m1=p[ i ];i1=i;}
int i2=i1==0 ? 1 : 0;
float m2=p[ i2 ];
for(int i=0;i < ${v};i ++)if(i !=i1 && p[ i ] > m2){m2=p[ i ];i2=i;}
bool ladoB=false;
#ifdef TER_AB
ladoB=uTerAB.y > 0.5 && gl_FragCoord.x > uTerAB.x;
#endif
vec4 d1=terDetalhe(i1,tW,tDx,tDy,ladoB);
vec4 d2=terDetalhe(i2,tW,tDx,tDy,ladoB);
float q=m1 + m2;
float a1=m1 / q + d1.a * 0.6;
float a2=m2 / q + d2.a * 0.6;
float corte=max(a1,a2)- 0.22;
float b1=max(a1 - corte,0.0);
float b2=max(a2 - corte,0.0);
float bs=b1 + b2;
vec3 aPerto=(c[ i1 ] * d1.rgb * b1 + c[ i2 ] * d2.rgb * b2)/ bs;
float rPerto=(TER_RUG[ i1 ] * b1 + TER_RUG[ i2 ] * b2)/ bs;
terAcabamento(tE,aPerto,rPerto);
float copaP=terCopa(tE.mata);
tRel=mix((d1.a * TER_RELEVO[ i1 ] * b1 + d2.a * TER_RELEVO[ i2 ] * b2)/ bs,0.0,copaP)* tPerto;
tAlb=mix(tAlb,aPerto,tPerto);
tRug=mix(tRug,rPerto,tPerto);
}
#endif
vec3 tPx=dFdx(vGPosMundo);
vec3 tPy=dFdy(vGPosMundo);
float tPix=max(length(tPx),length(tPy));
float tMed=1.0 - smoothstep(uTerDetalhe.w * 0.6,uTerDetalhe.w,tDist);
float tMedR=1.0 - smoothstep(uTerDetalhe.w * 1.5,uTerDetalhe.w * 2.5,tDist);
float tParedao=terParedao(1.0 - tN.y,terR3.x);
float tVeg=0.0;
float tRelRocha=0.0;
float tRelVeg=0.0;
if((tMed > 0.0 || tParedao * tMedR > 0.0)&& tDentro){
float p[ ${v} ];
float asf;
float jar;
terPesos(tE,p,asf,jar);
float ps=0.0;
for(int i=0;i < ${v};i ++)ps +=p[ i ];
ps=max(ps,1e-4);
float urb=clamp(tE.uso.r + tE.uso.g + tE.uso.b + tE.uso.a,0.0,1.0);
vec3 cVeg;
tVeg=terVegetacao(tE,cVeg);
float tIngreme=smoothstep(0.22,0.42,1.0 - tN.y)* step(0.001,tVeg);
if(tIngreme > 0.0){
float lx=abs(tN.x)/(abs(tN.x)+ abs(tN.z)+ 1e-4);
const float e2=1.0 / 263.0;
const float e3=1.0 / 71.0;
vec4 r2=mix(textureGrad(uTerRuido,vGPosMundo.xy * e2 + vec2(0.31,0.17),tPx.xy * e2,tPy.xy * e2),
textureGrad(uTerRuido,vGPosMundo.zy * e2 + vec2(0.31,0.17),tPx.zy * e2,tPy.zy * e2),lx);
vec4 r3=mix(textureGrad(uTerRuido,vGPosMundo.xy * e3 + vec2(0.57,0.83),tPx.xy * e3,tPy.xy * e3),
textureGrad(uTerRuido,vGPosMundo.zy * e3 + vec2(0.57,0.83),tPx.zy * e3,tPy.zy * e3),lx);
cVeg=mix(cVeg,copaCor(r2,r3,terR1),tIngreme);
}
float campo=(p[ 0 ] + p[ 1 ])/ ps *(1.0 - tVeg);
float solo=(p[ 2 ] + p[ 3 ])/ ps *(1.0 - tVeg);
mat2 rA=mat2(0.866,0.5,-0.5,0.866);
mat2 rB=mat2(0.6,-0.8,0.8,0.6);
vec4 mA=textureGrad(uTerRuido,rA * tW *(1.0 / 23.0)+ vec2(0.13,0.71),rA * tDx *(1.0 / 23.0),rA * tDy *(1.0 / 23.0));
vec4 mB=textureGrad(uTerRuido,rB * tW *(1.0 / 8.3)+ vec2(0.52,0.09),rB * tDx *(1.0 / 8.3),rB * tDy *(1.0 / 8.3));
float v=mA.x * 0.4 + mA.y * 0.25 + mB.x * 0.2 + mB.w * 0.15;
vec3 mCampo=vec3(0.74 + 0.52 * v)* mix(vec3(1.0),vec3(1.12,1.04,0.74),smoothstep(0.55,0.78,mA.y * 0.6 + mB.y * 0.4)* 0.7);
vec3 mSolo=vec3(0.84 + 0.32 *(mA.x * 0.5 + mB.w * 0.5));
float areia=p[ 5 ] / ps *(1.0 - tVeg);
vec3 mAreia=vec3(0.91 + 0.18 *(mA.y * 0.55 + mB.x * 0.45))
* mix(vec3(1.0),vec3(0.95,0.96,1.0),smoothstep(0.58,0.8,mA.x)* 0.7);
float piso=p[ 7 ] / ps *(1.0 - asf / max(p[ 7 ],1e-4));
vec3 mPiso=vec3(0.8 + 0.34 * mA.y)* mix(vec3(1.0),vec3(1.14,0.96,0.84),smoothstep(0.6,0.8,mA.x)* 0.8)
* mix(vec3(1.0),vec3(0.82,0.86,0.8),smoothstep(0.62,0.82,mB.y)* 0.6);
vec3 tM=mix(vec3(1.0),mCampo,campo)* mix(vec3(1.0),mSolo,solo)* mix(vec3(1.0),mPiso,piso)
* mix(vec3(1.0),mAreia,areia);
tAlb *=mix(vec3(1.0),tM,tMed);
float tufoV=smoothstep(0.0,0.55,mA.z)*(0.8 + 0.4 * mB.w);
float planoV=1.0 - smoothstep(0.22,0.42,1.0 - tN.y);
float pertoV=(1.0 - smoothstep(0.4,1.4,tPix))* planoV;
cVeg *=mix(1.0,0.62 + 0.55 * tufoV,pertoV);
tRelVeg=tVeg * tMed * planoV *(1.0 - smoothstep(0.12,0.35,tPix))*(0.9 * tufoV + 0.25 * mB.x);
tAlb=mix(tAlb,cVeg,terCobVeg(tVeg,cVeg)* tMed);
float tCostaoP=terCostao(tE);
float pr=max(tParedao * tMedR,smoothstep(0.3,0.7,tCostaoP)* tMed)*(1.0 - urb);
if(pr > 0.0){
vec3 an=abs(tN);
float wx=an.x /(an.x + an.z + 1e-4);
float wy=smoothstep(0.55,0.85,an.y);
const vec2 esc=vec2(1.0 / 19.0,1.0 / 83.0);
vec4 sX=textureGrad(uTerRuido,vGPosMundo.zy * esc,tPx.zy * esc,tPy.zy * esc);
vec4 sZ=textureGrad(uTerRuido,vGPosMundo.xy * esc + vec2(0.37,0.11),tPx.xy * esc,tPy.xy * esc);
vec4 sY=textureGrad(uTerRuido,tW *(1.0 / 41.0)+ vec2(0.71,0.29),tDx *(1.0 / 41.0),tDy *(1.0 / 41.0));
vec4 sR=mix(mix(sZ,sX,wx),sY,wy);
float kc=smoothstep(0.3,0.7,tCostaoP);
float risco=smoothstep(0.45,0.78,sR.y)*(1.0 - wy)*(1.0 - 0.7 * kc);
float liquen=smoothstep(0.6,0.82,sR.x);
float mato=smoothstep(0.6,0.78,sR.z * 0.6 + terR3.z * 0.4)*(1.0 - smoothstep(0.5,0.72,1.0 - tN.y))*(1.0 - smoothstep(0.5,0.9,tCostaoP));
const float escM=1.0 / 90.0;
vec2 uvM=mix(mix(vGPosMundo.xy,vGPosMundo.zy,wx),tW,wy)* escM + vec2(0.13,0.57);
vec4 sM=textureGrad(uTerRuido,uvM,mix(mix(tPx.xy,tPx.zy,wx),tDx,wy)* escM,mix(mix(tPy.xy,tPy.zy,wx),tDy,wy)* escM);
float bloco=mix(mix(1.0,0.55 + 0.6 * smoothstep(0.02,0.35,sR.z),wy),0.5 + 0.62 * smoothstep(0.0,0.32,sM.z),kc);
vec3 granito=TER_COR[ 4 ] *(0.66 + 0.46 * sR.w)*(1.0 -(0.3 + 0.28 *(1.0 - wy))* risco)* bloco;
granito=mix(granito,TER_COR[ 4 ] * mix(vec3(1.2,1.18,1.1),vec3(0.42,0.42,0.4),1.0 - wy),liquen * 0.3);
granito *=mix(vec3(1.0),vec3(0.8,0.75,0.68)*(0.82 + 0.36 * sM.x),kc);
granito *=1.0 - 0.62 * kc *(1.0 - smoothstep(1.5 + 1.5 * sM.y,3.5 + 2.5 * sM.y,vTer.x));
granito *=1.0 - 0.45 *(1.0 - smoothstep(0.4,2.2,vTer.x))* tCostaoP;
vec3 matoCor=copaCor(vec4(terR2.xy,0.6,terR2.w),vec4(terR3.xy,0.6,terR3.w),terR1)*(0.8 + 0.3 * sR.w);
granito=mix(granito,matoCor,mato * 0.85);
tAlb=mix(tAlb,granito,pr);
tRug=mix(tRug,mix(0.68,0.82,mato),pr);
tRelRocha=1.6 * smoothstep(0.0,0.32,sM.z)* kc * pr *(1.0 - mato)*(1.0 - smoothstep(0.12,0.3,tPix));
}
}
float tCopaRel=copaRelevo(terR2,terR3,terR1,1.0 - smoothstep(0.3,0.8,tPix))* max(terCopa(tE.mata)*(1.0 - smoothstep(0.35,0.8,terCostao(tE)))*(1.0 - tParedao),tVeg * 0.8)
*(1.0 - smoothstep(uTerDetalhe.w * 0.6,uTerDetalhe.w,tDist))*(1.0 - smoothstep(0.9,2.5,tPix))
*(1.0 - smoothstep(0.22,0.45,1.0 - tN.y));
float tParede=smoothstep(0.12,0.35,tN.y - tNF.y)* smoothstep(0.5,3.0,vTer.y);
tCopaRel *=1.0 - tParede;
tAlb *=1.0 - 0.45 * tParede;
terNormalFinal=terRelevo(tN,(tRel + tCopaRel * 0.65 + tRelRocha + tRelVeg)* uTerDetalhe.z);
terRug=tRug;
terLinha=vec3(0.0);
if(uTerSobreModo.z > 0.0){
float lum=dot(tAlb,vec3(0.2126,0.7152,0.0722));
tAlb=mix(tAlb,vec3(lum * 1.1 + 0.04),0.82 * uTerSobreModo.z);
}
vec2 tUVS=(tW - uTerSobreRet.xy)* uTerSobreRet.zw;
bool tNaSobre=all(greaterThanEqual(tUVS,vec2(0.0)))&& all(lessThan(tUVS,vec2(1.0)));
vec4 tS=texture(uTerSobre,tUVS);
float tNivel=abs(fract(tS.r * 10.0 + 0.5)- 0.5)/ max(fwidth(tS.r * 10.0),1e-4);
float tModo=uTerSobreModo.x;
if(tModo > 0.5 && tModo < 1.5 && tNaSobre){
float v=floor(tS.r * 255.0 + 0.5);
float z=mod(v,8.0);
if(z > 0.5)tAlb=mix(tAlb,uTerSobreRampa[ int(z)],v >=8.0 ? 0.3 : 0.62);
}else if(tModo > 1.5 && tModo < 2.5 && tNaSobre){
vec3 rc=terRampa(tS.r);
tAlb=mix(tAlb,rc * 0.8,0.86)* mix(0.72,1.0,smoothstep(0.5,1.5,tNivel));
}else if(tModo > 2.5 && tModo < 3.5 && tNaSobre){
int k=int(floor(tS.r * 255.0 + 0.5));
if(k > 0)tAlb=mix(tAlb,uTerSobreRampa[ min(k,7)] * 0.8,0.86);
}
if(uTerLadrilho.x > 0.5){
vec2 lq=(tW - uTerLadrilho.yz)/ uTerLadrilho.w;
float est=floor(texture(uTerSobre,(floor(lq)+ 0.5)/ 16.0).r * 255.0 + 0.5);
bool noMapa=all(greaterThanEqual(lq,vec2(0.0)))&& all(lessThan(lq,vec2(16.0)));
if(noMapa && est < 0.5)tAlb=mix(tAlb,vec3(dot(tAlb,vec3(0.3333)))* 0.55,0.7);
if(noMapa && est > 0.5 && est < 1.5)terLinha +=vec3(0.06,0.05,0.03);
vec2 dl=abs(fract(lq + 0.5)- 0.5)/ max(fwidth(lq),vec2(1e-4));
float linha=1.0 - smoothstep(0.5,1.6,min(dl.x,dl.y));
terLinha +=vec3(0.85,0.78,0.6)* linha * 0.6 *(noMapa ? 1.0 : 0.0);
}
if(uTerPincel.w > 0.5){
float dp=length(tW - uTerPincel.xy);
float px=max(fwidth(dp),1e-3);
float anel=1.0 - smoothstep(px,px * 2.5,abs(dp - uTerPincel.z));
float dentro=1.0 - smoothstep(uTerPincel.z - px,uTerPincel.z,dp);
terLinha +=vec3(0.95,0.88,0.68)*(anel * 0.9 + dentro * 0.06);
}
terMasc=uTerMascara > 0.5 ? terGramado(tE): 0.0;
diffuseColor.rgb=tAlb;
`,rugosidade:`
float roughnessFactor=terRug;
`,normal:`
normal=normalize((viewMatrix * vec4(terNormalFinal,0.0)).xyz);
`,emissivo:`
totalEmissiveRadiance +=terLinha;
`,mascara:`
if(uTerMascara > 0.5)gl_FragColor=vec4(vec3(step(0.5,terMasc)),1.0);
`},V={vertice:`
out vec2 vUv;
void main(){
vUv=uv;
gl_Position=vec4(position.xy,0.0,1.0);
}
`,fragmento:`
${z}
${j}
${H}
uniform highp sampler2D uTerUso;
in vec2 vUv;
void main(){
vec2 w=uTerMapa.xy + vUv * uTerMapa.z;
vec4 d=texture(uTerDados,terUVDados(w));
terRuidos(w);
vec2 ag=terAguaExata(w);
TerEntrada e=TerEntrada(w,terAlturaBase(w),terNormalDados(d),d.b,ag.x,ag.y,texture(uTerUso,vUv));
vec4 m=terMisturaLinear(e);
gl_FragColor=vec4(sqrt(clamp(m.rgb,0.0,1.0)),m.a);
}
`},I=`
float gHash(vec2 c,vec2 per,float s){
c=mod(c,per);
uvec2 q=uvec2(c + 0.5);
uint h=(q.x * 1597334677u)^(q.y * 3812015801u)^(uint(s)* 2654435769u);
h ^=h >> 16u;
h *=2246822519u;
h ^=h >> 13u;
h *=3266489917u;
h ^=h >> 16u;
return float(h)*(1.0 / 4294967295.0);
}
float gValor(vec2 uv,vec2 per,float s){
vec2 p=uv * per;
vec2 i=floor(p);
vec2 fr=p - i;
vec2 u=fr * fr * fr *(fr *(fr * 6.0 - 15.0)+ 10.0);
float a=gHash(i,per,s);
float b=gHash(i + vec2(1.0,0.0),per,s);
float c=gHash(i + vec2(0.0,1.0),per,s);
float d=gHash(i + vec2(1.0,1.0),per,s);
return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float gFbm(vec2 uv,vec2 per,float s,int oit){
float t=0.0;
float a=0.5;
float n=0.0;
for(int o=0;o < 6;o ++){
if(o >=oit)break;
t +=a * gValor(uv,per,s + float(o)* 17.0);
n +=a;
a *=0.5;
per *=2.0;
}
return t / n;
}
vec3 gWorley(vec2 uv,vec2 per,float s){
vec2 p=uv * per;
vec2 i=floor(p);
float f1=9.0;
float f2=9.0;
float id=0.0;
for(int b=-1;b <=1;b ++){
for(int a=-1;a <=1;a ++){
vec2 c=i + vec2(float(a),float(b));
vec2 pc=c + vec2(gHash(c,per,s),gHash(c,per,s + 7.0));
float d=length(pc - p);
if(d < f1){
f2=f1;
f1=d;
id=gHash(c,per,s + 13.0);
}else if(d < f2){
f2=d;
}
}
}
return vec3(f1,f2,id);
}
`,mt={vertice:V.vertice,fragmento:`
uniform int uCamada;
uniform float uSemente;
in vec2 vUv;
${I}
vec4 camada(int k,vec2 uv){
float s=uSemente + float(k)* 101.0;
vec3 m=vec3(1.0);
float h=0.5;
if(k==0){
float tufo=gFbm(uv,vec2(14.0),s,5);
float lam=gFbm(uv,vec2(64.0,48.0),s + 3.0,3);
float falha=smoothstep(0.64,0.82,gFbm(uv,vec2(5.0),s + 5.0,4));
m=vec3(0.66 + 0.62 * tufo);
m *=mix(vec3(1.0),vec3(1.22,1.12,0.78),smoothstep(0.52,0.8,lam)* 0.8);
m *=mix(vec3(1.0),vec3(0.7,0.82,0.7),smoothstep(0.3,0.1,tufo));
m=mix(m,vec3(1.75,1.05,1.5),falha * 0.55);
h=tufo * 0.6 + lam * 0.4 - falha * 0.4;
}else if(k==1){
float fib=gFbm(uv,vec2(128.0,18.0),s,3);
float tufo=gFbm(uv,vec2(12.0),s + 1.0,4);
float verde=smoothstep(0.6,0.8,gFbm(uv,vec2(6.0),s + 2.0,3));
m=vec3(0.72 + 0.56 * tufo)* mix(vec3(0.9),vec3(1.14,1.1,0.98),fib);
m *=mix(vec3(1.0),vec3(0.8,0.96,0.84),verde * 0.7);
h=tufo * 0.5 + fib * 0.5;
}else if(k==2 || k==3){
vec3 wv=gWorley(uv,vec2(22.0),s);
float torrao=smoothstep(0.0,0.35,wv.y - wv.x);
float grao=gFbm(uv,vec2(48.0),s + 1.0,3);
float mancha=gFbm(uv,vec2(4.0),s + 2.0,4);
vec3 sx=gWorley(uv,vec2(64.0),s + 3.0);
float seixo=(1.0 - smoothstep(0.18,0.3,sx.x))* step(k==3 ? 0.55 : 0.8,sx.z);
m=vec3(0.7 + 0.5 * grao)* mix(0.62,1.05,torrao)*(0.85 + 0.3 * mancha);
m=mix(m,k==3 ? vec3(1.35,1.35,1.4): vec3(1.2,1.35,1.5),seixo * 0.8);
h=torrao * 0.5 + grao * 0.3 + seixo * 0.4;
}else if(k==4){
float base=gFbm(uv,vec2(6.0),s,5);
float bio=step(0.8,gValor(uv,vec2(170.0),s + 1.0));
float fel=step(0.82,gValor(uv,vec2(130.0),s + 2.0));
float liquen=smoothstep(0.62,0.78,gFbm(uv,vec2(5.0),s + 3.0,4));
float fr=abs(gFbm(uv,vec2(3.0),s + 4.0,4)- 0.5);
float fenda=(1.0 - smoothstep(0.0,0.022,fr))* smoothstep(0.35,0.6,gValor(uv,vec2(4.0),s + 6.0));
m=vec3(0.78 + 0.44 * base);
m *=1.0 - 0.38 * bio;
m *=mix(vec3(1.0),vec3(1.2,1.06,0.98),fel);
m=mix(m,vec3(0.95,1.06,0.82),liquen * 0.55);
m *=1.0 - 0.45 * fenda;
h=base * 0.7 - fenda * 0.4 + 0.3;
}else if(k==5){
float grao=gValor(uv,vec2(256.0),s);
float torce=gFbm(uv,vec2(3.0),s + 1.0,3);
float onda=sin(6.2831853 *(uv.x * 9.0 + uv.y * 2.0 + torce * 2.5));
float varrida=smoothstep(0.52,0.72,gFbm(uv,vec2(2.0),s + 4.0,3));
float pisada=smoothstep(0.55,0.8,gFbm(uv,vec2(24.0),s + 5.0,3))*(1.0 - varrida);
float concha=step(0.985,gValor(uv,vec2(200.0),s + 2.0));
float mancha=gFbm(uv,vec2(4.0),s + 3.0,4);
m=vec3(0.9 + 0.16 * grao)*(1.0 + 0.03 * onda * varrida)*(0.92 + 0.16 * mancha)*(1.0 - 0.06 * pisada);
m=mix(m,vec3(1.5),concha * 0.7);
h=0.5 + 0.14 * onda * varrida + 0.25 * grao - 0.15 * pisada;
}else if(k==6){
vec3 wv=gWorley(uv,vec2(36.0),s);
vec3 folha=mix(vec3(0.8,0.85,0.9),vec3(1.45,1.1,0.7),wv.z);
folha=mix(folha,vec3(1.05,1.3,0.8),step(0.86,wv.z));
float borda=smoothstep(0.02,0.14,wv.y - wv.x);
float galho=1.0 - smoothstep(0.0,0.04,abs(gFbm(uv,vec2(8.0,40.0),s + 1.0,2)- 0.5));
m=mix(vec3(0.5),folha,borda);
m=mix(m,vec3(0.7,0.62,0.55),galho * 0.6);
h=(1.0 - wv.x)* borda;
}else{
float ag=gFbm(uv,vec2(64.0),s,3);
float mancha=gFbm(uv,vec2(4.0),s + 1.0,4);
float sujo=smoothstep(0.6,0.82,gFbm(uv,vec2(3.0),s + 2.0,4));
m=vec3(0.88 + 0.24 * ag)*(0.88 + 0.24 * mancha)*(1.0 - 0.22 * sujo);
h=ag * 0.6 + mancha * 0.4;
}
return vec4(clamp(m * 0.5,0.0,1.0),clamp(h,0.0,1.0));
}
void main(){
gl_FragColor=camada(uCamada,vUv);
}
`},ft={vertice:V.vertice,fragmento:`
uniform float uSemente;
in vec2 vUv;
${I}
float copaCamada(vec2 uv,float per,float raio,float s){
vec3 w=gWorley(uv,vec2(per),s);
float alt=0.45 + 0.55 * fract(w.z * 7.13);
float r=raio *(0.8 + 0.5 * fract(w.z * 13.7));
return alt * max(0.0,1.0 - w.x * r);
}
void main(){
vec2 uv=vUv;
float r=clamp(0.5 +(gFbm(uv,vec2(4.0),uSemente,5)- 0.5)* 1.7,0.0,1.0);
float g=clamp(0.5 +(gFbm(uv,vec2(6.0),uSemente + 101.0,5)- 0.5)* 1.5,0.0,1.0);
float b=max(copaCamada(uv,16.0,1.25,uSemente + 202.0),copaCamada(uv,26.0,1.5,uSemente + 259.0));
float a=gFbm(uv,vec2(32.0),uSemente + 303.0,4);
gl_FragColor=vec4(r,g,b,a);
}
`},vt={vertice:V.vertice,fragmento:`
uniform highp sampler2DArray uFonte;
uniform float uFatia;
uniform float uNivel;
in vec2 vUv;
void main(){
gl_FragColor=textureLod(uFonte,vec3(vUv,uFatia),uNivel);
}
`};export{b as a,J as b,Q as c,g as d,B as e,v as f,W as g,et as h,ot as i,z as j,j as k,lt as l,it as m,V as n,mt as o,ft as p,vt as q};
