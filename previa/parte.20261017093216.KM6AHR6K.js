import{d as $e,n as _o,o as Io}from"./parte.20261017093216.PJ3C2GTL.js";import{a as Bt,g as Zo}from"./parte.20261017093216.GLFONK6Y.js";import{A as Ie,B as fe,C as Vt,D as Rt,E as Et,G as Ge,I as Uo,K as qe,L as Ve,M as $o,N as ko,O as Go,V as qo,h as Jt,i as Po,j as Bo,v as Ho,w as oe,x as _e,y as jo,z as it}from"./parte.20261017093216.I6JGOM2O.js";import{b as ue,c as Lo}from"./parte.20261017093216.XLKSM5AO.js";import{e as Ro,f as bo}from"./parte.20261017093216.72SKZDOT.js";import{b as ee}from"./parte.20261017093216.KS4B2N5X.js";import{b as Ze}from"./parte.20261017093216.5QMVO2YA.js";import{a as Ao,b as Eo,c as Mo}from"./parte.20261017093216.AXPMQB6P.js";import{f as ho}from"./parte.20261017093216.ZCCSNXBG.js";import{b as je,d as go,e as xo,h as Ue}from"./parte.20261017093216.ZUTKLCOI.js";import{f as Fo}from"./parte.20261017093216.DDBMLPMZ.js";import{f as Me,i as Re}from"./parte.20261017093216.ICBCCHYP.js";import{b as Yt}from"./parte.20261017093216.YGQ7UKKC.js";import{B as zo,Da as Qt,Ea as Pt,Ha as ce,Ia as Do,Ja as le,Ka as be,La as No,Za as te,b as Vo,ca as Zt,ea as Co,ga as Dt,ka as ie,o as Oo,pa as wo,sa as yo,t as To,ua as So,wa as ke,ya as st}from"./parte.20261017093216.IQLS3YYL.js";import{a as He}from"./parte.20261017093216.POIFTBKL.js";var sn={};He(sn,{ALVO_USO_CHAO:()=>Ye,BIT_REALCE:()=>Ke,LADO_TAB:()=>bt,PERFIL_VIAS:()=>ia,Rede:()=>Ce,TRECHO:()=>ca,arestaDaSelecao:()=>Te,criarMaterialVia:()=>ua,criarUniformesVia:()=>la,desgasteDe:()=>ma,geometriaAquecerVia:()=>fa,geometriaDaMalha:()=>Qe,ligarChaoNoShader:()=>da,pedidoDeSetor:()=>va,realcarAresta:()=>We,registrar:()=>rn,retalho:()=>pa});var ft=t=>Number.isInteger(t)?`${t}.0`:`${t}`,me=8,de=6;function Ga(){let t=[],e=[],o=[],r=[],i=[];for(let c of fe){for(let v=0;v<me;v++){let h=c.linhas[v];t.push(h?`vec4( ${ft(+h.u.toFixed(4))}, ${ft(h.largura)}, ${ft(h.cor)}, ${ft(h.estilo)} )`:"vec4( 0.0, 0.0, 0.0, -1.0 )")}e.push(`vec2( ${ft(c.tracejado[0])}, ${ft(c.tracejado[1])} )`);for(let v=0;v<de;v++)o.push(c.faixas[v]?ft(+c.faixas[v].meio.toFixed(4)):"999.0");let m=v=>{let h=c.faixas.filter(A=>A.sentido===v);return h.length?[Math.min(...h.map(A=>A.u0)),Math.max(...h.map(A=>A.u1))]:[0,0]},[g,f]=m(-1),[M,E]=m(1);r.push(`vec4( ${ft(g)}, ${ft(f)}, ${ft(M)}, ${ft(E)} )`),i.push(c.meioFio?"1.0":"0.0")}let s=fe.length;return`
const vec4 VIA_LINHAS[ ${s*me} ]=vec4[ ${s*me} ](${t.join(", ")});
const vec2 VIA_TRACO[ ${s} ]=vec2[ ${s} ](${e.join(", ")});
const float VIA_FAIXAS[ ${s*de} ]=float[ ${s*de} ](${o.join(", ")});
const vec4 VIA_RET[ ${s} ]=vec4[ ${s} ](${r.join(", ")});
const float VIA_SARJETA[ ${s} ]=float[ ${s} ](${i.join(", ")});
`}var qa=[...Object.entries(Ho).map(([t,e])=>`#define VM_${t} ${ft(e)}`),...Object.entries(Vt).map(([t,e])=>`#define VB_${t} ${e}`),`#define VE_CONTINUA ${ft(_e.CONTINUA)}`,`#define VE_TRACEJADA ${ft(_e.TRACEJADA)}`,`#define VE_ESTACIONAMENTO ${ft(_e.ESTACIONAMENTO)}`,`#define VC_AMARELA ${ft(jo.AMARELA)}`,`#define VIA_TERRA ${ft(fe.findIndex(t=>t.terra))}`,`#define VIA_RODOVIA ${ft(fe.findIndex(t=>t.barreira))}`].join(`
`),Jo=`
#define VIA
attribute vec4 aUV;
attribute vec4 aDados;
attribute uint aId;
uniform highp sampler2D gViaTab;
uniform vec4 gViaLonge;
varying vec4 vUV;
flat varying vec4 vDados;
flat varying vec4 vIdent;
varying float vAO;
vec3 viaOct(vec2 e){
vec3 v=vec3(e,1.0 - abs(e.x)- abs(e.y));
if(v.z < 0.0)v.xy=(1.0 - abs(v.yx))*(step(0.0,v.xy)* 2.0 - 1.0);
return normalize(v.xzy);
}
`,Xo=`
vec3 objectNormal=viaOct(normal.xy);
#ifdef USE_TANGENT
vec3 objectTangent=vec3(tangent.xyz);
#endif
`,Ko=`
{
vec4 gT=texelFetch(gViaTab,ivec2(int(aId % 256u),int(aId / 256u)),0);
vUV=aUV;
vDados=vec4(aDados.xyz,gT.b);
vIdent=vec4(float(aId),floor(gT.g * 255.0 + 0.5),floor(gT.r * 255.0 + 0.5),0.0);
vAO=aDados.w / 255.0;
}
`,Wo=`
{
float gVd=length(mvPosition.xyz);
mvPosition.xyz *=1.0 - min(0.02,gViaLonge.z + gViaLonge.w * gVd);
gl_Position=projectionMatrix * mvPosition;
}
`,Yo=`
#define VIA
${qa}
${Ga()}
uniform highp sampler2D gViaDetalhe;
uniform vec4 gViaLonge;
uniform vec4 gViaCamada;
uniform vec3 gViaRampa[ 8 ];
uniform float gViaMascara;
varying vec4 vUV;
flat varying vec4 vDados;
flat varying vec4 vIdent;
varying float vAO;
float gViaRug=0.85;
float gViaGrama=0.0;
float viaLinha(float x,float c,float l){
float fw=max(fwidth(x),1e-4);
float a=max(x - 0.5 * fw,c - 0.5 * l);
float b=min(x + 0.5 * fw,c + 0.5 * l);
return clamp((b - a)/ fw,0.0,1.0);
}
float viaOndaI(float x,float t,float p){return floor(x / p)* t + min(mod(x,p),t);}
float viaTraco(float x,float t,float p){
float fw=max(fwidth(x),1e-4);
return clamp((viaOndaI(x + 0.5 * fw,t,p)- viaOndaI(x - 0.5 * fw,t,p))/ fw,0.0,1.0);
}
float viaFaixa(float x,float a,float b){
float fw=max(fwidth(x),1e-4);
return clamp((min(x + 0.5 * fw,b)- max(x - 0.5 * fw,a))/ fw,0.0,1.0);
}
float viaHash(vec2 p){
p=fract(p * vec2(0.1031,0.1030));
p +=dot(p,p.yx + 33.33);
return fract((p.x + p.y)* p.x);
}
bool viaBit(float marcas,int b){return(int(marcas + 0.5)& b)!=0;}
const vec3 VIA_ASF_NOVO=vec3(0.045,0.046,0.05);
const vec3 VIA_ASF_GASTO=vec3(0.13,0.125,0.117);
const vec3 VIA_CONCRETO=vec3(0.34,0.33,0.305);
const vec3 VIA_MEIO_FIO=vec3(0.42,0.41,0.385);
const vec3 VIA_BRANCA=vec3(0.72,0.72,0.69);
const vec3 VIA_AMARELA=vec3(0.78,0.46,0.035);
const vec3 VIA_GRAMA=vec3(0.075,0.1,0.045);
const vec3 VIA_TERRA_COR=vec3(0.23,0.14,0.09);
const vec3 VIA_PEDRA_BRANCA=vec3(0.56,0.54,0.5);
const vec3 VIA_PEDRA_PRETA=vec3(0.045,0.045,0.047);
vec4 viaMarcas(int tipo,float u,float v,float vf,float marcas,float gasto,float longe){
vec3 cor=vec3(0.0);
float cob=0.0;
if(!viaBit(marcas,VB_CRUZAMENTO)){
vec2 tr=VIA_TRACO[ tipo ];
for(int k=0;k < ${me};k ++){
vec4 L=VIA_LINHAS[ tipo * ${me} + k ];
if(L.w < -0.5)break;
float c=viaLinha(u,L.x,L.y);
if(c <=0.0)continue;
if(L.w==VE_TRACEJADA)c *=viaTraco(v + 1.0,tr.x,tr.x + tr.y);
else if(L.w==VE_ESTACIONAMENTO){
float pe=L.x + 2.2 * sign(L.x + 1e-3);
float tique=viaTraco(v + 0.05,0.1,5.5)* viaFaixa(u,min(L.x,pe),max(L.x,pe));
c=max(c * 0.9,tique);
}
vec3 k2=L.z==VC_AMARELA ? VIA_AMARELA : VIA_BRANCA;
cor=mix(cor,k2,c);
cob=max(cob,c);
}
vec4 R=VIA_RET[ tipo ];
if(viaBit(marcas,VB_ZEBRA_INI)|| viaBit(marcas,VB_ZEBRA_FIM)){
float zi=viaBit(marcas,VB_ZEBRA_INI)? viaFaixa(v,0.8,4.8): 0.0;
float zf=viaBit(marcas,VB_ZEBRA_FIM)? viaFaixa(vf,0.8,4.8): 0.0;
float z=max(zi,zf)* viaTraco(u + 0.2,0.4,1.0);
cor=mix(cor,VIA_BRANCA,z);
cob=max(cob,z);
float ri=viaFaixa(v,6.4,6.8)*((viaBit(marcas,VB_RET_INI_A)? viaFaixa(u,R.x,R.y): 0.0)+(viaBit(marcas,VB_RET_INI_B)? viaFaixa(u,R.z,R.w): 0.0));
float rf=viaFaixa(vf,6.4,6.8)*((viaBit(marcas,VB_RET_FIM_A)? viaFaixa(u,R.x,R.y): 0.0)+(viaBit(marcas,VB_RET_FIM_B)? viaFaixa(u,R.z,R.w): 0.0));
float r=clamp(ri + rf,0.0,1.0);
cor=mix(cor,VIA_BRANCA,r);
cob=max(cob,r);
}
}
vec4 d=texture(gViaDetalhe,vec2(u * 0.37,v * 0.11)+ 0.13);
cob *=1.0 - gasto * smoothstep(0.35,0.8,d.g)* 0.75;
cob *=1.0 - longe;
return vec4(cor,cob);
}
vec2 viaTrilhas(int tipo,float u){
float t=0.0;
float o=0.0;
for(int k=0;k < ${de};k ++){
float c=VIA_FAIXAS[ tipo * ${de} + k ];
if(c > 900.0)break;
float d=abs(u - c);
t=max(t,1.0 - smoothstep(0.18,0.5,abs(d - 0.85)));
o=max(o,1.0 - smoothstep(0.1,0.45,d));
}
return vec2(t,o);
}
vec3 viaAsfalto(vec2 w,vec2 uv,int tipo,float gasto,bool cruzamento,bool acostamento){
vec4 d1=texture(gViaDetalhe,w * 0.25);
vec4 d2=texture(gViaDetalhe,w *(1.0 / 29.0)+ 0.37);
float g=clamp(gasto * 0.85 +(d2.g - 0.5)* 0.35 +(acostamento ? 0.25 : 0.0),0.0,1.0);
vec3 c=mix(VIA_ASF_NOVO,VIA_ASF_GASTO,g);
c *=0.9 + 0.2 * d1.r;
c *=0.93 + 0.14 * d2.r;
vec2 cel=floor(vec2(uv.x / 3.0,uv.y / 2.2));
float h=viaHash(cel + float(tipo)* 17.0);
if(!cruzamento && h < 0.05 * g){
vec2 fr=fract(vec2(uv.x / 3.0,uv.y / 2.2));
float r=step(0.12,fr.x)* step(fr.x,0.88)* step(0.1,fr.y)* step(fr.y,0.9);
c=mix(c,VIA_ASF_NOVO * 1.1,r * 0.85);
}
vec4 d3=texture(gViaDetalhe,w *(1.0 / 9.0)+ 0.71);
float fis=smoothstep(0.86,0.97,d3.b)* smoothstep(0.5,0.78,d2.b)* smoothstep(0.35,0.9,g);
c *=1.0 - 0.3 * fis;
if(!cruzamento && !acostamento){
vec2 to=viaTrilhas(tipo,uv.x);
c *=1.0 - 0.2 * to.x *(0.5 + 0.5 * g);
c *=1.0 - 0.18 * to.y * smoothstep(0.4,0.7,d1.g);
gViaRug=mix(0.88,0.7,to.x);
}else{
c *=1.0 - 0.1 * smoothstep(0.5,0.8,d2.g);
gViaRug=0.86;
}
return c;
}
vec3 viaCalcada(vec2 w,float b,float v,bool pedra){
vec4 d1=texture(gViaDetalhe,w * 0.5);
vec4 d2=texture(gViaDetalhe,w *(1.0 / 23.0)+ 0.61);
gViaRug=0.82;
if(b < 0.15)return VIA_MEIO_FIO *(0.92 + 0.12 * d1.r)*(0.9 + 0.1 * d2.g);
if(pedra){
float onda=fract((b + 0.55 * sin(v * 0.72))/ 1.7);
float preto=smoothstep(0.46,0.54,onda)*(1.0 - smoothstep(0.96,1.0,onda));
vec3 c=mix(VIA_PEDRA_BRANCA,VIA_PEDRA_PRETA,preto);
float rej=smoothstep(0.1,0.25,d1.a);
c *=mix(0.55,1.0,rej)*(0.9 + 0.15 * d1.r);
gViaRug=0.75;
return c *(0.88 + 0.12 * d2.g);
}
vec3 c=VIA_CONCRETO *(0.9 + 0.14 * d1.r)*(0.86 + 0.16 * d2.g);
if(b < 0.95)c *=0.82;
float j=max(viaTraco(v + 0.02,0.025,1.5),viaLinha(b,0.95,0.03));
c *=1.0 - 0.4 * j;
c *=1.0 - 0.12 * smoothstep(0.6,0.95,d2.b);
return c;
}
vec3 viaTerra(vec2 w,float u){
vec4 d1=texture(gViaDetalhe,w * 0.3);
vec4 d2=texture(gViaDetalhe,w *(1.0 / 19.0)+ 0.2);
vec3 c=mix(VIA_TERRA_COR,vec3(0.27,0.22,0.17),0.35 + 0.4 * d2.g);
float s=1.0 - smoothstep(0.15,0.55,abs(abs(u)- 1.35));
c *=(1.0 - 0.18 * s)*(0.85 + 0.3 * d1.r);
gViaRug=0.95;
return c;
}
vec3 viaGrama(vec2 w){
vec4 d1=texture(gViaDetalhe,w * 0.6);
vec4 d2=texture(gViaDetalhe,w *(1.0 / 13.0)+ 0.8);
vec3 c=mix(VIA_GRAMA,vec3(0.19,0.17,0.1),smoothstep(0.55,0.85,d2.g)* 0.6);
gViaRug=0.92;
gViaGrama=1.0;
return c *(0.8 + 0.4 * d1.r);
}
vec3 viaRampa(float t){
float n=max(gViaCamada.y,1.0);
float x=clamp(t,0.0,1.0)*(n - 1.0);
int i=int(floor(x));
int j=min(i + 1,int(n)- 1);
return mix(gViaRampa[ i ],gViaRampa[ j ],fract(x));
}
`,Qo=`
{
float mat=vDados.x;
int tipo=int(vDados.y + 0.5);
float marcas=vDados.z;
float gasto=vDados.w;
vec2 w=vGPosMundo.xz;
float dist=length(vGPosMundo - cameraPosition);
float longe=smoothstep(gViaLonge.x,gViaLonge.y,dist);
bool cruz=viaBit(marcas,VB_CRUZAMENTO);
vec3 c;
if(mat==VM_PISTA || mat==VM_ACOSTAMENTO){
c=viaAsfalto(w,vUV.xy,tipo,gasto,cruz,mat==VM_ACOSTAMENTO);
if(VIA_SARJETA[ tipo ] > 0.5){
float s=viaFaixa(vUV.w,-1.0,0.32);
c=mix(c,VIA_CONCRETO * 0.78,s *(1.0 - longe));
}
vec4 m=viaMarcas(tipo,vUV.x,vUV.y,vUV.z,marcas,gasto,longe);
c=mix(c,m.rgb,m.a);
gViaRug=mix(gViaRug,0.6,m.a);
}else if(mat==VM_CALCADA){
c=viaCalcada(w,vUV.w,vUV.y,viaBit(marcas,VB_PEDRA));
}else if(mat==VM_MEIO_FIO || mat==VM_BARREIRA || mat==VM_TABULEIRO){
vec4 d1=texture(gViaDetalhe,w * 0.5 + vUV.y * 0.1);
c=VIA_MEIO_FIO *(0.9 + 0.14 * d1.r);
gViaRug=0.8;
}else if(mat==VM_CANTEIRO || mat==VM_TALUDE){
c=viaGrama(w);
if(mat==VM_TALUDE)c=mix(c,vec3(0.2,0.16,0.11),0.35);
}else if(mat==VM_TERRA){
c=viaTerra(w,vUV.x);
}else{
c=tipo==int(VIA_TERRA)? VIA_TERRA_COR * 0.8 : VIA_CONCRETO * 0.8;
gViaRug=0.9;
}
c=mix(c,mat==VM_CALCADA ? VIA_CONCRETO * 0.95 : c,longe * 0.5);
if(gViaCamada.x > 0.5){
float l=dot(c,vec3(0.2126,0.7152,0.0722));
vec3 neutro=vec3(0.18 + 0.5 * l);
float val=vIdent.z;
if((mat==VM_PISTA || mat==VM_ACOSTAMENTO)&& val > 0.5){
vec3 rc=gViaCamada.z > 0.5 ? gViaRampa[ int(min(val,7.0))] : viaRampa((val - 1.0)/ 254.0);
c=mix(neutro,rc,0.9);
}else c=neutro;
}
diffuseColor.rgb=c;
}
`,ta=`
float roughnessFactor=gViaRug;
`,ea=`
if((int(vIdent.y + 0.5)& 1)!=0)totalEmissiveRadiance +=vec3(0.25,0.2,0.08)* 0.6;
`,oa=`
#include <aomap_fragment>
reflectedLight.indirectDiffuse *=vAO;
reflectedLight.directDiffuse *=mix(1.0,vAO,0.35);
`,aa=`
#include <dithering_fragment>
if(gViaMascara > 0.5)gl_FragColor=vec4(vec3(gViaGrama),1.0);
`,_n=`
attribute float aParte;
attribute vec4 aObj;
flat varying float vParte;
flat varying vec4 vObj;
`,In=`
vParte=aParte;
vObj=aObj;
`,Vn=`
flat varying float vParte;
flat varying vec4 vObj;
uniform float gObjNoite;
uniform float gObjTempo;
uniform vec3 gObjLuz;
float gObjRug=0.6;
float gObjMetal=0.0;
int objFase(float g,float defas){
float t=mod(gObjTempo + defas * 0.16,40.0);
float m=g < 0.5 ? t : mod(t + 20.0,40.0);
return m < 16.0 ? 0 : m < 19.0 ? 1 : 2;
}
`,On=`
{
int p=int(vParte + 0.5);
vec3 c;
if(p==0){c=vec3(0.3,0.31,0.32);gObjRug=0.45;gObjMetal=0.6;}
else if(p==1){c=vec3(0.36,0.35,0.33);gObjRug=0.85;}
else if(p==2){c=vec3(0.7,0.7,0.66);gObjRug=0.3;}
else if(p==6){c=vec3(0.03,0.03,0.03);gObjRug=0.5;}
else{c=vec3(0.04);gObjRug=0.2;}
diffuseColor.rgb=c;
}
`,Tn=`
float roughnessFactor=gObjRug;
`,zn=`
float metalnessFactor=gObjMetal;
`,Cn=`
{
int p=int(vParte + 0.5);
if(p==2)totalEmissiveRadiance +=gObjLuz * 14.0 * gObjNoite;
if(p >=3 && p <=5){
int f=objFase(vObj.x,vObj.y);
vec3 k=p==3 ? vec3(1.0,0.06,0.03): p==4 ? vec3(1.0,0.55,0.05): vec3(0.1,1.0,0.45);
bool aceso=(p==3 && f==2)||(p==4 && f==1)||(p==5 && f==0);
if(aceso)totalEmissiveRadiance +=k *(3.0 + 6.0 * gObjNoite);
}
}
`;var Ja=8,ae=Object.freeze({guardaAltura:.95,guardaLargura:.32,raioColuna:.85,travessaAltura:1.1,travessaProf:2.4,sapata:.6}),Je=class{constructor(){this.pos=[],this.nor=[],this.idx=[]}quad(e,o,r,i){let s=na(e,o,r),c=this.pos.length/3;for(let m of[e,o,r,i])this.pos.push(m[0],m[1],m[2]),this.nor.push(s[0],s[1],s[2]);this.idx.push(c,c+1,c+2,c,c+2,c+3)}tri(e,o,r){let i=na(e,o,r),s=this.pos.length/3;for(let c of[e,o,r])this.pos.push(c[0],c[1],c[2]),this.nor.push(i[0],i[1],i[2]);this.idx.push(s,s+1,s+2)}get triangulos(){return this.idx.length/3}};function na(t,e,o){let r=e[0]-t[0],i=e[1]-t[1],s=e[2]-t[2],c=o[0]-t[0],m=o[1]-t[1],g=o[2]-t[2],f=i*g-s*m,M=s*c-r*g,E=r*m-i*c,v=Math.hypot(f,M,E)||1;return[f/v,M/v,E/v]}function Xa(t,e,o,r,i,s,c,m,g){let f=-i,M=r,E=(A,R,S)=>[e+f*A*s*.5+r*R*c*.5,S,o+M*A*s*.5+i*R*c*.5],v=[E(-1,-1,m),E(1,-1,m),E(1,1,m),E(-1,1,m)],h=[E(-1,-1,g),E(1,-1,g),E(1,1,g),E(-1,1,g)];t.quad(h[0],h[3],h[2],h[1]),t.quad(v[0],v[1],v[2],v[3]);for(let A=0;A<4;A++){let R=(A+1)%4;t.quad(v[A],v[R],h[R],h[A])}}function Ka(t,e,o,r,i,s){let m=g=>g/8*Math.PI*2;for(let g=0;g<8;g++){let f=m(g),M=m(g+1),E=e+Math.cos(f)*r,v=o+Math.sin(f)*r,h=e+Math.cos(M)*r,A=o+Math.sin(M)*r;t.quad([E,i,v],[h,i,A],[h,s,A],[E,s,v]),t.tri([e,s,o],[E,s,v],[h,s,A])}}function Wa(t,e,o){let{p:r,cotas:i,meia:s}=e,c=Me(r),m=c[16],g=s*2-.4,f=0,M=Math.max(1,Math.ceil(m/Ja)),E={x:0,z:0,tx:1,tz:0,t:0},v=[];for(let h=0;h<=M;h++){let A=m*h/M;Rt(r,c,A,E);let R=i[0]+(i[1]-i[0])*(m>0?A/m:0),S=-E.tz,W=E.tx,$=(J,et)=>[E.x+S*J,R+et,E.z+W*J];v.push({topoE:$(-g/2,f-.05),topoD:$(g/2,f-.05),baseE:$(-g*.3,f-$e),baseD:$(g*.3,f-$e),guardaE:$(-(s-.16),0),guardaD:$(s-.16,0),y:R,tx:E.tx,tz:E.tz,rx:S,rz:W})}for(let h=0;h<M;h++){let A=v[h],R=v[h+1];t.quad(A.baseE,R.baseE,R.baseD,A.baseD),t.quad(A.topoE,R.topoE,R.baseE,A.baseE),t.quad(A.baseD,R.baseD,R.topoD,A.topoD);for(let S of[-1,1]){let W=S<0?"guardaE":"guardaD",$=A[W],J=R[W],et=ae.guardaLargura/2,Y=ae.guardaAltura,Z=(ot,y,F)=>[ot[0]+A.rx*S*et*y,ot[1]+F,ot[2]+A.rz*S*et*y],T=(ot,y,F)=>[ot[0]+R.rx*S*et*y,ot[1]+F,ot[2]+R.rz*S*et*y],ut=S<0?1:-1;ut>0?t.quad(Z($,-1,Y),T(J,-1,Y),T(J,1,Y),Z($,1,Y)):t.quad(Z($,1,Y),T(J,1,Y),T(J,-1,Y),Z($,-1,Y)),ut>0?(t.quad(Z($,-1,-.2),T(J,-1,-.2),T(J,-1,Y),Z($,-1,Y)),t.quad(Z($,1,Y),T(J,1,Y),T(J,1,-.2),Z($,1,-.2))):(t.quad(Z($,1,Y),T(J,1,Y),T(J,1,-.2),Z($,1,-.2)),t.quad(Z($,-1,-.2),T(J,-1,-.2),T(J,-1,Y),Z($,-1,Y)))}}for(let[h,A]of[[v[0],-1],[v[M],1]]){let R=[h.topoE,h.topoD,h.baseD,h.baseE];A>0?t.quad(R[3],R[2],R[1],R[0]):t.quad(R[0],R[1],R[2],R[3])}for(let h of _o(r,i,o.chao,o.bloqueia)){let A=Io(h.x,h.z);if(o.vistos.has(A))continue;o.vistos.add(A);let R=h.dx,S=h.dz,W=-S,$=R,J=h.topo,et=h.topo-ae.travessaAltura,Y=h.base-ae.sapata,Z=Math.min(g*.72,s*2-2);Xa(t,h.x,h.z,R,S,Z,ae.travessaProf,et,J);let T=s>=10,ut=T?[-Z*.28,Z*.28]:[0];for(let ot of ut){let y=h.x+W*ot,F=h.z+$*ot;Ka(t,y,F,ae.raioColuna*(T?.9:1.05),Y,et)}}}function Ya(t,e){let o=new Je,r=new Set;for(let i of t)Wa(o,i,{chao:e.chao,bloqueia:e.bloqueia??null,vistos:r});return{pos:Float32Array.from(o.pos),nor:Float32Array.from(o.nor),idx:Uint32Array.from(o.idx),triangulos:o.triangulos}}function Qa(t){let e=new Map,o=[];for(let r of t.arestas.values()){if(r.ponte)continue;let i=it(r.tipo).meia+2,s=1/0,c=1/0,m=-1/0,g=-1/0;for(let f=0;f<8;f+=2)s=Math.min(s,r.p[f]),m=Math.max(m,r.p[f]),c=Math.min(c,r.p[f+1]),g=Math.max(g,r.p[f+1]);e.set(r,[s-i,c-i,m+i,g+i,i]),o.push(r)}return(r,i)=>{for(let s of o){let c=e.get(s);if(!(r<c[0]||r>c[2]||i<c[1]||i>c[3])&&Re(s.p,r,i).d<c[4])return!0}return!1}}function ra(t,e){let o=Fo({superficie:"concreto",side:Vo}),r=new Pt,i=new ce(r,o);i.name="vias:viaduto",i.castShadow=!0,i.receiveShadow=!0,i.frustumCulled=!1,i.visible=!1,t.cena.add(i);let s=-1,c="",m=0,g=0;function f(){let M=t.sim.espelho.terreno,E=[];for(let R of e.arestas.values())R.ponte&&E.push({p:R.p,cotas:R.cotas,meia:it(R.tipo).meia,e:R.e});E.sort((R,S)=>R.e-S.e);let v=E.map(R=>`${R.e}:${R.cotas[0].toFixed(2)},${R.cotas[1].toFixed(2)}:${Array.from(R.p,S=>S.toFixed(1)).join(",")}:${R.meia}`).join("|");if(v===c)return;if(c=v,g=E.length,!E.length){i.visible=!1,m=0;return}let h=(R,S)=>t.sim.alturaEm?.(R,S)??0;r.dispose();let A=Ya(E,{chao:M?(R,S)=>Yt(M,R,S):h,bloqueia:Qa(e)});r.setAttribute("position",new st(A.pos,3)),r.setAttribute("normal",new st(A.nor,3)),r.setIndex(new st(A.idx,1)),r.computeBoundingSphere(),r.computeBoundingBox(),m=A.triangulos,i.visible=!0}return{malha:i,quadro(){e.versao!==s&&(s=e.versao,f())},estado:()=>({pecas:g,triangulos:m,visivel:i.visible}),descartar(){t.cena.remove(i),r.dispose(),o.dispose()}}}var ia=Object.freeze({ultra:{alcance:1400,faixa:260,cache:96,envios:3,vagas:.6},alta:{alcance:900,faixa:200,cache:64,envios:2,vagas:.55},media:{alcance:560,faixa:140,cache:40,envios:1,vagas:.5},leve:{alcance:300,faixa:90,cache:20,envios:1,vagas:0}}),ca=160,bt=256,ze=Object.freeze({k1:3e-4,k2:15e-7}),en=new Set(["rua","ruaMao","avenida","avenidaG"]);function Tt(t,e,o){if(!t.includes(e))throw new Error(`via: shader sem '${e}' (o three mudou?)`);return t.replace(e,o)}function la(){return{gViaTab:{value:null},gViaDetalhe:{value:null},gViaLonge:{value:new ie(300,420,ze.k1,ze.k2)},gViaCamada:{value:new ie(0,0,0,0)},gViaRampa:{value:Array.from({length:8},()=>new So)},gViaMascara:{value:0}}}function ua(t,e){let o=new te({color:16777215,roughness:.85,metalness:0});return o.name="via",o.onBeforeCompile=r=>{Object.assign(r.uniforms,e);let i=r.vertexShader;i=Tt(i,"#include <common>",`#include <common>
${Jo}`),i=Tt(i,"#include <beginnormal_vertex>",Xo),i=Tt(i,"#include <begin_vertex>",`#include <begin_vertex>
${Ko}`),i=Tt(i,"#include <project_vertex>",`#include <project_vertex>
${Wo}`);let s=r.fragmentShader;s=Tt(s,"#include <common>",`#include <common>
${Yo}`),s=Tt(s,"#include <color_fragment>",Qo),s=Tt(s,"#include <roughnessmap_fragment>",ta),s=Tt(s,"#include <emissivemap_fragment>",`#include <emissivemap_fragment>
${ea}`),s=Tt(s,"#include <aomap_fragment>",oa),s=Tt(s,"#include <dithering_fragment>",aa),r.vertexShader=i,r.fragmentShader=s},o.customProgramCacheKey=()=>"via-1",o.userData.via=!0,t.aplicar(o,t.nomes().filter(r=>r!=="camada"))}function fa(){return Qe({atributos:{posicao:new Int16Array(9),normal:new Int8Array(6),uv:new Float32Array(12),dados:new Uint8Array(12),id:new Uint32Array(3)},indices:new Uint16Array([0,1,2])})}function on(){this.array={byteLength:this.array.byteLength,length:this.array.length}}function Qe(t,{soltar:e=!1}={}){let o=new Pt,r=(c,m,g)=>{let f=new st(c,m,g);return e&&f.onUpload(on),f};if(t.atributos){let c=t.atributos;return o.setAttribute("position",r(c.posicao,3,!0)),o.setAttribute("normal",r(c.normal,2,!0)),o.setAttribute("aUV",r(c.uv,4,!1)),o.setAttribute("aDados",r(c.dados,4,!1)),o.setAttribute("aId",r(c.id,1,!1)),o.setIndex(r(t.indices,1,!1)),o.boundingSphere=new Qt(new Dt,Math.sqrt(3)*1.01),o.boundingBox=new ke(new Dt(-1.01,-1.01,-1.01),new Dt(1.01,1.01,1.01)),o}let i=t.nv,s=new Int8Array(i*2);for(let c=0;c<i;c++){let m=t.nor[3*c],g=t.nor[3*c+1],f=t.nor[3*c+2],M=Math.abs(m)+Math.abs(g)+Math.abs(f)||1,E=m/M,v=f/M;if(g<0){let h=(1-Math.abs(v))*(E>=0?1:-1),A=(1-Math.abs(E))*(v>=0?1:-1);E=h,v=A}s[2*c]=Math.round(E*127),s[2*c+1]=Math.round(v*127)}return o.setAttribute("position",new st(t.pos.slice(0,i*3),3)),o.setAttribute("normal",new st(s,2,!0)),o.setAttribute("aUV",new st(t.uv.slice(0,i*4),4)),o.setAttribute("aDados",new st(t.dados.slice(0,i*4),4)),o.setAttribute("aId",new st(t.id.slice(0,i),1)),o.setIndex(new st(t.idx.slice(0,t.ni),1)),o.computeBoundingSphere(),o}var Ke=1;function We(t,e,o){let r=t.length/4;return e>=0&&e<r&&(t[4*e+1]&=~Ke),o>=0&&o<r&&(t[4*o+1]|=Ke),o>=0&&o<r?o:-1}function Te(t,e){if(!t||t.tipo!=="aresta"||!Number.isFinite(t.ref)||!e)return-1;let o=Eo(t.ref);return o<e.n&&e.viva[o]&&e.ger[o]===Mo(t.ref)?o:-1}function ma(t,e,o){if(!t)return .45+.4*Et(o,97);let r=Math.max(0,e-t)/7200;return Math.min(1,.08+.3*r)}function an(t,e,o,r){if(r&je.ARCOLOGIA)return!0;for(let s of t.areas??[])if(s.id==="orla"&&s.contorno&&ho(e,o,s.contorno))return!0;let i=t.terreno;if(!i?.agua)return!1;for(let s=0;s<12;s++){let c=s*Math.PI/6;for(let m of[120,250]){let g=e+Math.cos(c)*m,f=o+Math.sin(c)*m,M=Math.round((g-i.origem[0])/i.passo),E=Math.round((f-i.origem[1])/i.passo);if(M>=0&&E>=0&&M<i.n&&E<i.n&&i.agua[E*i.n+M]===xo.MAR)return!0}}return!1}var Ce=class{constructor(e){this.grade=e,this.arestas=new Map,this.nos=new Map,this.versao=0}bracos(e,o){let r=e.vias.nos,i=[];for(let s=0;s<6;s++){let c=r.lig[6*o+s];if(c<0)continue;let m=this.arestas.get(c);m&&i.push({e:c,tipo:m.tipo,p:m.p,tab:m.tab,inverte:m.b===o&&m.a!==o,marcas:m.pedra?Vt.PEDRA:0,ponte:m.ponte,cotas:m.cotas})}return i}lerAresta(e,o){let r=e.vias.arestas,i=this.arestas.get(o),s=new Set(i?i.trechos.map(E=>E[2]):[]);if(o>=r.n||!r.viva[o])return this.arestas.delete(o),{sujos:s,nos:i?[i.a,i.b]:[]};let c=Float64Array.from(r.p.subarray(8*o,8*o+8)),m=Me(c),g=r.flags[o],f=Rt(c,m,m[16]/2),M={e:o,tipo:r.tipo[o],p:c,tab:m,L:m[16],a:r.a[o],b:r.b[o],mao:r.mao[o],flags:g,idade:r.idade[o],ger:r.ger[o],ponte:!!(g&je.PONTE),cotas:[r.y[2*o],r.y[2*o+1]],pedra:i&&i.p.every((E,v)=>E===c[v])?i.pedra:an(e,f.x,f.z,g),cIni:0,cFim:0,marcas:0,trechos:[]};return this.arestas.set(o,M),{sujos:s,nos:[M.a,M.b,...i?[i.a,i.b]:[]]}}lerNo(e,o){let r=e.vias.nos,i=this.nos.get(o),s=new Set(i?[i.setor]:[]);if(o>=r.n||!r.viva[o])return this.nos.delete(o),{sujos:s,arestas:[]};let c=this.bracos(e,o),m=r.x[o],g=r.z[o],f=this.grade.indice(m,g);if(s.add(f),!c.length)return this.nos.delete(o),{sujos:s,arestas:[]};let M=Uo({n:o,x:m,z:g,bracos:c}),E=M.tipo==="cruzamento"&&M.bracos.length>=3,v=E&&M.bracos.some(h=>h.P.id==="avenida"||h.P.id==="avenidaG")&&!M.bracos.some(h=>h.P.id==="rodovia");return this.nos.set(o,{n:o,x:m,z:g,tipo:M.tipo,setor:f,analise:M,zebra:E,semaforos:v}),{sujos:s,arestas:M.bracos.map(h=>h.e)}}fecharAresta(e){let o=this.arestas.get(e);if(!o)return[];let r=(v,h)=>this.nos.get(v)?.analise.bracos.find(A=>A.e===e&&A.inverte===h)?.corte??0;o.cIni=r(o.a,!1),o.cFim=r(o.b,!0);let i=it(o.tipo),s=o.pedra?Vt.PEDRA:0,c=this.nos.get(o.a),m=this.nos.get(o.b);if(en.has(i.id)){let v=o.mao===0?-1:-o.mao,h=o.mao===0?1:o.mao,A=(R,S)=>R<0?S?Vt.RET_INI_A:Vt.RET_FIM_A:S?Vt.RET_INI_B:Vt.RET_FIM_B;c?.zebra&&(s|=Vt.ZEBRA_INI|(o.mao===Ue.AB?0:A(v,!0))),m?.zebra&&(s|=Vt.ZEBRA_FIM|(o.mao===Ue.BA?0:A(h,!1)))}o.marcas=s,o.tampaIni=c?.tipo==="cruzamento",o.tampaFim=m?.tipo==="cruzamento";let g=o.cIni,f=o.L-o.cFim,M=Math.max(1,Math.ceil((f-g)/ca));o.trechos=[];let E={x:0,z:0,tx:1,tz:0,t:0};for(let v=0;v<M;v++){let h=g+(f-g)*v/M,A=g+(f-g)*(v+1)/M;Rt(o.p,o.tab,(h+A)/2,E),o.trechos.push([h,A,this.grade.indice(E.x,E.z)])}return o.trechos.map(v=>v[2])}tudo(e){let o=e.vias?.arestas,r=e.vias?.nos,i=new Set([...this.arestas.values()].flatMap(s=>s.trechos.map(c=>c[2])));for(let s of this.nos.values())i.add(s.setor);if(this.arestas.clear(),this.nos.clear(),!o||!r)return i;for(let s=0;s<o.n;s++)o.viva[s]&&this.lerAresta(e,s);for(let s=0;s<r.n;s++)r.viva[s]&&this.lerNo(e,s);for(let s of this.arestas.keys())for(let c of this.fecharAresta(s))i.add(c);for(let s of this.nos.values())i.add(s.setor);return this.versao++,i}tocar(e,o,r){let i=new Set,s=new Set(r);for(let m of o){let g=this.lerAresta(e,m);for(let f of g.sujos)i.add(f);for(let f of g.nos)s.add(f)}let c=new Set;for(let m of s){let g=this.lerNo(e,m);for(let f of g.sujos)i.add(f);for(let f of g.arestas)c.add(f)}for(let m of o)c.add(m);for(let m of c){let g=this.arestas.get(m);if(g){for(let f of g.trechos)i.add(f[2]);for(let f of this.fecharAresta(m))i.add(f)}}return this.versao++,i}},Ye=/vec4\s+tUso\s*=\s*texture\s*\(\s*uTerUso\s*,\s*tUVM\s*\)\s*;/;function da(t){return!Ye.test(t)||!t.includes("#include <common>")?null:t.replace("#include <common>",`#include <common>
uniform vec2 uViaPerto;`).replace(Ye,e=>`${e}
tUso.r *= smoothstep( uViaPerto.x, uViaPerto.y, vTer.z );`)}function sa(t){let e=t.chao?.malha?.material;if(!e||e.userData.viaLigada)return e?.userData.viaUniformes??null;let o={uViaPerto:{value:new Co(0,1)}},r=e.onBeforeCompile;e.onBeforeCompile=(s,c)=>{r?.call(e,s,c);let m=da(s.fragmentShader);if(!m){console.warn("vias: o chão não tem o uso do solo esperado; a pintura da via fica perto da câmera");return}Object.assign(s.uniforms,o),s.fragmentShader=m};let i=e.customProgramCacheKey?.bind(e);return e.customProgramCacheKey=()=>`${i?i():""}|viaPerto`,e.userData.viaLigada=!0,e.userData.viaUniformes=o,e.needsUpdate=!0,o}var pe={x:0,z:0,tx:1,tz:0,t:0},Oe=()=>typeof performance<"u"?performance.now():Date.now();function pa(t,e,o,r,i){let s=Math.max(0,Math.floor((e-t.origem[0])/t.passo)),c=Math.max(0,Math.floor((o-t.origem[1])/t.passo)),m=Math.min(t.n-1,Math.ceil((r-t.origem[0])/t.passo)),g=Math.min(t.n-1,Math.ceil((i-t.origem[1])/t.passo)),f=Math.max(2,Math.max(m-s,g-c)+1),M=new Float32Array(f*f);for(let E=0;E<f;E++){let v=Math.min(t.n-1,c+E);for(let h=0;h<f;h++)M[E*f+h]=t.altura[v*t.n+Math.min(t.n-1,s+h)]}return{ox:t.origem[0]+s*t.passo,oz:t.origem[1]+c*t.passo,n:f,passo:t.passo,altura:M}}function va(t,e,o,r=0){let i=[],s=e.x0,c=e.z0,m=e.x0+Jt,g=e.z0+Jt;for(let v of t.arestas.values())for(let[h,A,R]of v.trechos){if(R!==e.s)continue;i.push({e:v.e,tipo:v.tipo,p:Array.from(v.p),sIni:v.cIni,sFim:v.L-v.cFim,s0:h,s1:A,marcas:v.marcas,ponte:v.ponte,cotas:v.cotas,tampaIni:v.tampaIni,tampaFim:v.tampaFim,mao:v.mao});let S=it(v.tipo).meia+4,W=Math.max(2,Math.ceil((A-h)/8)+1);for(let $=0;$<W;$++)Rt(v.p,v.tab,h+(A-h)*$/(W-1),pe),s=Math.min(s,pe.x-S),m=Math.max(m,pe.x+S),c=Math.min(c,pe.z-S),g=Math.max(g,pe.z+S)}let f=[];for(let v of t.nos.values()){if(v.setor!==e.s||v.tipo==="reto")continue;f.push({n:v.n,x:v.x,z:v.z,semaforos:v.semaforos,bracos:v.analise.bracos.map(A=>({e:A.e,tipo:A.tipo,p:Array.from(A.p),inverte:A.inverte,marcas:A.marcas,ponte:A.ponte,cotas:A.cotas}))});let h=Math.max(60,...v.analise.bracos.map(A=>A.corte+A.P.meia+4));s=Math.min(s,v.x-h),m=Math.max(m,v.x+h),c=Math.min(c,v.z-h),g=Math.max(g,v.z+h)}let M=o.terreno,E=M?pa(M,s-16,c-16,m+16,g+16):null;return{dados:{setor:e.s,versao:e.versao,ox:e.x0,oz:e.z0,chao:E,arestas:i,nos:f,vagas:r},transferir:E?[E.altura.buffer]:[]}}function nn(t){let{cena:e,medidas:o}=t,r=t.sim.espelho,i=new Po({tam:r.mapa?.tam??8192,origem:r.mapa?.origem??[-4096,-4096]}),s=qo(t),c=new Ce(i),m=la();m.gViaDetalhe.value=t.textura("via.detalhe");let g=new Uint8Array(bt*bt*4),f=new Do(g,bt,bt,zo,To);f.magFilter=f.minFilter=Oo,f.generateMipmaps=!1,f.name="vias:tabela",m.gViaTab.value=f;let M=typeof location<"u"&&new URLSearchParams(location.search).get("passe")==="mascara";m.gViaMascara.value=M?1:0;let E=ua(t.ganchos,m),v=new ce(fa(),E);v.name="vias:aquecer",v.receiveShadow=!0,t.quadro?.aquecer?.add?.(v);let h=sa(t),A=ra(t,c),R=new Map,S=[],W=-1,$=null,J=0,et=!1,Y=0,Z=0,T=0,ut=0,ot=0,y=0,F=null,pt=new No,lt=new wo,vt=new ke,ht=()=>ee(ia,t.perfil),gt=x=>{let I=R.get(x);if(!I){let[G,D]=i.canto(x);I={s:x,x0:G,z0:D,versao:1,pedido:0,malha:null,objetos:null,estacionados:null,usado:0,dist:1/0,ymin:-5,ymax:60,caixa:null},R.set(x,I)}return I},ct=x=>{for(let I of x)I>=0&&gt(I).versao++};function Ot(x,I){if(I>=bt*bt)return;let G=c.arestas.get(I),D=4*I;g[D+2]=G?Math.round(ma(G.idade,x.tempo?.tique??0,I)*255):0,f.needsUpdate=!0}function Gt(x,I){let G=I.vias?.arestas;if(!G||!I.vias?.nos)return;W>=0&&Te($,G)!==W&&(W=We(g,W,Te($,G)),f.needsUpdate=!0);let D=!et||ue(x,"vias")||ue(x,"arestas")||ue(x,"nos");if(et=!0,D){ct(c.tudo(I));for(let L=0;L<Math.min(G.cap,bt*bt);L++)Ot(I,L)}else if(x.arestas?.length||x.nos?.length){ct(c.tocar(I,x.arestas??[],x.nos??[]));for(let L of x.arestas??[])Ot(I,L)}let k=I.tempo?(I.tempo.ano??0)*12+(I.tempo.mes??0):null;if(k!==F){if(F!==null&&!D)for(let L of c.arestas.keys())Ot(I,L);F=k}let K=ue(x,"terreno")?[[-1e9,-1e9,1e9,1e9]]:x.terreno??[];if(K.length&&!D)for(let L of R.values()){let at=L.x0+Jt,C=L.z0+Jt;K.some(P=>P[0]<=at+100&&P[2]>=L.x0-100&&P[1]<=C+100&&P[3]>=L.z0-100)&&L.versao++}}let qt=x=>va(c,x,t.sim.espelho,ht().vagas);function se(x){let I=x.versao;x.pedido=I,J++;let{dados:G,transferir:D}=qt(x);if(!G.arestas.length&&!G.nos.length){J--,S.push({st:x,r:{malhas:[],objetos:null,estacionados:[]},versao:I});return}let k=Oe();s.pedir("vias",G,{chave:x.s,transferir:D}).then(K=>{J--,ot+=Oe()-k,y++,S.push({st:x,r:K,versao:I})})}function Ct(x){x.malha&&(e.remove(x.malha.mesh),x.malha.mesh.geometry.dispose(),Z-=x.malha.bytes,T--,x.malha=null)}function wt(x){let I=0;for(let G=0;G<S.length;){let{st:D,r:k,versao:K}=S[G];if(k.erro){D.erro=K,S.splice(G,1);continue}if(I>=x)break;if(S.splice(G,1),D.malha&&D.malha.versao>K)continue;Ct(D);let L=k.malhas?.[0];if(D.objetos=k.objetos??null,D.estacionados=k.estacionados??[],ut++,!L){D.malha={mesh:new yo,versao:K,bytes:0,tris:0},T++;continue}let at=Qe(L,{soltar:!0}),C=new ce(at,E),[P,mt,_t,Ft]=L.escala;C.position.set(D.x0+P,mt,D.z0+_t),C.scale.setScalar(Ft),C.matrixAutoUpdate=!1,C.updateMatrix(),C.name=`vias:${D.s}`,C.receiveShadow=!0,o.familia(C,"vias"),e.add(C);let yt=L.indices.byteLength;for(let It of Object.values(L.atributos))yt+=It.byteLength;D.malha={mesh:C,versao:K,bytes:yt,tris:L.tris},D.ymin=D.y0=L.caixa[1],D.ymax=L.caixa[4],D.caixa=[D.x0+L.caixa[0],L.caixa[1],D.z0+L.caixa[2],D.x0+L.caixa[3],L.caixa[4],D.z0+L.caixa[5]],Z+=yt,T++,I++}}function Nt({envios:x=ht().envios,pedidos:I=s.worker?3:1}={}){Y++,wt(x);let G=ht(),D=t.camera;D.updateMatrixWorld(),lt.multiplyMatrices(D.projectionMatrix,D.matrixWorldInverse),pt.setFromProjectionMatrix(lt);let k=D.position,K=[],L=0,at=0;for(let C of R.values()){let P=C.caixa??[C.x0,C.ymin,C.z0,C.x0+Jt,C.ymax,C.z0+Jt];C.dist=Bo(k.x,k.y,k.z,P[0],P[1],P[2],P[3],P[4],P[5]);let mt=C.dist<G.alcance;if(mt&&C.pedido!==C.versao&&C.erro!==C.versao&&(!C.malha||C.malha.versao<C.versao)&&K.push(C),C.malha){vt.min.set(P[0],P[1]-1,P[2]),vt.max.set(P[3],P[4]+1,P[5]);let _t=mt&&pt.intersectsBox(vt);C.malha.mesh.visible=_t,mt&&(C.usado=Y),_t&&(L++,at+=C.malha.tris)}}K.sort((C,P)=>C.dist-P.dist);for(let C of K){if(J>=I)break;se(C)}if(T>G.cache){let C=[...R.values()].filter(P=>P.malha&&P.dist>=G.alcance).sort((P,mt)=>P.usado-mt.usado);for(let P of C){if(T<=G.cache)break;Ct(P),P.objetos=null,P.estacionados=null,P.pedido=0,ut++}}return{vis:L,tris:at}}function Lt(){let x=ht(),I=x.alcance-x.faixa;m.gViaLonge.value.set(I-160,I,ze.k1,ze.k2),h&&h.uViaPerto.value.set(I-120,I-40)}let q=[t.ouvir("qualidade",()=>{h=sa(t)}),t.ouvir("selecao",x=>{$=x??null,W=We(g,W,Te($,t.sim.espelho.vias?.arestas)),f.needsUpdate=!0}),t.ouvir("camadas",x=>{let I=t.sim.espelho.vias?.arestas,G=!!(x&&x.fonte==="arestas"&&x.dados&&I),D=I?Math.min(I.n,bt*bt):0;for(let k=0;k<bt*bt;k++){let K=0;if(G&&k<D){let L=x.dados[k];Number.isFinite(L)&&(K=x.categorico?Math.max(0,Math.min(7,Math.round(L))):1+Math.round(Math.min(1,Math.max(0,(L-(x.min??0))/((x.max??1)-(x.min??0)||1)))*254))}g[4*k]=K}f.needsUpdate=!0,m.gViaCamada.value.set(x?1:0,Math.min(8,x?.cores?.length??0),x?.categorico?1:0,0),(x?.cores??[]).slice(0,8).forEach((k,K)=>m.gViaRampa.value[K].set(k).convertSRGBToLinear())})];function xt(x,I){let D=I.sim.espelho.vias?.arestas;if(!D)return null;let k=Number.isFinite(x.xTela)?I.raio(x.xTela,x.yTela):null;if(!k)return null;let K={t:0,d:0,x:0,z:0},L=null;for(let C of c.arestas.values()){let P=it(C.tipo),mt=1/0,_t=-1/0,Ft=1/0,yt=-1/0;for(let It=0;It<4;It++)mt=Math.min(mt,C.p[2*It]),_t=Math.max(_t,C.p[2*It]),Ft=Math.min(Ft,C.p[2*It+1]),yt=Math.max(yt,C.p[2*It+1]);k[0]<mt-P.meia||k[0]>_t+P.meia||k[2]<Ft-P.meia||k[2]>yt+P.meia||(Re(C.p,k[0],k[2],0,K),K.d<=P.meia+.3&&(!L||K.d<L.d)&&(L={e:C.e,d:K.d}))}if(!L)return null;let at=x.origem;return{tipo:"aresta",idx:L.e,ref:Ao(L.e,D.ger[L.e]),ponto:k,dist:Math.hypot(k[0]-at[0],k[1]-at[1],k[2]-at[2])}}function tt(){if(J||S.length)return!1;let x=ht();for(let I of R.values())if(I.dist<x.alcance&&I.erro!==I.versao&&(!I.malha||I.malha.versao<I.versao))return!1;return!0}let nt={nome:"vias",material:E,tabela:f,uniformes:m,rede:c,grade:i,aplicar:Gt,viaduto:A,quadro(x,I){Lt(I),Nt(),A.quadro(x)},selecionar:xt,pronto:tt,get versaoObjetos(){return ut},*setoresPerto(x=1/0){for(let I of R.values())I.malha&&I.objetos&&I.dist<x&&(yield I)},async preparar({teto:x=12e4}={}){let I=Oe();for(t.cameraApi?.atualizar?.(I),et||Gt(t.sim.mudancas.desde(-1),t.sim.espelho),Lt(t);Oe()-I<x&&(Nt({envios:64,pedidos:s.worker?6:2}),!tt());)s.worker?await new Promise(G=>setTimeout(G,20)):(s.rodarLocal(4),await Promise.resolve());return Nt({envios:64}),nt.medidas()},medidas(){let x=0,I=0;for(let G of R.values())G.malha?.mesh.visible&&(x++,I+=G.malha.tris);return{setores:R.size,malhas:T,visiveis:x,tris:I,memoriaMB:+(Z/1048576).toFixed(2),arestas:c.arestas.size,nos:c.nos.size,msPedidoMedio:y?+(ot/y).toFixed(1):0}},gerarAgora(x){return Go(qt(gt(x)).dados)},descartar(){for(let x of q)x?.();t.quadro?.aquecer?.delete?.(v),A.descartar(),v.geometry.dispose();for(let x of R.values())Ct(x);f.dispose(),E.dispose()}};return nt}function rn(t){t.registrarDominio("vias",nn),t.registrarSelecionavel("aresta",(e,o)=>o.dominio("vias")?.selecionar?.(e,o)??null,{prioridade:Lo.mundo})}var vn={};He(vn,{A_MAX:()=>oo,A_PLANO:()=>Se,BASE_TIPO:()=>ro,CARRO_GLSL:()=>wa,DENSIDADE_MAX:()=>Ea,DESISTE:()=>_a,FOLGA_FILA:()=>xe,LIMPEZA:()=>Va,PARADA:()=>he,PERFIL_TRAFEGO:()=>Aa,VERMELHO:()=>Ia,V_NO:()=>ye,criarMaterialCarro:()=>ya,curvaEntre:()=>Le,densidade:()=>Ra,densidadeFluxo:()=>ba,distPoligonais:()=>za,distanciaNaFila:()=>ln,faixaDestino:()=>no,faixasOrdenadas:()=>Ut,faseSemaforo:()=>Oa,fatorHora:()=>so,fatorZona:()=>Ma,fimDaFaixa:()=>zt,inicioDaFaixa:()=>jt,matrizGiroY:()=>Ne,naFaixa:()=>$t,pesoDistancia:()=>ao,pontoCurva:()=>Wt,registrar:()=>pn,restaVermelho:()=>Ta,velSegura:()=>ge,virada:()=>De});var Aa=Object.freeze({ultra:{carros:400,estacionados:500,raio:700,lod0:130,parados:450},alta:{carros:240,estacionados:300,raio:500,lod0:95,parados:320},media:{carros:120,estacionados:160,raio:360,lod0:70,parados:230},leve:{carros:50,estacionados:0,raio:220,lod0:40,parados:0}}),ro=Object.freeze({rua:.45,ruaMao:.5,avenida:1.1,avenidaG:1.35,rodovia:1.3,terra:.08}),cn=Object.freeze({res:1,com:2.2,esc:2.6,ind:1.5}),Ea=9;function so(t){let e=(o,r)=>Math.exp(-(((t-o+36)%24-12)**2)/(2*r*r));return Math.min(1,.1+.9*Math.max(e(7.5,1.4),.95*e(18,1.8),.6*e(12.5,2.4),.45*e(15,3)))}function Ma(t,e){let o=0;for(let[i,s]of Object.entries(t??{}))o+=(cn[i]??1)*s;let r=Math.max(1,e/8*2);return .4+Math.min(1.8,1.4*o/r)}function Ra(t,e,o,r){let i=it(t).id;return(ro[i]??.3)*so(e)*Ma(o,r)}function ba(t,e,o,r,i){if(!(e>0)||!(o>0))return 0;let s=Math.max(5,it(t).velocidade*Math.max(.15,Math.min(1,r||1)));return Math.min(Ea,e/o/s*so(i)/10)}var he=7.3,xe=2,Se=3,oo=7,ye=Object.freeze({cruzamento:7,curva:10,retorno:5}),ha=45,re=8,ao=(t,e)=>t<=.3*e?1:Math.max(.2,1-.8*(t-.3*e)/(.7*e)),_a=50,ln=(t,e)=>(Bt[t].c+Bt[e].c)/2+xe,ga=(t,e)=>(t.c+e.c)/2+xe,ge=(t,e=0)=>Math.sqrt(Math.max(0,2*Se*t+.6*e*e)),Ia=21,Va=3;function Oa(t,e,o){let r=((t+o*.16)%40+40)%40,i=e<.5?r:(r+20)%40;return i<16?0:i<19?1:2}function Ta(t,e,o){let r=((t+o*.16)%40+40)%40,i=e<.5?r:(r+20)%40;return i>=19?40-i:0}function De(t,e,o,r){let i=Math.atan2(t*r-e*o,t*o+e*r);return Math.abs(i)<.61?0:i>0?1:-1}var xa=new Map;function Ut(t,e,o){let r=`${t}:${e}:${o}`,i=xa.get(r);return i||(i=Ge(t,e).filter(s=>s.sentido===o).sort((s,c)=>s.u*o-c.u*o),xa.set(r,i)),i}function no(t,e,o,r,i=!1,s=null){return t.length?r>0||r===0&&i?t[t.length-1]:r<0?t[0]:o<=1?s===null?t[t.length-1]:t[Math.min(t.length-1,Math.floor(s*t.length))]:t[Math.round(e/(o-1)*(t.length-1))]:null}function we(t,e,o,r,i,s){let c=i-o,m=s-r,g=c*c+m*m,f=g>0?Math.max(0,Math.min(1,((t-o)*c+(e-r)*m)/g)):0,M=t-o-f*c,E=e-r-f*m;return M*M+E*E}function un(t,e,o,r,i,s,c,m){let g=o-t,f=r-e,M=c-i,E=m-s,v=t-i,h=e-s,A=g*E-f*M;if(Math.abs(A)>1e-12){let R=(M*h-E*v)/A,S=(g*h-f*v)/A;if(R>=0&&R<=1&&S>=0&&S<=1)return 0}return Math.min(we(t,e,i,s,c,m),we(o,r,i,s,c,m),we(i,s,t,e,o,r),we(c,m,t,e,o,r))}function za(t,e,o,r,i=0,s=1/0){let c=1/0,m=i*i,g=t.length/2-1,f=Math.min(o.length/2-1,s);for(let M=e;M<g;M++)for(let E=r;E<f;E++){let v=un(t[2*M],t[2*M+1],t[2*M+2],t[2*M+3],o[2*E],o[2*E+1],o[2*E+2],o[2*E+3]);if(v<c&&(c=v,c<m))return Math.sqrt(c)}return Math.sqrt(c)}function Wt(t,e,o){let r=1-e,i=r*r*r,s=3*r*r*e,c=3*r*e*e,m=e*e*e;o.x=i*t[0]+s*t[2]+c*t[4]+m*t[6],o.z=i*t[1]+s*t[3]+c*t[5]+m*t[7];let g=3*r*r*(t[2]-t[0])+6*r*e*(t[4]-t[2])+3*e*e*(t[6]-t[4]),f=3*r*r*(t[3]-t[1])+6*r*e*(t[5]-t[3])+3*e*e*(t[7]-t[5]),M=Math.sqrt(g*g+f*f)||1;return o.hx=g/M,o.hz=f/M,o}function Ne(t,e,o,r,i,s,c,m=1){let g=Math.sqrt(s*s+c*c),f=g>1e-9?s/g*m:0,M=g>1e-9?c/g*m:m;t[e]=M,t[e+1]=0,t[e+2]=-f,t[e+3]=0,t[e+4]=0,t[e+5]=m,t[e+6]=0,t[e+7]=0,t[e+8]=f,t[e+9]=0,t[e+10]=M,t[e+11]=0,t[e+12]=o,t[e+13]=r,t[e+14]=i,t[e+15]=1}function ve(t,e){t.x=e.x,t.z=e.z,t.hx=e.hx,t.hz=e.hz}var Xt={x:0,z:0,tx:1,tz:0,t:0};function $t(t,e,o,r,i){return Rt(t.p,t.tab,o,Xt),i.x=Xt.x-Xt.tz*e,i.z=Xt.z+Xt.tx*e,i.hx=Xt.tx*r,i.hz=Xt.tz*r,i}var zt=(t,e)=>e>0?t.L-t.cFim:t.cIni,jt=(t,e)=>e>0?t.cIni:t.L-t.cFim,dt={x:0,z:0,hx:1,hz:0},Mt={x:0,z:0,hx:1,hz:0};function Le(t,e,o,r,i,s,c=!1){$t(t,e,zt(t,o),o,dt),$t(r,i,jt(r,s),s,Mt);let m=Math.hypot(Mt.x-dt.x,Mt.z-dt.z),g=c?Math.max(3,m*.9):m*.42,f=[dt.x,dt.z,dt.x+dt.hx*g,dt.z+dt.hz*g,Mt.x-Mt.hx*g,Mt.z-Mt.hz*g,Mt.x,Mt.z],M=Math.hypot(f[2]-f[0],f[3]-f[1])+Math.hypot(f[4]-f[2],f[5]-f[3])+Math.hypot(f[6]-f[4],f[7]-f[5]),E=new Float64Array(2*(re+1)),v={x:0,z:0,hx:0,hz:0};for(let A=0;A<=re;A++)Wt(f,A/re,v),E[2*A]=v.x,E[2*A+1]=v.z;let h=Math.abs(Math.atan2(dt.hx*Mt.hz-dt.hz*Mt.hx,dt.hx*Mt.hx+dt.hz*Mt.hz));return{p:f,L:Math.max(1,(m+M)/2),poli:E,vir:c?0:De(dt.hx,dt.hz,Mt.hx,Mt.hz),ang:c?Math.PI:h}}function fn(t,e,o){return(t==="avenida"||t==="avenidaG")&&e<.06?4:e<.06+(t==="rodovia"?.1:0)+.12*o?5:Ve([[0,.32],[1,.25],[2,.23],[3,.14],[6,t==="rua"?.03:.06]],Et(Math.floor(e*1e6),7))}var Ca=([t])=>{let e=parseInt(t.slice(1),16);return[e>>16&255,e>>8&255,e&255]},to=qe.map(Ca),mn=Ze.map(Ca);function Kt(t,e,o){if(!t.includes(e))throw new Error(`carro: shader sem '${e}'`);return t.replace(e,o)}var wa=Object.freeze({verticePars:`
attribute float aParte;
attribute vec4 aCarro;
flat varying vec4 vCarro;
flat varying float vParte;
varying vec2 vCarroLocal;
`,vertice:`
vCarro=aCarro;
vParte=aParte;
vCarroLocal=position.xy;
`,fragmentoPars:`
flat varying vec4 vCarro;
flat varying float vParte;
varying vec2 vCarroLocal;
uniform float gCarroNoite;
float gCarroRug=0.36;
float gCarroMetal=0.0;
vec3 carroLinear(vec3 s){return pow(s / 255.0,vec3(2.2));}
`,cor:`
{
int p=int(vParte + 0.5);
vec3 c;
if(p==0 || p==8 || p==9){
c=min(carroLinear(vCarro.rgb),vec3(0.75));
float l=dot(c,vec3(0.2126,0.7152,0.0722));
float sat=max(c.r,max(c.g,c.b))- min(c.r,min(c.g,c.b));
gCarroMetal=(l > 0.06 && l < 0.6 && sat < 0.06)? 0.45 : 0.0;
gCarroRug=0.36 + 0.06 * gCarroMetal;
}
else if(p==1){c=vec3(0.028,0.032,0.036);gCarroRug=0.12;}
else if(p==2){c=vec3(0.025);gCarroRug=0.85;}
else if(p==3){c=vec3(0.5,0.5,0.48);gCarroRug=0.18;}
else if(p==4){c=vec3(0.22,0.012,0.01);gCarroRug=0.22;}
else if(p==5){c=vec3(0.62,0.62,0.6);gCarroRug=0.45;}
else if(p==6){c=vec3(0.32,0.32,0.33);gCarroRug=0.3;gCarroMetal=0.8;}
else if(p==10){c=vec3(0.6,0.61,0.6);gCarroRug=0.55;}
else if(p==11){c=vec3(0.04,0.042,0.045);gCarroRug=0.7;}
else{c=vec3(0.0);gCarroRug=1.0;}
diffuseColor.rgb=c;
}
`,rugosidade:`
float roughnessFactor=gCarroRug;
`,metal:`
float metalnessFactor=gCarroMetal;
`,emissivo:`
{
int p=int(vParte + 0.5);
int luz=int(vCarro.a + 0.5);
if(p==3 &&(luz & 1)!=0)totalEmissiveRadiance +=vec3(1.0,0.88,0.7)* 9.0 * gCarroNoite;
if(p==4)totalEmissiveRadiance +=vec3(1.0,0.04,0.02)*(((luz & 2)!=0 ? 5.0 : 0.0)+ 2.5 * gCarroNoite * float(luz & 1));
if(p==8 || p==9){
float x=abs(vCarroLocal.x);
float par=step(0.3,x)* step(x,1.15)* step(0.55,vCarroLocal.y)* step(vCarroLocal.y,0.82);
if(p==8 &&(luz & 1)!=0)totalEmissiveRadiance +=vec3(1.0,0.88,0.7)* 6.0 * gCarroNoite * par;
if(p==9)totalEmissiveRadiance +=vec3(1.0,0.04,0.02)* par *(((luz & 2)!=0 ? 4.0 : 0.0)+ 1.8 * gCarroNoite * float(luz & 1));
}
}
`});function ya(t,e){let o=new te({color:16777215,roughness:.4,metalness:0});o.name="carro";let r=wa;return o.onBeforeCompile=i=>{Object.assign(i.uniforms,e);let s=i.vertexShader;s=Kt(s,"#include <common>",`#include <common>
${r.verticePars}`),s=Kt(s,"#include <begin_vertex>",`#include <begin_vertex>
${r.vertice}`);let c=i.fragmentShader;c=Kt(c,"#include <common>",`#include <common>
${r.fragmentoPars}`),c=Kt(c,"#include <color_fragment>",r.cor),c=Kt(c,"#include <roughnessmap_fragment>",r.rugosidade),c=Kt(c,"#include <metalnessmap_fragment>",r.metal),c=Kt(c,"#include <emissivemap_fragment>",`#include <emissivemap_fragment>
${r.emissivo}`),i.vertexShader=s,i.fragmentShader=c},o.customProgramCacheKey=()=>"carro-2",t.aplicar(o,t.nomes().filter(i=>i!=="camada"))}var Ht=(t,e,o)=>(t*1024+Math.round(e*8)+512)*2+(o>0?1:0);function ne(t,e){let o=t.get(e);return o||t.set(e,o=[]),o}function eo(t,e){if(e)t.clear();else for(let o of t.values())o.length=0}function dn(t){let{cena:e,medidas:o}=t,r={gCarroNoite:{value:0}},i=ya(t.ganchos,r),s=()=>ee(Aa,t.perfil),c=[];function m(){for(let u of c)e.remove(u.mesh),u.mesh.geometry.dispose(),u.mesh.dispose();c.length=0;let n=s(),a=Math.max(16,n.carros+n.estacionados);Bt.forEach((u,p)=>{for(let d of[0,1]){let _=Zo(p,d),b=new Pt;b.setAttribute("position",new st(_.posicao,3)),b.setAttribute("normal",new st(_.normal,3)),b.setAttribute("aParte",new st(Float32Array.from(_.parte),1)),b.setIndex(new st(_.indices,1));let O=new le(new Uint8Array(a*4),4,!1);O.setUsage(Zt),b.setAttribute("aCarro",O),b.boundingSphere=new Qt(new Dt,1e7);let l=new be(b,i,a);l.instanceMatrix.setUsage(Zt),l.frustumCulled=!1,l.count=0,l.visible=!1,l.name=`carros:${Bt[p].id}:${d}`,o.familia(l,"vida"),e.add(l),c.push({mi:p,lod:d,mesh:l,cor:O,cap:a,tris:_.tris})}})}m();let g=t.perfil.id,f=[],M=new Map,E=new Set,v=[],h=0,A=0,R=null,S=-1e9,W=null,$=!0,J=-1,et=1,Y=null,Z=new Dt,T={x:0,z:0,tx:1,tz:0,t:0},ut=new Map,ot=new Map,y=new Map,F=[],pt=0,lt=0,vt=0;function ht(n){let a=n.celulas,u=new Map;if(!a)return u;for(let p=0;p<a.n;p++){if(!a.viva[p]||a.estado[p]!==go.OCUPADA||!a.zona[p])continue;let d=Ro[bo[a.zona[p]]]?.familia;if(!d)continue;let _=a.aresta[p],b=u.get(_);b||u.set(_,b={}),b[d]=(b[d]??0)+1}return u}function gt(n,a,u,p){if(!n?.ida||a.e>=n.ida.length)return null;let d=u>0?n.ida[a.e]:n.volta?.[a.e]??0;return!(d>0)&&!p(-u)&&(d=u>0?n.volta?.[a.e]??0:n.ida[a.e]),{q:d||0,vel:n.vel?.[a.e]??1}}function ct(n,a,u){let p=s().raio,d=u?.fluxos??null;v=[],h=0;for(let l of n.rede.arestas.values()){let B=l.L-l.cIni-l.cFim;if(B<12)continue;Rt(l.p,l.tab,l.L/2,T);let w=Math.hypot(T.x-Z.x,T.z-Z.z);if(w>p+l.L/2)continue;let z=Ge(l.tipo,l.mao);if(!z.length)continue;let V={1:0,"-1":0};for(let j of z)V[j.sentido]++;let X=j=>V[j]>0,U=(W?.get(l.e)?.ind??0)/Math.max(1,B/8),H=z.map(j=>{let Q=d?gt(d,l,j.sentido,X):null;return(Q?ba(l.tipo,Q.q,V[j.sentido],Q.vel,a):Ra(l.tipo,a,W?.get(l.e),l.L))*B/100}),N=H.reduce((j,Q)=>j+Q,0);N<=0||(v.push({ar:l,faixas:z,pesos:H,w:N,ind:U,g:ao(w,p),ws:0}),h+=N)}let _=Math.min(s().carros,h),b=0;for(let l of v)b+=l.w*l.g;let O=b>=_||h<=b?0:(_-b)/(h-b);A=0;for(let l of v)l.ws=l.w*(l.g+O*(1-l.g)),A+=l.ws;R=Z.clone()}function Ot(n,a,u){let p=F[pt];p||F.push(p={c:null,pos:0}),pt++,p.c=a,p.pos=u,ne(ut,n).push(p)}function Gt(n,a,u,p,d,_=0){let b=ut.get(Ht(n.e,a,u));if(!b)return!0;let O=p*u;for(let l of b)if(Math.abs(l.pos-O)<(d+l.c.c)/2+xe+_)return!1;return!0}function qt(n,a,u,p,{c:d=Bt[p].c,l:_=Bt[p].l,vMax:b,cor:O,externo:l=null}={}){let B=et++,w=it(n.tipo),z=b??w.velocidade/3.6*(.72+.25*Et(B,5)),V={id:B,e:n.e,u:a.u,sentido:a.sentido,s:u,v:0,vMax:z,mi:p,c:d,l:_,cor:O??(p===6?mn[Ve(Ze.map(([,U],H)=>[H,U]),Et(B,6))]:to[Ve(qe.map(([,U],H)=>[H,U]),Et(B,6))]),curva:null,prox:null,reserva:null,tPedido:null,quer:!1,espera:0,parado:0,freio:!1,x:0,y:0,z:0,hx:1,hz:0,idade:0,externo:l},X=(zt(n,a.sentido)-u)*a.sentido;return V.v=Math.min(z*.8,ge(Math.max(0,X-he-d/2))),$t(n,V.u,V.s,V.sentido,dt),ve(V,dt),V}function se(n=0){if(!v.length||A<=0)return null;let a=Et(et,1)*A,u=v[v.length-1];for(let z of v)if(a-=z.ws,a<0){u=z;break}let p=Et(et,2)*u.w,d=u.faixas[u.faixas.length-1];for(let z=0;z<u.faixas.length;z++)if(p-=u.pesos[z],p<0){d=u.faixas[z];break}let _=u.ar,b=_.cIni+6,O=_.L-_.cFim-6,l=O-b>30?d.sentido>0?b+Et(et,3)*(O-b-24):b+24+Et(et,3)*(O-b-24):(b+O)/2;if(n>0){Rt(_.p,_.tab,l,T);let z=t.camera.position;if((T.x-z.x)**2+(T.z-z.z)**2<n*n)return null}let B=it(_.tipo),w=fn(B.id,Et(et,4),u.ind);if(!Gt(_,d.u,d.sentido,l,Bt[w].c,8))return null;for(let z of ut.get(Ht(_.e,d.u,d.sentido))??[])if(z.c.parado>15)return null;return qt(_,d,l,w)}function Ct(n,a){let u=Ut(n.tipo,n.mao,a.sentido);return{rank:Math.max(0,u.findIndex(p=>p.u===a.u)),n:u.length}}function wt(n,a,u,p,d,_,b,O={}){let l=!!O.retorno,B=Le(a,n.u,n.sentido,u,d.u,p,l),w=l?ye.retorno:_.tipo==="cruzamento"?ye.cruzamento:_.tipo==="curva"?ye.curva:n.vMax;return{ar:u,sentido:p,u:d.u,s:jt(u,p),no:_,n:b,de:a,...B,vLim:w,retorno:l,...O}}function Nt(n,a,u){let p=a.sentido>0?u.b:u.a,d=n.rede.nos.get(p);if(!d)return null;Rt(u.p,u.tab,zt(u,a.sentido),T);let _=T.tx*a.sentido,b=T.tz*a.sentido,{rank:O,n:l}=Ct(u,a),B=a.externo;if(B){let H=B.k+1,N=B.plano.passos[H];if(!N)return null;let j=n.rede.arestas.get(N.e);if(!j||(N.sentido>0?j.a:j.b)!==p)return null;let Q=Ut(j.tipo,j.mao,N.sentido);if(!Q.length)return null;Rt(j.p,j.tab,jt(j,N.sentido),T);let rt=De(_,b,T.tx*N.sentido,T.tz*N.sentido);return wt(a,u,j,N.sentido,no(Q,O,l,rt,!0),d,p,{k:H})}let w=[],z=t.sim?.espelho?.fluxos;for(let H of d.analise.bracos){if(H.e===a.e&&H.inverte===a.sentido>0)continue;let N=n.rede.arestas.get(H.e);if(!N)continue;let j=H.inverte?-1:1,Q=Ut(N.tipo,N.mao,j);if(!Q.length)continue;let rt=De(_,b,H.dx,H.dz),At=(ro[it(N.tipo).id]??.3)+.2;if(z?.ida&&N.e<z.ida.length){let St=j>0?z.ida[N.e]:z.volta?.[N.e]??0;!(St>0)&&N.mao&&(St=j>0?z.volta?.[N.e]??0:z.ida[N.e]),At=.15+Math.max(0,St||0)/600}n.rede.nos.get(j>0?N.b:N.a)?.tipo==="ponta"&&N.L<40&&(At*=.001),l>1&&rt>0&&O<l-1&&(At*=.15),l>1&&rt<0&&O>0&&(At*=.03),w.push({a2:N,sentido:j,fx:Q,w:At,vir:rt})}if(!w.length){if(d.tipo!=="ponta"||it(u.tipo).id==="rodovia")return null;let H=-a.sentido,N=Ut(u.tipo,u.mao,H);return N.length?wt(a,u,u,H,N[0],d,p,{retorno:!0}):null}let V=w.reduce((H,N)=>H+N.w,0),X=Et(a.id,a.idade+++11)*V,U=w[w.length-1];for(let H of w)if(X-=H.w,X<0){U=H;break}return wt(a,u,U.a2,U.sentido,no(U.fx,O,l,U.vir,!1,Et(a.id,a.idade+31)),d,p)}function Lt(n,a,u,p){if(n.sinal!==void 0)return n.sinal;let d=a?.semaforos?a.analise.bracos.find(_=>_.e===u&&_.inverte===p>0):null;return n.sinal=d?{grupo:$o(d.theta),defas:ko(a.n)}:null,n.sinal}let q=(n,a)=>n?Oa(a,n.grupo,n.defas):0,xt=(n,a)=>n?Ia-Ta(a,n.grupo,n.defas):0;function tt(n,a){let u=ut.get(Ht(n.ar.e,n.u,n.sentido));if(!u)return!0;let p=n.s*n.sentido;for(let d of u)if(d.c!==a&&(d.c.curva&&d.c.curva.prox.ar.e===n.ar.e&&d.c.curva.prox.u===n.u&&d.c.curva.prox.sentido===n.sentido||d.pos-p<ga(a,d.c)))return!1;return!0}let nt=(n,a)=>{let u=a.ang??0;return u<.2?0:Math.min(3,n.c*n.c*u/(8*a.L))},x=n=>(n.tPedido??vt)+(n.prox?.vir<0?2:0)-(n.prox?.principal?3:0);function I(n,a,u){if(u===n)return!1;let p=u.saindoNo===a.n&&!u.curva,d=u.naBoca===a.n&&u.reserva!==a.n;if(!p&&u.e===n.e&&u.u===n.u&&u.sentido===n.sentido)return!1;let _=p?u.saindo:u.curva?u.curva.prox:u.reserva===a.n?u.reservaPx:u.prox;if(!_?.poli)return!1;let b=p?re-1:u.curva?Math.max(0,Math.floor((u.curva.t-(u.c/2+.5)/u.curva.L)*re)):0,O=(n.l+u.l)/2+.7+nt(n,a)+(d?0:nt(u,_));return za(a.poli,0,_.poli,d?0:Math.min(re-1,b),O,d?1:1/0)<O}function G(n,a,u){for(let d of ot.get(a.n)??[])if(I(n,a,d))return!1;let p=x(n);for(let d of y.get(a.n)??[]){if(d===n||d.reserva!=null||!d.prox||d.prox.n!==a.n)continue;let _=d.prox;if(!d.livre&&(_.ar.e!==a.ar.e||_.u!==a.u||_.sentido!==a.sentido))continue;let b=x(d);if((b<p||b===p&&d.id<n.id)&&I(n,a,d))return!1}return!(u?.faixaOcupada&&(u.faixaOcupada(a.n,a.ar.e)||u.faixaOcupada(a.n,n.e)))}function D(n){if(n.reserva==null)return;let a=ot.get(n.reserva);if(a){let u=a.indexOf(n);u>=0&&a.splice(u,1)}n.reserva=null}function k(n,a,u){let p=n.v,d=n.c>9?1.2:n.c>6?1.6:2.4;n.v=Math.max(0,n.v+Math.max(-oo*u,Math.min(d*u,a-n.v))),n.freio=n.v<p-.05*u||n.v<.3}function K(n,a){let p=it(a.tipo).velocidade/3.6*.9,d=n.externo,_=Number.isFinite(d.alvoD)?d.alvoD-L(n):0;return Math.max(.35*p,Math.min(1.2*p,p*(1+_/80)))}function L(n){let a=n.externo,u=a.plano,p=a.k,d=u.ars[p];if(!d)return 0;let _=(b,O,l)=>O>0?b:l.L-b;if(n.curva){let b=u.cum[p]+_(zt(d,n.sentido),n.sentido,d),O=u.ars[p+1],l=O?u.cum[p+1]+_(jt(O,u.passos[p+1].sentido),u.passos[p+1].sentido,O):b;return b+(l-b)*n.curva.t}return u.cum[p]+_(n.s,n.sentido,d)}let at={x:0,z:0,hx:1,hz:0};function C(n,a,u,p){let d=n.rede,_=t.camera.position;vt=u;let b=++lt%600===0;eo(ut,b),eo(ot,b),eo(y,b),pt=0;for(let l of f){if(l.gap=1/0,l.vL=0,l.curva){let B=d.arestas.get(l.e),w=l.curva,z=w.prox,V=z.vir||z.retorno?1+.12*l.c:.5;B&&Ot(Ht(l.e,l.u,l.sentido),l,zt(B,l.sentido)*l.sentido+w.t*w.L+V),Ot(Ht(z.ar.e,z.u,z.sentido),l,z.s*z.sentido-(1-w.t)*w.L-V)}else Ot(Ht(l.e,l.u,l.sentido),l,l.s*l.sentido);l.saindoNo!=null&&ne(ot,l.saindoNo).push(l),l.naBoca=null,!l.curva&&l.reserva==null&&l.prox&&l.prox.de===d.arestas.get(l.e)&&(zt(l.prox.de,l.sentido)-l.s)*l.sentido<he+l.c/2-.5&&(l.naBoca=l.prox.n,ne(ot,l.naBoca).push(l)),l.reserva!=null?ne(ot,l.reserva).push(l):l.quer&&l.prox&&ne(y,l.prox.n).push(l)}for(let l of ut.values()){l.sort((B,w)=>B.pos-w.pos||B.c.id-w.c.id);for(let B=0;B+1<l.length;B++){let w=l[B],z=l[B+1],V=z.pos-w.pos-ga(w.c,z.c);V<w.c.gap&&(w.c.gap=V,w.c.vL=z.c.v)}}let O=new Set;for(let l of f)l.curva?P(l,a):mt(n,l,a,u,p)||O.add(l),l.parado=l.v<.1?l.parado+a:0,l.parado>_a&&!l.externo&&Math.hypot(l.x-_.x,l.z-_.z)>60&&O.add(l);if(O.size){for(let l of O)D(l),l.externo&&(l.externo.chegou=!0,M.delete(l.externo.id),E.add(l.externo.id));for(let l=f.length-1;l>=0;l--)O.has(f[l])&&f.splice(l,1)}}function P(n,a){let u=n.curva,p=u.prox;k(n,Math.min(p.vLim,n.vMax,ge(n.gap,n.vL)),a);let d=Math.min(n.v*a,Math.max(0,n.gap));if(d<n.v*a&&(n.v=a>0?d/a:0),u.t+=d/u.L,u.t>=1){n.e=p.ar.e,n.u=p.u,n.sentido=p.sentido,n.s=p.s,n.curva=null,n.prox=null,n.reserva!=null&&(n.saindo=p,n.saindoNo=n.reserva,n.reserva=null),n.espera=0,n.externo&&(n.externo.k=p.k),$t(p.ar,n.u,n.s,n.sentido,at),ve(n,at);return}Wt(p.p,u.t,at),ve(n,at)}function mt(n,a,u,p,d){let _=n.rede,b=_.arestas.get(a.e);if(!b)return!1;a.saindo&&(a.s-jt(b,a.sentido))*a.sentido>a.c/2+1&&(a.saindo=null,a.saindoNo=null);let O=zt(b,a.sentido),l=(O-a.s)*a.sentido,B=a.sentido>0?b.b:b.a,w=_.nos.get(B),z=a.externo?K(a,b):a.vMax;z=Math.min(z,ge(a.gap,a.vL)),a.prox&&(_.arestas.get(a.prox.ar.e)!==a.prox.ar||a.prox.de!==b||_.nos.get(a.prox.n)!==a.prox.no)&&(a.prox=null,D(a)),l<ha&&a.prox==null&&(a.prox=Nt(n,a,b)??!1);let V=a.prox||null,X=he+a.c/2,U=!!V;if(a.quer=!1,V&&(z=Math.min(z,Math.sqrt(V.vLim*V.vLim+2*Se*Math.max(0,l))),l<ha)){let N=tt(V,a)||a.espera>15&&w?.tipo!=="cruzamento",j=d?.faixaOcupada?.(B,a.e)??!1;if((w?.tipo==="cruzamento"||w?.tipo==="curva")&&!V.retorno){let rt=Lt(V,w,a.e,a.sentido),At=q(rt,p),Ae=At===0,St=l<X+1&&a.v<.5,$a=At===1||At===2&&V.vir<0&&xt(rt,p)<Va,Be=Ae||$a&&St&&a.espera>3;if(V.principal===void 0){let Ee=w.analise.bracos.map(ka=>ka.P.velocidade),vo=it(b.tipo).velocidade;V.principal=!w.semaforos&&vo>=Math.max(...Ee)&&Math.min(...Ee)<vo}if(a.reserva!=null&&(!Be||!N||j)&&l-X>a.v*a.v/(2*oo)+.5&&D(a),a.reserva==null){let Ee=l-X<=a.v*a.v/(2*Se)+4||l<X+1;Be&&Ee?(a.tPedido??=p+Math.max(0,l-X)/Math.max(1,a.v),a.quer=!0,a.livre=N&&!j,N&&!j&&G(a,V,d)&&(a.reserva=B,a.reservaPx=V,ne(ot,B).push(a),a.tPedido=null,a.quer=!1)):Be||(a.tPedido=null)}U=a.reserva!=null}else U=N&&!j;if(!U){let rt=l>=X-.5?l-X:l-.3;z=Math.min(z,ge(Math.max(0,rt)))}}k(a,z,u);let H=Math.min(a.v*u,Math.max(0,a.gap));if(V&&!U&&(H=Math.min(H,Math.max(0,l-.05))),H<a.v*u&&(a.v=u>0?H/u:0),a.espera=a.v<.3?a.espera+u:0,a.s+=H*a.sentido,(O-a.s)*a.sentido<=1e-6){if(!V)return!1;if(U)return a.s=O,a.curva={t:0,L:V.L,prox:V},a.prox=null,Wt(V.p,0,at),ve(a,at),!0;a.s=O}return $t(b,a.u,a.s,a.sentido,at),ve(a,at),!0}function _t(n,a,u,p){let d=M.get(n);if(d)return d.externo.alvoD=u,d.externo.visto=vt,d;let _=t.dominio("vias");if(!_?.rede||!a?.passos?.length)return null;let b=0;for(;b+1<a.passos.length&&a.cum[b+1]<=u;)b++;let O=a.passos[b],l=_.rede.arestas.get(O.e);if(!l||l!==a.ars[b])return null;let B=u-a.cum[b],w=O.sentido>0?B:l.L-B,z=jt(l,O.sentido),V=zt(l,O.sentido);if((w-z)*O.sentido<1||(V-w)*O.sentido<8||(Rt(l.p,l.tab,w,T),Math.hypot(T.x-Z.x,T.z-Z.z)>s().raio))return null;let X=Ut(l.tipo,l.mao,O.sentido);if(!X.length)return null;let U=X[X.length-1],H=ut.get(Ht(l.e,U.u,O.sentido))??[],N=w*O.sentido,j=[];for(let rt of H)if(!(Math.abs(rt.pos-N)>=(p.c+rt.c.c)/2+xe+4)){if(rt.c.externo)return null;j.push(rt.c)}for(let rt of j){D(rt);let At=f.indexOf(rt);At>=0&&f.splice(At,1)}let Q=qt(l,U,w,5,{c:p.c,l:p.l,vMax:it(l.tipo).velocidade/3.6*.9,externo:{id:n,plano:a,k:b,alvoD:u,visto:vt,chegou:!1}});return Q.y=uo(Q,l,t.sim.espelho.terreno),f.push(Q),M.set(n,Q),Q}function Ft(n){let a=M.get(n);if(!a)return;M.delete(n),D(a);let u=f.indexOf(a);u>=0&&f.splice(u,1)}function yt(n,a,u=!1){for(let d of ot.get(n)??[]){if(d.saindoNo===n&&!d.curva){if(d.e===a)return!0;continue}let _=d.curva?d.curva.prox:d.reservaPx;if(_&&(_.ar.e===a||d.e===a))return!0}let p=t.dominio("vias")?.rede?.arestas.get(a);if(!p)return!1;for(let d of f)if(!(d.curva||d.e!==a)){if((d.sentido>0?p.b:p.a)===n){let _=(zt(p,d.sentido)-d.s)*d.sentido;if(_<he+d.c/2-.5||u&&_<30&&d.v>1.5)return!0}else if((d.s-jt(p,d.sentido))*d.sentido<5.3+d.c/2)return!0}return!1}let It={arr:null,o:0};function uo(n,a,u){let p=n.curva||!a?oe.pista+.03:Ie(it(a.tipo),n.u);return a?.ponte&&!n.curva?a.cotas[0]+(a.cotas[1]-a.cotas[0])*n.s/a.L+p-oe.pista:(u?Yt(u,n.x,n.z):0)+p}function Ua(n,a,u){let p=s(),d=t.camera.position,_=c.map(()=>0),b=a.terreno,O=(V,X)=>V*2+X,l=(V,X,U,H)=>{let N=O(V,X),j=c[N],Q=_[N];return Q>=j.cap?null:(_[N]++,j.cor.array[4*Q]=U[0],j.cor.array[4*Q+1]=U[1],j.cor.array[4*Q+2]=U[2],j.cor.array[4*Q+3]=H,It.arr=j.mesh.instanceMatrix.array,It.o=Q*16,It)},B=u>.25?1:0,w=p.lod0*p.lod0;for(let V of f){if(V.y=uo(V,n.rede.arestas.get(V.e),b),V.externo)continue;let X=(V.x-d.x)**2+(V.y-d.y)**2+(V.z-d.z)**2,U=l(V.mi,X<w?0:1,V.cor,B|(V.freio?2:0));U&&Ne(U.arr,U.o,V.x,V.y,V.z,V.hx,V.hz)}let z=0;if(p.estacionados>0)for(let V of n.setoresPerto(p.parados))for(let[X,U]of V.estacionados??[])for(let H=0;H<U.n&&z<p.estacionados;H++){let N=H*16,j=U.mat[N+12]-d.x,Q=U.mat[N+13]-d.y,rt=U.mat[N+14]-d.z,At=Math.sqrt(j*j+Q*Q+rt*rt);if(At>p.parados)continue;let Ae=to[U.bytes[4*H]]??to[0],St=l(X,At<p.lod0?0:1,Ae,0);St&&St.arr.set(U.mat.subarray(N,N+16),St.o),z++}return c.forEach((V,X)=>{let U=_[X];if(V.mesh.count=U,V.mesh.visible=U>0,!U)return;let H=V.mesh.instanceMatrix;H.clearUpdateRanges(),H.addUpdateRange(0,U*16),H.needsUpdate=!0,V.cor.clearUpdateRanges(),V.cor.addUpdateRange(0,U*4),V.cor.needsUpdate=!0}),t.stats.instancias.carros=f.length-M.size+z,z}function fo(n,a,u=0){for(let p=0;p<a&&f.length-M.size<n;p++){let d=se(u);d?(f.push(d),Ot(Ht(d.e,d.u,d.sentido),d,d.s*d.sentido)):et++}}function mo(n,a=0){let u=Math.min(n.carros,Math.round(h));fo(u,4,n.lod0);let p=f.length-M.size-(u+4),d=a>0&&h>n.carros,_=t.camera.position,b=n.lod0*n.lod0;for(let O=f.length-1;O>=0;O--){let l=f[O],B=(l.x-Z.x)**2+(l.z-Z.z)**2,w=B>(n.raio+80)**2;if(l.externo){(w||vt-l.externo.visto>90)&&Ft(l.externo.id);continue}let z=(l.x-_.x)**2+(l.z-_.z)**2>b,V=w||p>0&&z;if(!V&&d&&z&&!l.curva){let X=ao(Math.sqrt(B),n.raio);V=X<1&&Et(l.id,lt+7919)<a*(1-X)/20}V&&(w||p--,D(l),f.splice(O,1))}}let Fe=null,po=0,Pe={nome:"trafego",aplicar(n){(n.celulas?.length||n.tudo?.celulas||n.realocado?.includes("celulas"))&&($=!0)},quadro(n,a){let u=a.dominio("vias");if(!u?.rede)return;g!==a.perfil.id&&(g=a.perfil.id,m(),f.length=0,M.clear());let p=a.sim.espelho,d=s(),_=a.horaDoCeu(),b=a.sol?.dia??1,O=Math.min(1,Math.max(0,1-b*1.4));r.gCarroNoite.value=O;let l=p.tempo,B=Y??(l?.velocidade??1)>0,w=Fe===null?0:Math.min(100,n-Fe)/1e3*(B?Math.max(1,l?.mult??1):0);Fe=n,a.relogioRua=(a.relogioRua??0)+w,$&&n-(Pe._tZonas??-1e9)>5e3&&(W=ht(p),$=!1,Pe._tZonas=n),a.cameraApi?.alvo?.(Z),(J!==u.rede.versao||!R||Z.distanceTo(R)>60||n-S>2e3)&&(ct(u,_,p),J=u.rede.versao,S=n),mo(d,w),w>0&&C(u,w,a.relogioRua,a.dominio("pedestres")),po=Ua(u,p,O)},animar(n){Y=n},povoar(n=t){let a=n.dominio("vias");if(!a?.rede)return 0;n.cameraApi?.alvo?.(Z),$&&(W=ht(n.sim.espelho),$=!1),ct(a,n.horaDoCeu(),n.sim.espelho),J=a.rede.versao;let u=Math.min(s().carros,Math.round(h));return fo(u,u*4),f.length},avancar(n,a=t){let u=a.dominio("vias");if(u?.rede)for(let p=0;p<n;p+=.1)a.relogioRua=(a.relogioRua??0)+.1,mo(s(),.1),C(u,.1,a.relogioRua,a.dominio("pedestres")),a.dominio("pedestres")?.avancarUm?.(.1,a)},seguir:_t,soltarExterno:Ft,externo(n){return M.get(n)??null},chegou:n=>E.has(n),esquecer(n){E.delete(n)},cruzandoFaixa:yt,_carros:()=>f,medidas(){let n=0;for(let a of c)n+=a.mesh.count*a.tris;return{andando:f.length-M.size,caminhoes:M.size,parados:po,tris:n,alvo:Math.round(h),fluxo:!!t.sim?.espelho?.fluxos?.ida}},amostra(){return f.map(n=>({id:n.id,e:n.e,u:n.u,sentido:n.sentido,s:n.s,mi:n.mi,c:n.c,l:n.l,v:n.v,curva:!!n.curva,retorno:!!n.curva?.prox?.retorno,no:n.curva?.prox?.n??null,de:n.curva?n.e:null,para:n.curva?.prox?.ar.e??null,x:n.x,z:n.z,hx:n.hx,hz:n.hz,externo:n.externo?.id??null,k:n.externo?.k??null}))},descartar(){for(let n of c)e.remove(n.mesh),n.mesh.geometry.dispose(),n.mesh.dispose();i.dispose()}};return Pe}function pn(t){t.registrarDominio("trafego",dn)}var Mn={};He(Mn,{CORPOS:()=>co,FATOR_VELOCIDADE:()=>La,MODELO_CAMINHAO:()=>lo,PERFIL_CAMINHOES:()=>Na,criarMaterialCaminhao:()=>ja,distanciaDaViagem:()=>Ba,passosDoCaminho:()=>Fa,planoDaRota:()=>Pa,poseDaViagem:()=>Ha,registrar:()=>En});var Na=Object.freeze({ultra:{raio:3e3,lod0:160,max:64},alta:{raio:2400,lod0:120,max:48},media:{raio:1600,lod0:90,max:32},leve:{raio:900,lod0:60,max:16}}),co=Object.freeze(["basculante","carroceria","betoneira","bau"]),lo=Object.freeze({c:8.6,l:2.5}),La=.9,hn=[236,236,232];function Fa(t){return Array.from(t??[],e=>e<0?{e:~e,sentido:-1}:{e,sentido:1})}function Pa(t,e){let o=Fa(e);if(!o.length)return null;let r=[],i=[0],s=[0],c=null;for(let m of o){let g=t.arestas.get(m.e);if(!g)return null;let f=m.sentido>0?g.a:g.b;if(c!==null&&f!==c)return null;c=m.sentido>0?g.b:g.a,r.push(g),i.push(i[i.length-1]+g.L),s.push(s[s.length-1]+g.L/(it(g.tipo).velocidade/3.6*La))}return{passos:o,ars:r,cum:i,tempos:s,L:i[i.length-1],T:s[s.length-1],curvas:[],versao:t.versao}}function Ba(t,e,o){let r=Math.max(1,t.tFim-t.tIni),i;if(e.T<=r?i=o-(t.tIni+(r-e.T)/2):i=(o-t.tIni)/r*e.T,!(i>=0)||i>e.T)return null;let s=0;for(;s+1<e.passos.length&&e.tempos[s+1]<=i;)s++;let c=(i-e.tempos[s])/Math.max(1e-9,e.tempos[s+1]-e.tempos[s]);return e.cum[s]+Math.min(1,Math.max(0,c))*(e.cum[s+1]-e.cum[s])}var Sa=(t,e)=>e>0?t.cIni:t.cFim,Da=(t,e)=>e>0?t.L-t.cFim:t.L-t.cIni,io=(t,e)=>Ut(t.tipo,t.mao,e).at(-1)??null;function Ha(t,e,o={}){let r=0;for(;r+1<t.passos.length&&t.cum[r+1]<=e;)r++;let i=t.ars[r],{sentido:s}=t.passos[r],m=io(i,s)?.u??0,g=Math.max(0,Math.min(i.L,e-t.cum[r])),f=h=>{if(!t.curvas[h]){let A=t.ars[h],R=t.ars[h+1],S=t.passos[h].sentido,W=t.passos[h+1].sentido;t.curvas[h]=Le(A,io(A,S)?.u??0,S,R,io(R,W)?.u??0,W)}return t.curvas[h]};o.k=r,o.ar=i,o.u=m,o.curva=!1;let M=Sa(i,s),E=Da(i,s);if(g<M&&r>0){let h=t.ars[r-1],A=t.passos[r-1].sentido,R=t.cum[r-1]+Da(h,A),S=(e-R)/Math.max(.1,t.cum[r]+M-R);return Wt(f(r-1).p,Math.min(1,Math.max(0,S)),o),o.curva=!0,o}if(g>E&&r+1<t.passos.length){let h=t.cum[r]+E,A=(e-h)/Math.max(.1,t.cum[r+1]+Sa(t.ars[r+1],t.passos[r+1].sentido)-h);return Wt(f(r).p,Math.min(1,Math.max(0,A)),o),o.curva=!0,o}let v=Math.min(E,Math.max(M,g));return $t(i,m,s>0?v:i.L-v,s,o),o.s=s>0?v:i.L-v,o}function kt(t,e,o){if(!t.includes(e))throw new Error(`caminhão: shader sem '${e}'`);return t.replace(e,o)}function ja(t,e,o){let r=new te({color:16777215,roughness:.4,metalness:0});return r.name="caminhao",r.onBeforeCompile=i=>{Object.assign(i.uniforms,e);let s=i.vertexShader;s=kt(s,"#include <common>",`#include <common>
${o.CAMINHAO_VERTICE_PARS}`),s=kt(s,"#include <beginnormal_vertex>",o.CAMINHAO_VERTICE_NORMAL),s=kt(s,"#include <begin_vertex>",o.CAMINHAO_VERTICE_MAIN);let c=i.fragmentShader;c=kt(c,"#include <common>",`#include <common>
${o.CAMINHAO_FRAGMENTO_PARS}`),c=kt(c,"#include <color_fragment>",o.CAMINHAO_FRAGMENTO_COR),c=kt(c,"#include <roughnessmap_fragment>",o.CAMINHAO_FRAGMENTO_RUGOSIDADE),c=kt(c,"#include <metalnessmap_fragment>",o.CAMINHAO_FRAGMENTO_METAL),c=kt(c,"#include <emissivemap_fragment>",`#include <emissivemap_fragment>
${o.CAMINHAO_FRAGMENTO_EMISSIVO}`),i.vertexShader=s,i.fragmentShader=c},r.customProgramCacheKey=()=>"caminhao-2",t.aplicar(r,t.nomes().filter(i=>i!=="camada"))}function gn(t,e){return t.setAttribute("position",new st(e?e.posicao:new Float32Array(9),3)),t.setAttribute("normal",new st(e?e.normal:new Float32Array(9),3)),t.setAttribute("aParte2",new st(e?e.parte:new Float32Array(6),2)),t.setIndex(new st(e?e.indices:Uint16Array.of(0,1,2),1)),t.boundingSphere=new Qt(new Dt,1e7),t}var xn=t=>{let e=parseInt(String(t??"#c9a86a").replace("#",""),16);return Number.isFinite(e)?[e>>16&255,e>>8&255,e&255]:[201,168,106]};function An(t){let{cena:e,medidas:o}=t,r={gCamNoite:{value:0},gCamTempo:{value:0},gCamTambor:{value:new ie(1.95,1.85,2.55,-3.6)},gCamPiso:{value:1.28}},i=null,s=()=>ee(Na,t.perfil),c=null,m=[];function g(){for(let F of m)e.remove(F.mesh),F.mesh.geometry.dispose(),F.mesh.dispose();if(m.length=0,!c)return;let y=s().max;co.forEach((F,pt)=>{for(let lt of[0,1]){let vt=gn(new Pt,c.malhaCaminhao(F,lt)),ht=new le(new Uint8Array(y*4),4,!1),gt=new le(new Uint8Array(y*4),4,!1);ht.setUsage(Zt),gt.setUsage(Zt),vt.setAttribute("aCab",ht),vt.setAttribute("aCarga",gt);let ct=new be(vt,i,y);ct.instanceMatrix.setUsage(Zt),ct.frustumCulled=!1,ct.count=0,ct.visible=!1,ct.name=`caminhoes:${F}:${lt}`,o.familia(ct,"vida"),e.add(ct),m.push({ci:pt,lod:lt,mesh:ct,cab:ht,carga:gt,cap:y,tris:c.malhaCaminhao(F,lt).tris})}})}let f=t.perfil.id,M=()=>m.map(y=>y.mesh),E=import("./parte.20261017093216.RWUTC6TU.js").then(y=>{c=y,i=ja(t.ganchos,r,y),r.gCamTambor.value.set(y.TAMBOR.y0,y.TAMBOR.z0,y.TAMBOR.y1,y.TAMBOR.z1),r.gCamPiso.value=y.CAMINHAO.piso,f=t.perfil.id,g();let F=t.quadro?.aquecer;return F?.pronto&&(F.delete?.(M),F.add?.(M)),y}),v=!1;E.catch(y=>{v=!0,console.error("caminhoes: o modelo dos caminhões não carregou",y)});let h=new Map,A=new Map,R=new Map,S=null,W=0,$=null,J=[],et=0,Y=0,Z=0,T={x:0,z:0,hx:1,hz:0};function ut(y,F){let pt=h.get(F.id);if(pt&&pt.caminho===F.caminho&&pt.pl?.versao===y.versao)return pt.pl;let lt=Pa(y,F.caminho);return h.set(F.id,{pl:lt,caminho:F.caminho}),lt}return{nome:"caminhoes",quadro(y,F){let pt=F.dominio("vias");if(!pt?.rede||!c)return;f!==F.perfil.id&&(f=F.perfil.id,g());let lt=F.sim.espelho,vt=lt.terreno,ht=s(),gt=F.dominio("trafego"),ct=lt.tempo,Ot=$??(ct?.velocidade??1)>0,Gt=S===null?0:Math.min(100,y-S)/1e3*(Ot?Math.max(1,ct?.mult??1):0);S=y,W+=Gt,$===!0&&!((ct?.velocidade??0)>0)&&(et+=Gt),r.gCamTempo.value=W,r.gCamNoite.value=Math.min(1,Math.max(0,1-(F.sol?.dia??1)*1.4));let qt=(ct?.tique??0)+(ct?.frac??0)+et,se=xn(lt.holding?.cor),Ct=F.camera.position,wt=m.map(()=>0),Nt=new Set;Y=0,Z=0;let Lt=(q,xt,tt,nt,x,I,G,D)=>{let k=Math.hypot(tt-Ct.x,nt-Ct.y,x-Ct.z);if(k>ht.raio)return;let K=c.cargaDe(xt.item),at=co.indexOf(K.corpo)*2+(k<ht.lod0?0:1),C=m[at],P=wt[at];if(P>=C.cap)return;wt[at]++,Y++,Ne(C.mesh.instanceMatrix.array,P*16,tt,nt,x,I,G);let mt=xt.visual?hn:se,_t=(r.gCamNoite.value>.25?1:0)|(D?2:0);C.cab.array.set([mt[0],mt[1],mt[2],_t+4*(q%64)],4*P),C.carga.array.set([K.cor[0],K.cor[1],K.cor[2],Math.max(0,Math.min(10,Math.round(xt.n??10)))],4*P)};for(let q of J.length?[...lt.entregas??[],...J]:lt.entregas??[]){if(!q?.caminho?.length)continue;Nt.add(q.id);let xt={item:q.item,n:q.n,visual:!!q.visual};if(A.set(q.id,xt),gt?.chegou?.(q.id))continue;let tt=ut(pt.rede,q);if(!tt)continue;let nt=Ba(q,tt,qt),x=gt?.externo?.(q.id)??null;if(nt===null&&!x)continue;if(x=gt?.seguir?.(q.id,tt,nt??tt.L,lo)??x,x){Z++,R.set(q.id,{agente:!0,k:x.externo?.k??0,x:x.x,z:x.z,e:x.e,curva:!!x.curva,d:nt}),Lt(q.id,xt,x.x,x.y,x.z,x.hx,x.hz,x.freio);continue}Ha(tt,nt,T);let I=it(T.ar.tipo),G=T.curva?oe.pista+.03:Ie(I,T.u),D=T.ar.ponte&&!T.curva?T.ar.cotas[0]+(T.ar.cotas[1]-T.ar.cotas[0])*T.s/T.ar.L+G-oe.pista:(vt?Yt(vt,T.x,T.z):0)+G;R.set(q.id,{agente:!1,k:T.k,x:T.x,z:T.z,e:T.ar.e,curva:T.curva,d:nt}),Lt(q.id,xt,T.x,D,T.z,T.hx,T.hz,!1)}for(let[q,xt]of A){if(Nt.has(q))continue;let tt=gt?.externo?.(q),nt=h.get(q)?.pl;if(!tt||!nt){A.delete(q),h.delete(q),R.delete(q),gt?.esquecer?.(q);continue}gt.seguir(q,nt,nt.L,lo),Z++,Lt(q,xt,tt.x,tt.y,tt.z,tt.hx,tt.hz,tt.freio)}m.forEach((q,xt)=>{let tt=wt[xt];if(q.mesh.count=tt,q.mesh.visible=tt>0,!tt)return;let nt=q.mesh.instanceMatrix;nt.clearUpdateRanges(),nt.addUpdateRange(0,tt*16),nt.needsUpdate=!0;for(let x of[q.cab,q.carga])x.clearUpdateRanges(),x.addUpdateRange(0,tt*4),x.needsUpdate=!0})},animar(y){$=y},preparar:()=>E,pronto:()=>!!c||v,amostras(y){J=y??[]},agora(y=t){let F=y.sim.espelho.tempo;return(F?.tique??0)+(F?.frac??0)+et},estado:y=>R.get(y)??null,medidas(){let y=0;for(let F of m)y+=F.mesh.count*F.tris;return{entregas:A.size,naRua:Z,desenhados:Y,tris:y}},descartar(){t.quadro?.aquecer?.delete?.(M);for(let y of m)e.remove(y.mesh),y.mesh.geometry.dispose(),y.mesh.dispose();i?.dispose()}}}function En(t){t.registrarDominio("caminhoes",An)}export{_n as a,In as b,Vn as c,On as d,Tn as e,zn as f,Cn as g,Ce as h,sn as i,Oa as j,Ta as k,Wt as l,Ne as m,ya as n,vn as o,Pa as p,Ba as q,Ha as r,Mn as s};
