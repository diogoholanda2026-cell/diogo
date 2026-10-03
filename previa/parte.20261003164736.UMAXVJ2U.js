import{A as Oe,B as pe,D as Pt,F as za,H as Bt,I as Ht,J as ya,K as wa,L as Na,M as Le,N as Sa,R as La,e as Ge,f as Ia,g as Va,s as Ta,t as Qe,u as xt,v as Ca,w as ae,x as At,y as st,z as be}from"./parte.20261003164736.OT2RXIL7.js";import{b as rt,c as Oa}from"./parte.20261003164736.MWSPTRF4.js";import{c as da,d as va}from"./parte.20261003164736.VS23AGX7.js";import{b as Ye}from"./parte.20261003164736.GN3A4QGR.js";import{e as ia,h as fa,i as ua,j as ma}from"./parte.20261003164736.MNQ3OTON.js";import{b as Lt,d as ca,e as la,h as Ft}from"./parte.20261003164736.6GPFD4P6.js";import{f as ra,i as sa}from"./parte.20261003164736.ZXYSI6BH.js";import{b as ht}from"./parte.20261003164736.QCJW35RX.js";import{B as ga,Da as Xe,Ea as Ke,Ha as Ea,Ia as _a,Ja as nt,Ka as gt,La as ba,Za as We,ca as Ue,ea as xa,ga as Ne,ka as ot,o as pa,pa as Aa,sa as Ma,t as ha,ua as Ra,wa as Dt,ya as te}from"./parte.20261003164736.A62NGGRH.js";import{a as St}from"./parte.20261003164736.WK3CS2OT.js";var Jo={};St(Jo,{ALVO_USO_CHAO:()=>Gt,BIT_REALCE:()=>jt,LADO_TAB:()=>Ae,PERFIL_VIAS:()=>ao,Rede:()=>_t,TRECHO:()=>oo,arestaDaSelecao:()=>Rt,criarMaterialVia:()=>ro,criarUniformesVia:()=>no,desgasteDe:()=>io,geometriaDaMalha:()=>so,ligarChaoNoShader:()=>co,pedidoDeSetor:()=>fo,realcarAresta:()=>Ut,registrar:()=>Zo,retalho:()=>lo});var oe=e=>Number.isInteger(e)?`${e}.0`:`${e}`,it=8,ct=6;function Ho(){let e=[],t=[],o=[],i=[],c=[];for(let f of st){for(let h=0;h<it;h++){let x=f.linhas[h];e.push(x?`vec4( ${oe(+x.u.toFixed(4))}, ${oe(x.largura)}, ${oe(x.cor)}, ${oe(x.estilo)} )`:"vec4( 0.0, 0.0, 0.0, -1.0 )")}t.push(`vec2( ${oe(f.tracejado[0])}, ${oe(f.tracejado[1])} )`);for(let h=0;h<ct;h++)o.push(f.faixas[h]?oe(+f.faixas[h].meio.toFixed(4)):"999.0");let v=h=>{let x=f.faixas.filter(b=>b.sentido===h);return x.length?[Math.min(...x.map(b=>b.u0)),Math.max(...x.map(b=>b.u1))]:[0,0]},[g,d]=v(-1),[E,O]=v(1);i.push(`vec4( ${oe(g)}, ${oe(d)}, ${oe(E)}, ${oe(O)} )`),c.push(f.meioFio?"1.0":"0.0")}let r=st.length;return`
const vec4 VIA_LINHAS[ ${r*it} ]=vec4[ ${r*it} ](${e.join(", ")});
const vec2 VIA_TRACO[ ${r} ]=vec2[ ${r} ](${t.join(", ")});
const float VIA_FAIXAS[ ${r*ct} ]=float[ ${r*ct} ](${o.join(", ")});
const vec4 VIA_RET[ ${r} ]=vec4[ ${r} ](${i.join(", ")});
const float VIA_SARJETA[ ${r} ]=float[ ${r} ](${c.join(", ")});
`}var jo=[...Object.entries(Ta).map(([e,t])=>`#define VM_${e} ${oe(t)}`),...Object.entries(be).map(([e,t])=>`#define VB_${e} ${t}`),`#define VE_CONTINUA ${oe(xt.CONTINUA)}`,`#define VE_TRACEJADA ${oe(xt.TRACEJADA)}`,`#define VE_ESTACIONAMENTO ${oe(xt.ESTACIONAMENTO)}`,`#define VC_AMARELA ${oe(Ca.AMARELA)}`,`#define VIA_TERRA ${oe(st.findIndex(e=>e.terra))}`,`#define VIA_RODOVIA ${oe(st.findIndex(e=>e.barreira))}`].join(`
`),Fa=`
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
`,Da=`
vec3 objectNormal=viaOct(normal.xy);
#ifdef USE_TANGENT
vec3 objectTangent=vec3(tangent.xyz);
#endif
`,Pa=`
{
vec4 gT=texelFetch(gViaTab,ivec2(int(aId % 256u),int(aId / 256u)),0);
vUV=aUV;
vDados=vec4(aDados.xyz,gT.b);
vIdent=vec4(float(aId),floor(gT.g * 255.0 + 0.5),floor(gT.r * 255.0 + 0.5),0.0);
vAO=aDados.w / 255.0;
}
`,Ba=`
{
float gVd=length(mvPosition.xyz);
mvPosition.xyz *=1.0 - min(0.02,gViaLonge.z + gViaLonge.w * gVd);
gl_Position=projectionMatrix * mvPosition;
}
`,Ha=`
#define VIA
${jo}
${Ho()}
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
for(int k=0;k < ${it};k ++){
vec4 L=VIA_LINHAS[ tipo * ${it} + k ];
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
for(int k=0;k < ${ct};k ++){
float c=VIA_FAIXAS[ tipo * ${ct} + k ];
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
`,ja=`
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
`,Ua=`
float roughnessFactor=gViaRug;
`,Ga=`
if((int(vIdent.y + 0.5)& 1)!=0)totalEmissiveRadiance +=vec3(0.25,0.2,0.08)* 0.6;
`,$a=`
#include <aomap_fragment>
reflectedLight.indirectDiffuse *=vAO;
reflectedLight.directDiffuse *=mix(1.0,vAO,0.35);
`,ka=`
#include <dithering_fragment>
if(gViaMascara > 0.5)gl_FragColor=vec4(vec3(gViaGrama),1.0);
`,qa=`
attribute float aParte;
attribute vec4 aCarro;
flat varying vec4 vCarro;
flat varying float vParte;
varying vec2 vCarroLocal;
`,Za=`
vCarro=aCarro;
vParte=aParte;
vCarroLocal=position.xy;
`,Ja=`
flat varying vec4 vCarro;
flat varying float vParte;
varying vec2 vCarroLocal;
uniform float gCarroNoite;
float gCarroRug=0.35;
float gCarroMetal=0.0;
vec3 carroLinear(vec3 s){return pow(s / 255.0,vec3(2.2));}
`,Xa=`
{
int p=int(vParte + 0.5);
vec3 c;
if(p==0){c=min(carroLinear(vCarro.rgb),vec3(0.78));gCarroRug=0.32;}
else if(p==1){c=vec3(0.02,0.025,0.03);gCarroRug=0.06;}
else if(p==2){c=vec3(0.025);gCarroRug=0.85;}
else if(p==3){c=vec3(0.55,0.55,0.52);gCarroRug=0.15;}
else if(p==4){c=vec3(0.25,0.01,0.01);gCarroRug=0.2;}
else if(p==5){c=vec3(0.62,0.62,0.6);gCarroRug=0.45;}
else if(p==6){c=vec3(0.32,0.32,0.33);gCarroRug=0.3;gCarroMetal=0.8;}
else if(p==8 || p==9){c=min(carroLinear(vCarro.rgb),vec3(0.78));gCarroRug=0.32;}
else{c=vec3(0.0);gCarroRug=1.0;}
diffuseColor.rgb=c;
}
`,Ka=`
float roughnessFactor=gCarroRug;
`,Wa=`
float metalnessFactor=gCarroMetal;
`,Ya=`
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
`,un=`
attribute float aParte;
attribute vec4 aObj;
flat varying float vParte;
flat varying vec4 vObj;
`,mn=`
vParte=aParte;
vObj=aObj;
`,dn=`
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
`,vn=`
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
`,pn=`
float roughnessFactor=gObjRug;
`,hn=`
float metalnessFactor=gObjMetal;
`,gn=`
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
`;var ao=Object.freeze({ultra:{alcance:1400,faixa:260,cache:96,envios:3,vagas:.6},alta:{alcance:900,faixa:200,cache:64,envios:2,vagas:.55},media:{alcance:560,faixa:140,cache:40,envios:1,vagas:.5},leve:{alcance:300,faixa:90,cache:20,envios:1,vagas:0}}),oo=160,Ae=256,Et=Object.freeze({k1:3e-4,k2:15e-7}),Go=new Set(["rua","ruaMao","avenida","avenidaG"]);function Te(e,t,o){if(!e.includes(t))throw new Error(`via: shader sem '${t}' (o three mudou?)`);return e.replace(t,o)}function no(){return{gViaTab:{value:null},gViaDetalhe:{value:null},gViaLonge:{value:new ot(300,420,Et.k1,Et.k2)},gViaCamada:{value:new ot(0,0,0,0)},gViaRampa:{value:Array.from({length:8},()=>new Ra)},gViaMascara:{value:0}}}function ro(e,t){let o=new We({color:16777215,roughness:.85,metalness:0});return o.name="via",o.onBeforeCompile=i=>{Object.assign(i.uniforms,t);let c=i.vertexShader;c=Te(c,"#include <common>",`#include <common>
${Fa}`),c=Te(c,"#include <beginnormal_vertex>",Da),c=Te(c,"#include <begin_vertex>",`#include <begin_vertex>
${Pa}`),c=Te(c,"#include <project_vertex>",`#include <project_vertex>
${Ba}`);let r=i.fragmentShader;r=Te(r,"#include <common>",`#include <common>
${Ha}`),r=Te(r,"#include <color_fragment>",ja),r=Te(r,"#include <roughnessmap_fragment>",Ua),r=Te(r,"#include <emissivemap_fragment>",`#include <emissivemap_fragment>
${Ga}`),r=Te(r,"#include <aomap_fragment>",$a),r=Te(r,"#include <dithering_fragment>",ka),i.vertexShader=c,i.fragmentShader=r},o.customProgramCacheKey=()=>"via-1",o.userData.via=!0,e.aplicar(o,e.nomes().filter(i=>i!=="camada"))}function $o(){this.array={byteLength:this.array.byteLength,length:this.array.length}}function so(e,{soltar:t=!1}={}){let o=new Ke,i=(f,v,g)=>{let d=new te(f,v,g);return t&&d.onUpload($o),d};if(e.atributos){let f=e.atributos;return o.setAttribute("position",i(f.posicao,3,!0)),o.setAttribute("normal",i(f.normal,2,!0)),o.setAttribute("aUV",i(f.uv,4,!1)),o.setAttribute("aDados",i(f.dados,4,!1)),o.setAttribute("aId",i(f.id,1,!1)),o.setIndex(i(e.indices,1,!1)),o.boundingSphere=new Xe(new Ne,Math.sqrt(3)*1.01),o.boundingBox=new Dt(new Ne(-1.01,-1.01,-1.01),new Ne(1.01,1.01,1.01)),o}let c=e.nv,r=new Int8Array(c*2);for(let f=0;f<c;f++){let v=e.nor[3*f],g=e.nor[3*f+1],d=e.nor[3*f+2],E=Math.abs(v)+Math.abs(g)+Math.abs(d)||1,O=v/E,h=d/E;if(g<0){let x=(1-Math.abs(h))*(O>=0?1:-1),b=(1-Math.abs(O))*(h>=0?1:-1);O=x,h=b}r[2*f]=Math.round(O*127),r[2*f+1]=Math.round(h*127)}return o.setAttribute("position",new te(e.pos.slice(0,c*3),3)),o.setAttribute("normal",new te(r,2,!0)),o.setAttribute("aUV",new te(e.uv.slice(0,c*4),4)),o.setAttribute("aDados",new te(e.dados.slice(0,c*4),4)),o.setAttribute("aId",new te(e.id.slice(0,c),1)),o.setIndex(new te(e.idx.slice(0,e.ni),1)),o.computeBoundingSphere(),o}var jt=1;function Ut(e,t,o){let i=e.length/4;return t>=0&&t<i&&(e[4*t+1]&=~jt),o>=0&&o<i&&(e[4*o+1]|=jt),o>=0&&o<i?o:-1}function Rt(e,t){if(!e||e.tipo!=="aresta"||!Number.isFinite(e.ref)||!t)return-1;let o=ua(e.ref);return o<t.n&&t.viva[o]&&t.ger[o]===ma(e.ref)?o:-1}function io(e,t,o){if(!e)return .45+.4*pe(o,97);let i=Math.max(0,t-e)/7200;return Math.min(1,.08+.3*i)}function ko(e,t,o,i){if(i&Lt.ARCOLOGIA)return!0;for(let r of e.areas??[])if(r.id==="orla"&&r.contorno&&ia(t,o,r.contorno))return!0;let c=e.terreno;if(!c?.agua)return!1;for(let r=0;r<12;r++){let f=r*Math.PI/6;for(let v of[120,250]){let g=t+Math.cos(f)*v,d=o+Math.sin(f)*v,E=Math.round((g-c.origem[0])/c.passo),O=Math.round((d-c.origem[1])/c.passo);if(E>=0&&O>=0&&E<c.n&&O<c.n&&c.agua[O*c.n+E]===la.MAR)return!0}}return!1}var _t=class{constructor(t){this.grade=t,this.arestas=new Map,this.nos=new Map,this.versao=0}bracos(t,o){let i=t.vias.nos,c=[];for(let r=0;r<6;r++){let f=i.lig[6*o+r];if(f<0)continue;let v=this.arestas.get(f);v&&c.push({e:f,tipo:v.tipo,p:v.p,tab:v.tab,inverte:v.b===o&&v.a!==o,marcas:v.pedra?be.PEDRA:0,ponte:v.ponte,cotas:v.cotas})}return c}lerAresta(t,o){let i=t.vias.arestas,c=this.arestas.get(o),r=new Set(c?c.trechos.map(O=>O[2]):[]);if(o>=i.n||!i.viva[o])return this.arestas.delete(o),{sujos:r,nos:c?[c.a,c.b]:[]};let f=Float64Array.from(i.p.subarray(8*o,8*o+8)),v=ra(f),g=i.flags[o],d=Oe(f,v,v[16]/2),E={e:o,tipo:i.tipo[o],p:f,tab:v,L:v[16],a:i.a[o],b:i.b[o],mao:i.mao[o],flags:g,idade:i.idade[o],ger:i.ger[o],ponte:!!(g&Lt.PONTE),cotas:[i.y[2*o],i.y[2*o+1]],pedra:c&&c.p.every((O,h)=>O===f[h])?c.pedra:ko(t,d.x,d.z,g),cIni:0,cFim:0,marcas:0,trechos:[]};return this.arestas.set(o,E),{sujos:r,nos:[E.a,E.b,...c?[c.a,c.b]:[]]}}lerNo(t,o){let i=t.vias.nos,c=this.nos.get(o),r=new Set(c?[c.setor]:[]);if(o>=i.n||!i.viva[o])return this.nos.delete(o),{sujos:r,arestas:[]};let f=this.bracos(t,o),v=i.x[o],g=i.z[o],d=this.grade.indice(v,g);if(r.add(d),!f.length)return this.nos.delete(o),{sujos:r,arestas:[]};let E=za({n:o,x:v,z:g,bracos:f}),O=E.tipo==="cruzamento"&&E.bracos.length>=3,h=O&&E.bracos.some(x=>x.P.id==="avenida"||x.P.id==="avenidaG")&&!E.bracos.some(x=>x.P.id==="rodovia");return this.nos.set(o,{n:o,x:v,z:g,tipo:E.tipo,setor:d,analise:E,zebra:O,semaforos:h}),{sujos:r,arestas:E.bracos.map(x=>x.e)}}fecharAresta(t){let o=this.arestas.get(t);if(!o)return[];let i=(h,x)=>this.nos.get(h)?.analise.bracos.find(b=>b.e===t&&b.inverte===x)?.corte??0;o.cIni=i(o.a,!1),o.cFim=i(o.b,!0);let c=ae(o.tipo),r=o.pedra?be.PEDRA:0,f=this.nos.get(o.a),v=this.nos.get(o.b);if(Go.has(c.id)){let h=o.mao===0?-1:-o.mao,x=o.mao===0?1:o.mao,b=(q,J)=>q<0?J?be.RET_INI_A:be.RET_FIM_A:J?be.RET_INI_B:be.RET_FIM_B;f?.zebra&&(r|=be.ZEBRA_INI|(o.mao===Ft.AB?0:b(h,!0))),v?.zebra&&(r|=be.ZEBRA_FIM|(o.mao===Ft.BA?0:b(x,!1)))}o.marcas=r,o.tampaIni=f?.tipo==="cruzamento",o.tampaFim=v?.tipo==="cruzamento";let g=o.cIni,d=o.L-o.cFim,E=Math.max(1,Math.ceil((d-g)/oo));o.trechos=[];let O={x:0,z:0,tx:1,tz:0,t:0};for(let h=0;h<E;h++){let x=g+(d-g)*h/E,b=g+(d-g)*(h+1)/E;Oe(o.p,o.tab,(x+b)/2,O),o.trechos.push([x,b,this.grade.indice(O.x,O.z)])}return o.trechos.map(h=>h[2])}tudo(t){let o=t.vias?.arestas,i=t.vias?.nos,c=new Set([...this.arestas.values()].flatMap(r=>r.trechos.map(f=>f[2])));for(let r of this.nos.values())c.add(r.setor);if(this.arestas.clear(),this.nos.clear(),!o||!i)return c;for(let r=0;r<o.n;r++)o.viva[r]&&this.lerAresta(t,r);for(let r=0;r<i.n;r++)i.viva[r]&&this.lerNo(t,r);for(let r of this.arestas.keys())for(let f of this.fecharAresta(r))c.add(f);for(let r of this.nos.values())c.add(r.setor);return this.versao++,c}tocar(t,o,i){let c=new Set,r=new Set(i);for(let v of o){let g=this.lerAresta(t,v);for(let d of g.sujos)c.add(d);for(let d of g.nos)r.add(d)}let f=new Set;for(let v of r){let g=this.lerNo(t,v);for(let d of g.sujos)c.add(d);for(let d of g.arestas)f.add(d)}for(let v of o)f.add(v);for(let v of f){let g=this.arestas.get(v);if(g){for(let d of g.trechos)c.add(d[2]);for(let d of this.fecharAresta(v))c.add(d)}}return this.versao++,c}},Gt=/vec4\s+tUso\s*=\s*texture\s*\(\s*uTerUso\s*,\s*tUVM\s*\)\s*;/;function co(e){return!Gt.test(e)||!e.includes("#include <common>")?null:e.replace("#include <common>",`#include <common>
uniform vec2 uViaPerto;`).replace(Gt,t=>`${t}
tUso.r *= smoothstep( uViaPerto.x, uViaPerto.y, vTer.z );`)}function eo(e){let t=e.chao?.malha?.material;if(!t||t.userData.viaLigada)return t?.userData.viaUniformes??null;let o={uViaPerto:{value:new xa(0,1)}},i=t.onBeforeCompile;t.onBeforeCompile=(r,f)=>{i?.call(t,r,f);let v=co(r.fragmentShader);if(!v){console.warn("vias: o chão não tem o uso do solo esperado; a pintura da via fica perto da câmera");return}Object.assign(r.uniforms,o),r.fragmentShader=v};let c=t.customProgramCacheKey?.bind(t);return t.customProgramCacheKey=()=>`${c?c():""}|viaPerto`,t.userData.viaLigada=!0,t.userData.viaUniformes=o,t.needsUpdate=!0,o}var lt={x:0,z:0,tx:1,tz:0,t:0},Mt=()=>typeof performance<"u"?performance.now():Date.now();function lo(e,t,o,i,c){let r=Math.max(0,Math.floor((t-e.origem[0])/e.passo)),f=Math.max(0,Math.floor((o-e.origem[1])/e.passo)),v=Math.min(e.n-1,Math.ceil((i-e.origem[0])/e.passo)),g=Math.min(e.n-1,Math.ceil((c-e.origem[1])/e.passo)),d=Math.max(2,Math.max(v-r,g-f)+1),E=new Float32Array(d*d);for(let O=0;O<d;O++){let h=Math.min(e.n-1,f+O);for(let x=0;x<d;x++)E[O*d+x]=e.altura[h*e.n+Math.min(e.n-1,r+x)]}return{ox:e.origem[0]+r*e.passo,oz:e.origem[1]+f*e.passo,n:d,passo:e.passo,altura:E}}function fo(e,t,o,i=0){let c=[],r=t.x0,f=t.z0,v=t.x0+Ge,g=t.z0+Ge;for(let h of e.arestas.values())for(let[x,b,q]of h.trechos){if(q!==t.s)continue;c.push({e:h.e,tipo:h.tipo,p:Array.from(h.p),sIni:h.cIni,sFim:h.L-h.cFim,s0:x,s1:b,marcas:h.marcas,ponte:h.ponte,cotas:h.cotas,tampaIni:h.tampaIni,tampaFim:h.tampaFim,mao:h.mao});let J=ae(h.tipo).meia+4,Y=Math.max(2,Math.ceil((b-x)/8)+1);for(let ne=0;ne<Y;ne++)Oe(h.p,h.tab,x+(b-x)*ne/(Y-1),lt),r=Math.min(r,lt.x-J),v=Math.max(v,lt.x+J),f=Math.min(f,lt.z-J),g=Math.max(g,lt.z+J)}let d=[];for(let h of e.nos.values()){if(h.setor!==t.s||h.tipo==="reto")continue;d.push({n:h.n,x:h.x,z:h.z,semaforos:h.semaforos,bracos:h.analise.bracos.map(b=>({e:b.e,tipo:b.tipo,p:Array.from(b.p),inverte:b.inverte,marcas:b.marcas,ponte:b.ponte,cotas:b.cotas}))});let x=Math.max(60,...h.analise.bracos.map(b=>b.corte+b.P.meia+4));r=Math.min(r,h.x-x),v=Math.max(v,h.x+x),f=Math.min(f,h.z-x),g=Math.max(g,h.z+x)}let E=o.terreno,O=E?lo(E,r-16,f-16,v+16,g+16):null;return{dados:{setor:t.s,versao:t.versao,ox:t.x0,oz:t.z0,chao:O,arestas:c,nos:d,vagas:i},transferir:O?[O.altura.buffer]:[]}}function qo(e){let{cena:t,medidas:o}=e,i=e.sim.espelho,c=new Ia({tam:i.mapa?.tam??8192,origem:i.mapa?.origem??[-4096,-4096]}),r=La(e),f=new _t(c),v=no();v.gViaDetalhe.value=e.textura("via.detalhe");let g=new Uint8Array(Ae*Ae*4),d=new _a(g,Ae,Ae,ga,ha);d.magFilter=d.minFilter=pa,d.generateMipmaps=!1,d.name="vias:tabela",v.gViaTab.value=d;let E=typeof location<"u"&&new URLSearchParams(location.search).get("passe")==="mascara";v.gViaMascara.value=E?1:0;let O=ro(e.ganchos,v),h=eo(e),x=new Map,b=[],q=-1,J=null,Y=0,ne=!1,Ie=0,fe=0,he=0,Q=0,P=0,ge=0,xe=null,L=new ba,G=new Aa,re=new Dt,X=()=>Ye(ao,e.perfil),ue=p=>{let A=x.get(p);if(!A){let[V,S]=c.canto(p);A={s:p,x0:V,z0:S,versao:1,pedido:0,malha:null,objetos:null,estacionados:null,usado:0,dist:1/0,ymin:-5,ymax:60,caixa:null},x.set(p,A)}return A},Me=p=>{for(let A of p)A>=0&&ue(A).versao++};function ce(p,A){if(A>=Ae*Ae)return;let V=f.arestas.get(A),S=4*A;g[S+2]=V?Math.round(io(V.idade,p.tempo?.tique??0,A)*255):0,d.needsUpdate=!0}function W(p,A){let V=A.vias?.arestas;if(!V||!A.vias?.nos)return;q>=0&&Rt(J,V)!==q&&(q=Ut(g,q,Rt(J,V)),d.needsUpdate=!0);let S=!ne||rt(p,"vias")||rt(p,"arestas")||rt(p,"nos");if(ne=!0,S){Me(f.tudo(A));for(let w=0;w<Math.min(V.cap,Ae*Ae);w++)ce(A,w)}else if(p.arestas?.length||p.nos?.length){Me(f.tocar(A,p.arestas??[],p.nos??[]));for(let w of p.arestas??[])ce(A,w)}let H=A.tempo?(A.tempo.ano??0)*12+(A.tempo.mes??0):null;if(H!==xe){if(xe!==null&&!S)for(let w of f.arestas.keys())ce(A,w);xe=H}let $=rt(p,"terreno")?[[-1e9,-1e9,1e9,1e9]]:p.terreno??[];if($.length&&!S)for(let w of x.values()){let se=w.x0+Ge,z=w.z0+Ge;$.some(y=>y[0]<=se+100&&y[2]>=w.x0-100&&y[1]<=z+100&&y[3]>=w.z0-100)&&w.versao++}}let ze=p=>fo(f,p,e.sim.espelho,X().vagas);function Ze(p){let A=p.versao;p.pedido=A,Y++;let{dados:V,transferir:S}=ze(p);if(!V.arestas.length&&!V.nos.length){Y--,b.push({st:p,r:{malhas:[],objetos:null,estacionados:[]},versao:A});return}let H=Mt();r.pedir("vias",V,{chave:p.s,transferir:S}).then($=>{Y--,P+=Mt()-H,ge++,b.push({st:p,r:$,versao:A})})}function Se(p){p.malha&&(t.remove(p.malha.mesh),p.malha.mesh.geometry.dispose(),fe-=p.malha.bytes,he--,p.malha=null)}function at(p){let A=0;for(let V=0;V<b.length;){let{st:S,r:H,versao:$}=b[V];if(H.erro){S.erro=$,b.splice(V,1);continue}if(A>=p)break;if(b.splice(V,1),S.malha&&S.malha.versao>$)continue;Se(S);let w=H.malhas?.[0];if(S.objetos=H.objetos??null,S.estacionados=H.estacionados??[],Q++,!w){S.malha={mesh:new Ma,versao:$,bytes:0,tris:0},he++;continue}let se=so(w,{soltar:!0}),z=new Ea(se,O),[y,ee,me,Re]=w.escala;z.position.set(S.x0+y,ee,S.z0+me),z.scale.setScalar(Re),z.matrixAutoUpdate=!1,z.updateMatrix(),z.name=`vias:${S.s}`,z.receiveShadow=!0,o.familia(z,"vias"),t.add(z);let Ee=w.indices.byteLength;for(let _e of Object.values(w.atributos))Ee+=_e.byteLength;S.malha={mesh:z,versao:$,bytes:Ee,tris:w.tris},S.ymin=S.y0=w.caixa[1],S.ymax=w.caixa[4],S.caixa=[S.x0+w.caixa[0],w.caixa[1],S.z0+w.caixa[2],S.x0+w.caixa[3],w.caixa[4],S.z0+w.caixa[5]],fe+=Ee,he++,A++}}function ye({envios:p=X().envios,pedidos:A=r.worker?3:1}={}){Ie++,at(p);let V=X(),S=e.camera;S.updateMatrixWorld(),G.multiplyMatrices(S.projectionMatrix,S.matrixWorldInverse),L.setFromProjectionMatrix(G);let H=S.position,$=[],w=0,se=0;for(let z of x.values()){let y=z.caixa??[z.x0,z.ymin,z.z0,z.x0+Ge,z.ymax,z.z0+Ge];z.dist=Va(H.x,H.y,H.z,y[0],y[1],y[2],y[3],y[4],y[5]);let ee=z.dist<V.alcance;if(ee&&z.pedido!==z.versao&&z.erro!==z.versao&&(!z.malha||z.malha.versao<z.versao)&&$.push(z),z.malha){re.min.set(y[0],y[1]-1,y[2]),re.max.set(y[3],y[4]+1,y[5]);let me=ee&&L.intersectsBox(re);z.malha.mesh.visible=me,ee&&(z.usado=Ie),me&&(w++,se+=z.malha.tris)}}$.sort((z,y)=>z.dist-y.dist);for(let z of $){if(Y>=A)break;Ze(z)}if(he>V.cache){let z=[...x.values()].filter(y=>y.malha&&y.dist>=V.alcance).sort((y,ee)=>y.usado-ee.usado);for(let y of z){if(he<=V.cache)break;Se(y),y.objetos=null,y.estacionados=null,y.pedido=0,Q++}}return{vis:w,tris:se}}function Ve(){let p=X(),A=p.alcance-p.faixa;v.gViaLonge.value.set(A-160,A,Et.k1,Et.k2),h&&h.uViaPerto.value.set(A-120,A-40)}let Je=[e.ouvir("qualidade",()=>{h=eo(e)}),e.ouvir("selecao",p=>{J=p??null,q=Ut(g,q,Rt(J,e.sim.espelho.vias?.arestas)),d.needsUpdate=!0}),e.ouvir("camadas",p=>{let A=e.sim.espelho.vias?.arestas,V=!!(p&&p.fonte==="arestas"&&p.dados&&A),S=A?Math.min(A.n,Ae*Ae):0;for(let H=0;H<Ae*Ae;H++){let $=0;if(V&&H<S){let w=p.dados[H];Number.isFinite(w)&&($=p.categorico?Math.max(0,Math.min(7,Math.round(w))):1+Math.round(Math.min(1,Math.max(0,(w-(p.min??0))/((p.max??1)-(p.min??0)||1)))*254))}g[4*H]=$}d.needsUpdate=!0,v.gViaCamada.value.set(p?1:0,Math.min(8,p?.cores?.length??0),p?.categorico?1:0,0),(p?.cores??[]).slice(0,8).forEach((H,$)=>v.gViaRampa.value[$].set(H).convertSRGBToLinear())})];function je(p,A){let S=A.sim.espelho.vias?.arestas;if(!S)return null;let H=Number.isFinite(p.xTela)?A.raio(p.xTela,p.yTela):null;if(!H)return null;let $={t:0,d:0,x:0,z:0},w=null;for(let z of f.arestas.values()){let y=ae(z.tipo),ee=1/0,me=-1/0,Re=1/0,Ee=-1/0;for(let _e=0;_e<4;_e++)ee=Math.min(ee,z.p[2*_e]),me=Math.max(me,z.p[2*_e]),Re=Math.min(Re,z.p[2*_e+1]),Ee=Math.max(Ee,z.p[2*_e+1]);H[0]<ee-y.meia||H[0]>me+y.meia||H[2]<Re-y.meia||H[2]>Ee+y.meia||(sa(z.p,H[0],H[2],0,$),$.d<=y.meia+.3&&(!w||$.d<w.d)&&(w={e:z.e,d:$.d}))}if(!w)return null;let se=p.origem;return{tipo:"aresta",idx:w.e,ref:fa(w.e,S.ger[w.e]),ponto:H,dist:Math.hypot(H[0]-se[0],H[1]-se[1],H[2]-se[2])}}function U(){if(Y||b.length)return!1;let p=X();for(let A of x.values())if(A.dist<p.alcance&&A.erro!==A.versao&&(!A.malha||A.malha.versao<A.versao))return!1;return!0}let le={nome:"vias",material:O,tabela:d,uniformes:v,rede:f,grade:c,aplicar:W,quadro(p,A){Ve(A),ye()},selecionar:je,pronto:U,get versaoObjetos(){return Q},*setoresPerto(p=1/0){for(let A of x.values())A.malha&&A.objetos&&A.dist<p&&(yield A)},async preparar({teto:p=12e4}={}){let A=Mt();for(e.cameraApi?.atualizar?.(A),ne||W(e.sim.mudancas.desde(-1),e.sim.espelho),Ve(e);Mt()-A<p&&(ye({envios:64,pedidos:r.worker?6:2}),!U());)r.worker?await new Promise(V=>setTimeout(V,20)):(r.rodarLocal(4),await Promise.resolve());return ye({envios:64}),le.medidas()},medidas(){let p=0,A=0;for(let V of x.values())V.malha?.mesh.visible&&(p++,A+=V.malha.tris);return{setores:x.size,malhas:he,visiveis:p,tris:A,memoriaMB:+(fe/1048576).toFixed(2),arestas:f.arestas.size,nos:f.nos.size,msPedidoMedio:ge?+(P/ge).toFixed(1):0}},gerarAgora(p){return Na(ze(ue(p)).dados)},descartar(){for(let p of Je)p?.();for(let p of x.values())Se(p);d.dispose(),O.dispose()}};return le}function Zo(e){e.registrarDominio("vias",qo),e.registrarSelecionavel("aresta",(t,o)=>o.dominio("vias")?.selecionar?.(t,o)??null,{prioridade:Oa.mundo})}var tn={};St(tn,{A_MAX:()=>qt,A_PLANO:()=>It,BASE_TIPO:()=>Xt,DENSIDADE_MAX:()=>ho,DESISTE:()=>Mo,FOLGA_FILA:()=>dt,LIMPEZA:()=>Eo,PARADA:()=>ut,PERFIL_TRAFEGO:()=>po,VERMELHO:()=>Ro,V_NO:()=>Ot,criarMaterialCarro:()=>Io,curvaEntre:()=>Ct,densidade:()=>xo,densidadeFluxo:()=>Ao,distPoligonais:()=>Oo,distanciaNaFila:()=>Ko,faixaDestino:()=>Jt,faixasOrdenadas:()=>Pe,faseSemaforo:()=>_o,fatorHora:()=>Kt,fatorZona:()=>go,fimDaFaixa:()=>Ce,inicioDaFaixa:()=>De,matrizGiroY:()=>Tt,naFaixa:()=>Be,pesoDistancia:()=>Zt,pontoCurva:()=>qe,registrar:()=>en,restaVermelho:()=>bo,velSegura:()=>mt,virada:()=>Vt});var po=Object.freeze({ultra:{carros:400,estacionados:500,raio:700,lod0:130,parados:450},alta:{carros:240,estacionados:300,raio:500,lod0:95,parados:320},media:{carros:120,estacionados:160,raio:360,lod0:70,parados:230},leve:{carros:50,estacionados:0,raio:220,lod0:40,parados:0}}),Xt=Object.freeze({rua:.45,ruaMao:.5,avenida:1.1,avenidaG:1.35,rodovia:1.3,terra:.08}),Xo=Object.freeze({res:1,com:2.2,esc:2.6,ind:1.5}),ho=9;function Kt(e){let t=(o,i)=>Math.exp(-(((e-o+36)%24-12)**2)/(2*i*i));return Math.min(1,.1+.9*Math.max(t(7.5,1.4),.95*t(18,1.8),.6*t(12.5,2.4),.45*t(15,3)))}function go(e,t){let o=0;for(let[c,r]of Object.entries(e??{}))o+=(Xo[c]??1)*r;let i=Math.max(1,t/8*2);return .4+Math.min(1.8,1.4*o/i)}function xo(e,t,o,i){let c=ae(e).id;return(Xt[c]??.3)*Kt(t)*go(o,i)}function Ao(e,t,o,i,c){if(!(t>0)||!(o>0))return 0;let r=Math.max(5,ae(e).velocidade*Math.max(.15,Math.min(1,i||1)));return Math.min(ho,t/o/r*Kt(c)/10)}var ut=7.3,dt=2,It=3,qt=7,Ot=Object.freeze({cruzamento:7,curva:10,retorno:5}),uo=45,tt=8,Zt=(e,t)=>e<=.3*t?1:Math.max(.2,1-.8*(e-.3*t)/(.7*t)),Mo=50,Ko=(e,t)=>(Le[e].c+Le[t].c)/2+dt,mo=(e,t)=>(e.c+t.c)/2+dt,mt=(e,t=0)=>Math.sqrt(Math.max(0,2*It*e+.6*t*t)),Ro=21,Eo=3;function _o(e,t,o){let i=((e+o*.16)%40+40)%40,c=t<.5?i:(i+20)%40;return c<16?0:c<19?1:2}function bo(e,t,o){let i=((e+o*.16)%40+40)%40,c=t<.5?i:(i+20)%40;return c>=19?40-c:0}function Vt(e,t,o,i){let c=Math.atan2(e*i-t*o,e*o+t*i);return Math.abs(c)<.61?0:c>0?1:-1}var vo=new Map;function Pe(e,t,o){let i=`${e}:${t}:${o}`,c=vo.get(i);return c||(c=Pt(e,t).filter(r=>r.sentido===o).sort((r,f)=>r.u*o-f.u*o),vo.set(i,c)),c}function Jt(e,t,o,i,c=!1,r=null){return e.length?i>0||i===0&&c?e[e.length-1]:i<0?e[0]:o<=1?r===null?e[e.length-1]:e[Math.min(e.length-1,Math.floor(r*e.length))]:e[Math.round(t/(o-1)*(e.length-1))]:null}function bt(e,t,o,i,c,r){let f=c-o,v=r-i,g=f*f+v*v,d=g>0?Math.max(0,Math.min(1,((e-o)*f+(t-i)*v)/g)):0,E=e-o-d*f,O=t-i-d*v;return E*E+O*O}function Wo(e,t,o,i,c,r,f,v){let g=o-e,d=i-t,E=f-c,O=v-r,h=e-c,x=t-r,b=g*O-d*E;if(Math.abs(b)>1e-12){let q=(E*x-O*h)/b,J=(g*x-d*h)/b;if(q>=0&&q<=1&&J>=0&&J<=1)return 0}return Math.min(bt(e,t,c,r,f,v),bt(o,i,c,r,f,v),bt(c,r,e,t,o,i),bt(f,v,e,t,o,i))}function Oo(e,t,o,i,c=0,r=1/0){let f=1/0,v=c*c,g=e.length/2-1,d=Math.min(o.length/2-1,r);for(let E=t;E<g;E++)for(let O=i;O<d;O++){let h=Wo(e[2*E],e[2*E+1],e[2*E+2],e[2*E+3],o[2*O],o[2*O+1],o[2*O+2],o[2*O+3]);if(h<f&&(f=h,f<v))return Math.sqrt(f)}return Math.sqrt(f)}function qe(e,t,o){let i=1-t,c=i*i*i,r=3*i*i*t,f=3*i*t*t,v=t*t*t;o.x=c*e[0]+r*e[2]+f*e[4]+v*e[6],o.z=c*e[1]+r*e[3]+f*e[5]+v*e[7];let g=3*i*i*(e[2]-e[0])+6*i*t*(e[4]-e[2])+3*t*t*(e[6]-e[4]),d=3*i*i*(e[3]-e[1])+6*i*t*(e[5]-e[3])+3*t*t*(e[7]-e[5]),E=Math.sqrt(g*g+d*d)||1;return o.hx=g/E,o.hz=d/E,o}function Tt(e,t,o,i,c,r,f,v=1){let g=Math.sqrt(r*r+f*f),d=g>1e-9?r/g*v:0,E=g>1e-9?f/g*v:v;e[t]=E,e[t+1]=0,e[t+2]=-d,e[t+3]=0,e[t+4]=0,e[t+5]=v,e[t+6]=0,e[t+7]=0,e[t+8]=d,e[t+9]=0,e[t+10]=E,e[t+11]=0,e[t+12]=o,e[t+13]=i,e[t+14]=c,e[t+15]=1}function ft(e,t){e.x=t.x,e.z=t.z,e.hx=t.hx,e.hz=t.hz}var $e={x:0,z:0,tx:1,tz:0,t:0};function Be(e,t,o,i,c){return Oe(e.p,e.tab,o,$e),c.x=$e.x-$e.tz*t,c.z=$e.z+$e.tx*t,c.hx=$e.tx*i,c.hz=$e.tz*i,c}var Ce=(e,t)=>t>0?e.L-e.cFim:e.cIni,De=(e,t)=>t>0?e.cIni:e.L-e.cFim,ie={x:0,z:0,hx:1,hz:0},ve={x:0,z:0,hx:1,hz:0};function Ct(e,t,o,i,c,r,f=!1){Be(e,t,Ce(e,o),o,ie),Be(i,c,De(i,r),r,ve);let v=Math.hypot(ve.x-ie.x,ve.z-ie.z),g=f?Math.max(3,v*.9):v*.42,d=[ie.x,ie.z,ie.x+ie.hx*g,ie.z+ie.hz*g,ve.x-ve.hx*g,ve.z-ve.hz*g,ve.x,ve.z],E=Math.hypot(d[2]-d[0],d[3]-d[1])+Math.hypot(d[4]-d[2],d[5]-d[3])+Math.hypot(d[6]-d[4],d[7]-d[5]),O=new Float64Array(2*(tt+1)),h={x:0,z:0,hx:0,hz:0};for(let b=0;b<=tt;b++)qe(d,b/tt,h),O[2*b]=h.x,O[2*b+1]=h.z;let x=Math.abs(Math.atan2(ie.hx*ve.hz-ie.hz*ve.hx,ie.hx*ve.hx+ie.hz*ve.hz));return{p:d,L:Math.max(1,(v+E)/2),poli:O,vir:f?0:Vt(ie.hx,ie.hz,ve.hx,ve.hz),ang:f?Math.PI:x}}function Yo(e,t,o){return(e==="avenida"||e==="avenidaG")&&t<.06?4:t<.06+(e==="rodovia"?.1:0)+.12*o?5:Ht([[0,.34],[1,.26],[2,.24],[3,.16]],pe(Math.floor(t*1e6),7))}var $t=Bt.map(([e])=>{let t=parseInt(e.slice(1),16);return[t>>16&255,t>>8&255,t&255]});function ke(e,t,o){if(!e.includes(t))throw new Error(`carro: shader sem '${t}'`);return e.replace(t,o)}function Io(e,t){let o=new We({color:16777215,roughness:.4,metalness:0});return o.name="carro",o.onBeforeCompile=i=>{Object.assign(i.uniforms,t);let c=i.vertexShader;c=ke(c,"#include <common>",`#include <common>
${qa}`),c=ke(c,"#include <begin_vertex>",`#include <begin_vertex>
${Za}`);let r=i.fragmentShader;r=ke(r,"#include <common>",`#include <common>
${Ja}`),r=ke(r,"#include <color_fragment>",Xa),r=ke(r,"#include <roughnessmap_fragment>",Ka),r=ke(r,"#include <metalnessmap_fragment>",Wa),r=ke(r,"#include <emissivemap_fragment>",`#include <emissivemap_fragment>
${Ya}`),i.vertexShader=c,i.fragmentShader=r},o.customProgramCacheKey=()=>"carro-1",e.aplicar(o,e.nomes().filter(i=>i!=="camada"))}var Fe=(e,t,o)=>(e*1024+Math.round(t*8)+512)*2+(o>0?1:0);function et(e,t){let o=e.get(t);return o||e.set(t,o=[]),o}function kt(e,t){if(t)e.clear();else for(let o of e.values())o.length=0}function Qo(e){let{cena:t,medidas:o}=e,i={gCarroNoite:{value:0}},c=Io(e.ganchos,i),r=()=>Ye(po,e.perfil),f=[];function v(){for(let l of f)t.remove(l.mesh),l.mesh.geometry.dispose(),l.mesh.dispose();f.length=0;let n=r(),a=Math.max(16,n.carros+n.estacionados);Le.forEach((l,m)=>{for(let u of[0,1]){let R=Sa(m,u),M=new Ke;M.setAttribute("position",new te(R.posicao,3)),M.setAttribute("normal",new te(R.normal,3)),M.setAttribute("aParte",new te(Float32Array.from(R.parte),1)),M.setIndex(new te(R.indices,1));let I=new nt(new Uint8Array(a*4),4,!1);I.setUsage(Ue),M.setAttribute("aCarro",I),M.boundingSphere=new Xe(new Ne,1e7);let s=new gt(M,c,a);s.instanceMatrix.setUsage(Ue),s.frustumCulled=!1,s.count=0,s.visible=!1,s.name=`carros:${Le[m].id}:${u}`,o.familia(s,"vida"),t.add(s),f.push({mi:m,lod:u,mesh:s,cor:I,cap:a,tris:R.tris})}})}v();let g=e.perfil.id,d=[],E=new Map,O=new Set,h=[],x=0,b=0,q=null,J=-1e9,Y=null,ne=!0,Ie=-1,fe=1,he=null,Q=new Ne,P={x:0,z:0,tx:1,tz:0,t:0},ge=new Map,xe=new Map,L=new Map,G=[],re=0,X=0,ue=0;function Me(n){let a=n.celulas,l=new Map;if(!a)return l;for(let m=0;m<a.n;m++){if(!a.viva[m]||a.estado[m]!==ca.OCUPADA||!a.zona[m])continue;let u=da[va[a.zona[m]]]?.familia;if(!u)continue;let R=a.aresta[m],M=l.get(R);M||l.set(R,M={}),M[u]=(M[u]??0)+1}return l}function ce(n,a,l,m){if(!n?.ida||a.e>=n.ida.length)return null;let u=l>0?n.ida[a.e]:n.volta?.[a.e]??0;return!(u>0)&&!m(-l)&&(u=l>0?n.volta?.[a.e]??0:n.ida[a.e]),{q:u||0,vel:n.vel?.[a.e]??1}}function W(n,a,l){let m=r().raio,u=l?.fluxos??null;h=[],x=0;for(let s of n.rede.arestas.values()){let F=s.L-s.cIni-s.cFim;if(F<12)continue;Oe(s.p,s.tab,s.L/2,P);let C=Math.hypot(P.x-Q.x,P.z-Q.z);if(C>m+s.L/2)continue;let T=Pt(s.tipo,s.mao);if(!T.length)continue;let _={1:0,"-1":0};for(let D of T)_[D.sentido]++;let k=D=>_[D]>0,j=(Y?.get(s.e)?.ind??0)/Math.max(1,F/8),B=T.map(D=>{let Z=u?ce(u,s,D.sentido,k):null;return(Z?Ao(s.tipo,Z.q,_[D.sentido],Z.vel,a):xo(s.tipo,a,Y?.get(s.e),s.L))*F/100}),N=B.reduce((D,Z)=>D+Z,0);N<=0||(h.push({ar:s,faixas:T,pesos:B,w:N,ind:j,g:Zt(C,m),ws:0}),x+=N)}let R=Math.min(r().carros,x),M=0;for(let s of h)M+=s.w*s.g;let I=M>=R||x<=M?0:(R-M)/(x-M);b=0;for(let s of h)s.ws=s.w*(s.g+I*(1-s.g)),b+=s.ws;q=Q.clone()}function ze(n,a,l){let m=G[re];m||G.push(m={c:null,pos:0}),re++,m.c=a,m.pos=l,et(ge,n).push(m)}function Ze(n,a,l,m,u,R=0){let M=ge.get(Fe(n.e,a,l));if(!M)return!0;let I=m*l;for(let s of M)if(Math.abs(s.pos-I)<(u+s.c.c)/2+dt+R)return!1;return!0}function Se(n,a,l,m,{c:u=Le[m].c,l:R=Le[m].l,vMax:M,cor:I,externo:s=null}={}){let F=fe++,C=ae(n.tipo),T=M??C.velocidade/3.6*(.72+.25*pe(F,5)),_={id:F,e:n.e,u:a.u,sentido:a.sentido,s:l,v:0,vMax:T,mi:m,c:u,l:R,cor:I??$t[Ht(Bt.map(([,j],B)=>[B,j]),pe(F,6))],curva:null,prox:null,reserva:null,tPedido:null,quer:!1,espera:0,parado:0,freio:!1,x:0,y:0,z:0,hx:1,hz:0,idade:0,externo:s},k=(Ce(n,a.sentido)-l)*a.sentido;return _.v=Math.min(T*.8,mt(Math.max(0,k-ut-u/2))),Be(n,_.u,_.s,_.sentido,ie),ft(_,ie),_}function at(n=0){if(!h.length||b<=0)return null;let a=pe(fe,1)*b,l=h[h.length-1];for(let T of h)if(a-=T.ws,a<0){l=T;break}let m=pe(fe,2)*l.w,u=l.faixas[l.faixas.length-1];for(let T=0;T<l.faixas.length;T++)if(m-=l.pesos[T],m<0){u=l.faixas[T];break}let R=l.ar,M=R.cIni+6,I=R.L-R.cFim-6,s=I-M>30?u.sentido>0?M+pe(fe,3)*(I-M-24):M+24+pe(fe,3)*(I-M-24):(M+I)/2;if(n>0){Oe(R.p,R.tab,s,P);let T=e.camera.position;if((P.x-T.x)**2+(P.z-T.z)**2<n*n)return null}let F=ae(R.tipo),C=Yo(F.id,pe(fe,4),l.ind);if(!Ze(R,u.u,u.sentido,s,Le[C].c,8))return null;for(let T of ge.get(Fe(R.e,u.u,u.sentido))??[])if(T.c.parado>15)return null;return Se(R,u,s,C)}function ye(n,a){let l=Pe(n.tipo,n.mao,a.sentido);return{rank:Math.max(0,l.findIndex(m=>m.u===a.u)),n:l.length}}function Ve(n,a,l,m,u,R,M,I={}){let s=!!I.retorno,F=Ct(a,n.u,n.sentido,l,u.u,m,s),C=s?Ot.retorno:R.tipo==="cruzamento"?Ot.cruzamento:R.tipo==="curva"?Ot.curva:n.vMax;return{ar:l,sentido:m,u:u.u,s:De(l,m),no:R,n:M,de:a,...F,vLim:C,retorno:s,...I}}function Je(n,a,l){let m=a.sentido>0?l.b:l.a,u=n.rede.nos.get(m);if(!u)return null;Oe(l.p,l.tab,Ce(l,a.sentido),P);let R=P.tx*a.sentido,M=P.tz*a.sentido,{rank:I,n:s}=ye(l,a),F=a.externo;if(F){let B=F.k+1,N=F.plano.passos[B];if(!N)return null;let D=n.rede.arestas.get(N.e);if(!D||(N.sentido>0?D.a:D.b)!==m)return null;let Z=Pe(D.tipo,D.mao,N.sentido);if(!Z.length)return null;Oe(D.p,D.tab,De(D,N.sentido),P);let K=Vt(R,M,P.tx*N.sentido,P.tz*N.sentido);return Ve(a,l,D,N.sentido,Jt(Z,I,s,K,!0),u,m,{k:B})}let C=[],T=e.sim?.espelho?.fluxos;for(let B of u.analise.bracos){if(B.e===a.e&&B.inverte===a.sentido>0)continue;let N=n.rede.arestas.get(B.e);if(!N)continue;let D=B.inverte?-1:1,Z=Pe(N.tipo,N.mao,D);if(!Z.length)continue;let K=Vt(R,M,B.dx,B.dz),de=(Xt[ae(N.tipo).id]??.3)+.2;if(T?.ida&&N.e<T.ida.length){let we=D>0?T.ida[N.e]:T.volta?.[N.e]??0;!(we>0)&&N.mao&&(we=D>0?T.volta?.[N.e]??0:T.ida[N.e]),de=.15+Math.max(0,we||0)/600}n.rede.nos.get(D>0?N.b:N.a)?.tipo==="ponta"&&N.L<40&&(de*=.001),s>1&&K>0&&I<s-1&&(de*=.15),s>1&&K<0&&I>0&&(de*=.03),C.push({a2:N,sentido:D,fx:Z,w:de,vir:K})}if(!C.length){if(u.tipo!=="ponta"||ae(l.tipo).id==="rodovia")return null;let B=-a.sentido,N=Pe(l.tipo,l.mao,B);return N.length?Ve(a,l,l,B,N[0],u,m,{retorno:!0}):null}let _=C.reduce((B,N)=>B+N.w,0),k=pe(a.id,a.idade+++11)*_,j=C[C.length-1];for(let B of C)if(k-=B.w,k<0){j=B;break}return Ve(a,l,j.a2,j.sentido,Jt(j.fx,I,s,j.vir,!1,pe(a.id,a.idade+31)),u,m)}function je(n,a,l,m){if(n.sinal!==void 0)return n.sinal;let u=a?.semaforos?a.analise.bracos.find(R=>R.e===l&&R.inverte===m>0):null;return n.sinal=u?{grupo:ya(u.theta),defas:wa(a.n)}:null,n.sinal}let U=(n,a)=>n?_o(a,n.grupo,n.defas):0,le=(n,a)=>n?Ro-bo(a,n.grupo,n.defas):0;function p(n,a){let l=ge.get(Fe(n.ar.e,n.u,n.sentido));if(!l)return!0;let m=n.s*n.sentido;for(let u of l)if(u.c!==a&&(u.c.curva&&u.c.curva.prox.ar.e===n.ar.e&&u.c.curva.prox.u===n.u&&u.c.curva.prox.sentido===n.sentido||u.pos-m<mo(a,u.c)))return!1;return!0}let A=(n,a)=>{let l=a.ang??0;return l<.2?0:Math.min(3,n.c*n.c*l/(8*a.L))},V=n=>(n.tPedido??ue)+(n.prox?.vir<0?2:0)-(n.prox?.principal?3:0);function S(n,a,l){if(l===n)return!1;let m=l.saindoNo===a.n&&!l.curva,u=l.naBoca===a.n&&l.reserva!==a.n;if(!m&&l.e===n.e&&l.u===n.u&&l.sentido===n.sentido)return!1;let R=m?l.saindo:l.curva?l.curva.prox:l.reserva===a.n?l.reservaPx:l.prox;if(!R?.poli)return!1;let M=m?tt-1:l.curva?Math.max(0,Math.floor((l.curva.t-(l.c/2+.5)/l.curva.L)*tt)):0,I=(n.l+l.l)/2+.7+A(n,a)+(u?0:A(l,R));return Oo(a.poli,0,R.poli,u?0:Math.min(tt-1,M),I,u?1:1/0)<I}function H(n,a,l){for(let u of xe.get(a.n)??[])if(S(n,a,u))return!1;let m=V(n);for(let u of L.get(a.n)??[]){if(u===n||u.reserva!=null||!u.prox||u.prox.n!==a.n)continue;let R=u.prox;if(!u.livre&&(R.ar.e!==a.ar.e||R.u!==a.u||R.sentido!==a.sentido))continue;let M=V(u);if((M<m||M===m&&u.id<n.id)&&S(n,a,u))return!1}return!(l?.faixaOcupada&&(l.faixaOcupada(a.n,a.ar.e)||l.faixaOcupada(a.n,n.e)))}function $(n){if(n.reserva==null)return;let a=xe.get(n.reserva);if(a){let l=a.indexOf(n);l>=0&&a.splice(l,1)}n.reserva=null}function w(n,a,l){let m=n.v,u=n.c>9?1.2:n.c>6?1.6:2.4;n.v=Math.max(0,n.v+Math.max(-qt*l,Math.min(u*l,a-n.v))),n.freio=n.v<m-.05*l||n.v<.3}function se(n,a){let m=ae(a.tipo).velocidade/3.6*.9,u=n.externo,R=Number.isFinite(u.alvoD)?u.alvoD-z(n):0;return Math.max(.35*m,Math.min(1.2*m,m*(1+R/80)))}function z(n){let a=n.externo,l=a.plano,m=a.k,u=l.ars[m];if(!u)return 0;let R=(M,I,s)=>I>0?M:s.L-M;if(n.curva){let M=l.cum[m]+R(Ce(u,n.sentido),n.sentido,u),I=l.ars[m+1],s=I?l.cum[m+1]+R(De(I,l.passos[m+1].sentido),l.passos[m+1].sentido,I):M;return M+(s-M)*n.curva.t}return l.cum[m]+R(n.s,n.sentido,u)}let y={x:0,z:0,hx:1,hz:0};function ee(n,a,l,m){let u=n.rede,R=e.camera.position;ue=l;let M=++X%600===0;kt(ge,M),kt(xe,M),kt(L,M),re=0;for(let s of d){if(s.gap=1/0,s.vL=0,s.curva){let F=u.arestas.get(s.e),C=s.curva,T=C.prox,_=T.vir||T.retorno?1+.12*s.c:.5;F&&ze(Fe(s.e,s.u,s.sentido),s,Ce(F,s.sentido)*s.sentido+C.t*C.L+_),ze(Fe(T.ar.e,T.u,T.sentido),s,T.s*T.sentido-(1-C.t)*C.L-_)}else ze(Fe(s.e,s.u,s.sentido),s,s.s*s.sentido);s.saindoNo!=null&&et(xe,s.saindoNo).push(s),s.naBoca=null,!s.curva&&s.reserva==null&&s.prox&&s.prox.de===u.arestas.get(s.e)&&(Ce(s.prox.de,s.sentido)-s.s)*s.sentido<ut+s.c/2-.5&&(s.naBoca=s.prox.n,et(xe,s.naBoca).push(s)),s.reserva!=null?et(xe,s.reserva).push(s):s.quer&&s.prox&&et(L,s.prox.n).push(s)}for(let s of ge.values()){s.sort((F,C)=>F.pos-C.pos||F.c.id-C.c.id);for(let F=0;F+1<s.length;F++){let C=s[F],T=s[F+1],_=T.pos-C.pos-mo(C.c,T.c);_<C.c.gap&&(C.c.gap=_,C.c.vL=T.c.v)}}let I=new Set;for(let s of d)s.curva?me(s,a):Re(n,s,a,l,m)||I.add(s),s.parado=s.v<.1?s.parado+a:0,s.parado>Mo&&!s.externo&&Math.hypot(s.x-R.x,s.z-R.z)>60&&I.add(s);if(I.size){for(let s of I)$(s),s.externo&&(s.externo.chegou=!0,E.delete(s.externo.id),O.add(s.externo.id));for(let s=d.length-1;s>=0;s--)I.has(d[s])&&d.splice(s,1)}}function me(n,a){let l=n.curva,m=l.prox;w(n,Math.min(m.vLim,n.vMax,mt(n.gap,n.vL)),a);let u=Math.min(n.v*a,Math.max(0,n.gap));if(u<n.v*a&&(n.v=a>0?u/a:0),l.t+=u/l.L,l.t>=1){n.e=m.ar.e,n.u=m.u,n.sentido=m.sentido,n.s=m.s,n.curva=null,n.prox=null,n.reserva!=null&&(n.saindo=m,n.saindoNo=n.reserva,n.reserva=null),n.espera=0,n.externo&&(n.externo.k=m.k),Be(m.ar,n.u,n.s,n.sentido,y),ft(n,y);return}qe(m.p,l.t,y),ft(n,y)}function Re(n,a,l,m,u){let R=n.rede,M=R.arestas.get(a.e);if(!M)return!1;a.saindo&&(a.s-De(M,a.sentido))*a.sentido>a.c/2+1&&(a.saindo=null,a.saindoNo=null);let I=Ce(M,a.sentido),s=(I-a.s)*a.sentido,F=a.sentido>0?M.b:M.a,C=R.nos.get(F),T=a.externo?se(a,M):a.vMax;T=Math.min(T,mt(a.gap,a.vL)),a.prox&&(R.arestas.get(a.prox.ar.e)!==a.prox.ar||a.prox.de!==M||R.nos.get(a.prox.n)!==a.prox.no)&&(a.prox=null,$(a)),s<uo&&a.prox==null&&(a.prox=Je(n,a,M)??!1);let _=a.prox||null,k=ut+a.c/2,j=!!_;if(a.quer=!1,_&&(T=Math.min(T,Math.sqrt(_.vLim*_.vLim+2*It*Math.max(0,s))),s<uo)){let N=p(_,a)||a.espera>15&&C?.tipo!=="cruzamento",D=u?.faixaOcupada?.(F,a.e)??!1;if((C?.tipo==="cruzamento"||C?.tipo==="curva")&&!_.retorno){let K=je(_,C,a.e,a.sentido),de=U(K,m),vt=de===0,we=s<k+1&&a.v<.5,Po=de===1||de===2&&_.vir<0&&le(K,m)<Eo,Nt=vt||Po&&we&&a.espera>3;if(_.principal===void 0){let pt=C.analise.bracos.map(Bo=>Bo.P.velocidade),na=ae(M.tipo).velocidade;_.principal=!C.semaforos&&na>=Math.max(...pt)&&Math.min(...pt)<na}if(a.reserva!=null&&(!Nt||!N||D)&&s-k>a.v*a.v/(2*qt)+.5&&$(a),a.reserva==null){let pt=s-k<=a.v*a.v/(2*It)+4||s<k+1;Nt&&pt?(a.tPedido??=m+Math.max(0,s-k)/Math.max(1,a.v),a.quer=!0,a.livre=N&&!D,N&&!D&&H(a,_,u)&&(a.reserva=F,a.reservaPx=_,et(xe,F).push(a),a.tPedido=null,a.quer=!1)):Nt||(a.tPedido=null)}j=a.reserva!=null}else j=N&&!D;if(!j){let K=s>=k-.5?s-k:s-.3;T=Math.min(T,mt(Math.max(0,K)))}}w(a,T,l);let B=Math.min(a.v*l,Math.max(0,a.gap));if(_&&!j&&(B=Math.min(B,Math.max(0,s-.05))),B<a.v*l&&(a.v=l>0?B/l:0),a.espera=a.v<.3?a.espera+l:0,a.s+=B*a.sentido,(I-a.s)*a.sentido<=1e-6){if(!_)return!1;if(j)return a.s=I,a.curva={t:0,L:_.L,prox:_},a.prox=null,qe(_.p,0,y),ft(a,y),!0;a.s=I}return Be(M,a.u,a.s,a.sentido,y),ft(a,y),!0}function Ee(n,a,l,m){let u=E.get(n);if(u)return u.externo.alvoD=l,u.externo.visto=ue,u;let R=e.dominio("vias");if(!R?.rede||!a?.passos?.length)return null;let M=0;for(;M+1<a.passos.length&&a.cum[M+1]<=l;)M++;let I=a.passos[M],s=R.rede.arestas.get(I.e);if(!s||s!==a.ars[M])return null;let F=l-a.cum[M],C=I.sentido>0?F:s.L-F,T=De(s,I.sentido),_=Ce(s,I.sentido);if((C-T)*I.sentido<1||(_-C)*I.sentido<8||(Oe(s.p,s.tab,C,P),Math.hypot(P.x-Q.x,P.z-Q.z)>r().raio))return null;let k=Pe(s.tipo,s.mao,I.sentido);if(!k.length)return null;let j=k[k.length-1],B=ge.get(Fe(s.e,j.u,I.sentido))??[],N=C*I.sentido,D=[];for(let K of B)if(!(Math.abs(K.pos-N)>=(m.c+K.c.c)/2+dt+4)){if(K.c.externo)return null;D.push(K.c)}for(let K of D){$(K);let de=d.indexOf(K);de>=0&&d.splice(de,1)}let Z=Se(s,j,C,5,{c:m.c,l:m.l,vMax:ae(s.tipo).velocidade/3.6*.9,externo:{id:n,plano:a,k:M,alvoD:l,visto:ue,chegou:!1}});return Z.y=ea(Z,s,e.sim.espelho.terreno),d.push(Z),E.set(n,Z),Z}function _e(n){let a=E.get(n);if(!a)return;E.delete(n),$(a);let l=d.indexOf(a);l>=0&&d.splice(l,1)}function Fo(n,a,l=!1){for(let u of xe.get(n)??[]){if(u.saindoNo===n&&!u.curva){if(u.e===a)return!0;continue}let R=u.curva?u.curva.prox:u.reservaPx;if(R&&(R.ar.e===a||u.e===a))return!0}let m=e.dominio("vias")?.rede?.arestas.get(a);if(!m)return!1;for(let u of d)if(!(u.curva||u.e!==a)){if((u.sentido>0?m.b:m.a)===n){let R=(Ce(m,u.sentido)-u.s)*u.sentido;if(R<ut+u.c/2-.5||l&&R<30&&u.v>1.5)return!0}else if((u.s-De(m,u.sentido))*u.sentido<5.3+u.c/2)return!0}return!1}let zt={arr:null,o:0};function ea(n,a,l){let m=n.curva||!a?Qe.pista+.03:At(ae(a.tipo),n.u);return a?.ponte&&!n.curva?a.cotas[0]+(a.cotas[1]-a.cotas[0])*n.s/a.L+m-Qe.pista:(l?ht(l,n.x,n.z):0)+m}function Do(n,a,l){let m=r(),u=e.camera.position,R=f.map(()=>0),M=a.terreno,I=(_,k)=>_*2+k,s=(_,k,j,B)=>{let N=I(_,k),D=f[N],Z=R[N];return Z>=D.cap?null:(R[N]++,D.cor.array[4*Z]=j[0],D.cor.array[4*Z+1]=j[1],D.cor.array[4*Z+2]=j[2],D.cor.array[4*Z+3]=B,zt.arr=D.mesh.instanceMatrix.array,zt.o=Z*16,zt)},F=l>.25?1:0,C=m.lod0*m.lod0;for(let _ of d){if(_.y=ea(_,n.rede.arestas.get(_.e),M),_.externo)continue;let k=(_.x-u.x)**2+(_.y-u.y)**2+(_.z-u.z)**2,j=s(_.mi,k<C?0:1,_.cor,F|(_.freio?2:0));j&&Tt(j.arr,j.o,_.x,_.y,_.z,_.hx,_.hz)}let T=0;if(m.estacionados>0)for(let _ of n.setoresPerto(m.parados))for(let[k,j]of _.estacionados??[])for(let B=0;B<j.n&&T<m.estacionados;B++){let N=B*16,D=j.mat[N+12]-u.x,Z=j.mat[N+13]-u.y,K=j.mat[N+14]-u.z,de=Math.sqrt(D*D+Z*Z+K*K);if(de>m.parados)continue;let vt=$t[j.bytes[4*B]]??$t[0],we=s(k,de<m.lod0?0:1,vt,0);we&&we.arr.set(j.mat.subarray(N,N+16),we.o),T++}return f.forEach((_,k)=>{let j=R[k];if(_.mesh.count=j,_.mesh.visible=j>0,!j)return;let B=_.mesh.instanceMatrix;B.clearUpdateRanges(),B.addUpdateRange(0,j*16),B.needsUpdate=!0,_.cor.clearUpdateRanges(),_.cor.addUpdateRange(0,j*4),_.cor.needsUpdate=!0}),e.stats.instancias.carros=d.length-E.size+T,T}function ta(n,a,l=0){for(let m=0;m<a&&d.length-E.size<n;m++){let u=at(l);u?(d.push(u),ze(Fe(u.e,u.u,u.sentido),u,u.s*u.sentido)):fe++}}function aa(n,a=0){let l=Math.min(n.carros,Math.round(x));ta(l,4,n.lod0);let m=d.length-E.size-(l+4),u=a>0&&x>n.carros,R=e.camera.position,M=n.lod0*n.lod0;for(let I=d.length-1;I>=0;I--){let s=d[I],F=(s.x-Q.x)**2+(s.z-Q.z)**2,C=F>(n.raio+80)**2;if(s.externo){(C||ue-s.externo.visto>90)&&_e(s.externo.id);continue}let T=(s.x-R.x)**2+(s.z-R.z)**2>M,_=C||m>0&&T;if(!_&&u&&T&&!s.curva){let k=Zt(Math.sqrt(F),n.raio);_=k<1&&pe(s.id,X+7919)<a*(1-k)/20}_&&(C||m--,$(s),d.splice(I,1))}}let yt=null,oa=0,wt={nome:"trafego",aplicar(n){(n.celulas?.length||n.tudo?.celulas||n.realocado?.includes("celulas"))&&(ne=!0)},quadro(n,a){let l=a.dominio("vias");if(!l?.rede)return;g!==a.perfil.id&&(g=a.perfil.id,v(),d.length=0,E.clear());let m=a.sim.espelho,u=r(),R=a.horaDoCeu(),M=a.sol?.dia??1,I=Math.min(1,Math.max(0,1-M*1.4));i.gCarroNoite.value=I;let s=m.tempo,F=he??(s?.velocidade??1)>0,C=yt===null?0:Math.min(100,n-yt)/1e3*(F?Math.max(1,s?.mult??1):0);yt=n,a.relogioRua=(a.relogioRua??0)+C,ne&&n-(wt._tZonas??-1e9)>5e3&&(Y=Me(m),ne=!1,wt._tZonas=n),a.cameraApi?.alvo?.(Q),(Ie!==l.rede.versao||!q||Q.distanceTo(q)>60||n-J>2e3)&&(W(l,R,m),Ie=l.rede.versao,J=n),aa(u,C),C>0&&ee(l,C,a.relogioRua,a.dominio("pedestres")),oa=Do(l,m,I)},animar(n){he=n},povoar(n=e){let a=n.dominio("vias");if(!a?.rede)return 0;n.cameraApi?.alvo?.(Q),ne&&(Y=Me(n.sim.espelho),ne=!1),W(a,n.horaDoCeu(),n.sim.espelho),Ie=a.rede.versao;let l=Math.min(r().carros,Math.round(x));return ta(l,l*4),d.length},avancar(n,a=e){let l=a.dominio("vias");if(l?.rede)for(let m=0;m<n;m+=.1)a.relogioRua=(a.relogioRua??0)+.1,aa(r(),.1),ee(l,.1,a.relogioRua,a.dominio("pedestres")),a.dominio("pedestres")?.avancarUm?.(.1,a)},seguir:Ee,soltarExterno:_e,externo(n){return E.get(n)??null},chegou:n=>O.has(n),esquecer(n){O.delete(n)},cruzandoFaixa:Fo,_carros:()=>d,medidas(){let n=0;for(let a of f)n+=a.mesh.count*a.tris;return{andando:d.length-E.size,caminhoes:E.size,parados:oa,tris:n,alvo:Math.round(x),fluxo:!!e.sim?.espelho?.fluxos?.ida}},amostra(){return d.map(n=>({id:n.id,e:n.e,u:n.u,sentido:n.sentido,s:n.s,mi:n.mi,c:n.c,l:n.l,v:n.v,curva:!!n.curva,retorno:!!n.curva?.prox?.retorno,no:n.curva?.prox?.n??null,de:n.curva?n.e:null,para:n.curva?.prox?.ar.e??null,x:n.x,z:n.z,hx:n.hx,hz:n.hz,externo:n.externo?.id??null,k:n.externo?.k??null}))},descartar(){for(let n of f)t.remove(n.mesh),n.mesh.geometry.dispose(),n.mesh.dispose();c.dispose()}};return wt}function en(e){e.registrarDominio("trafego",Qo)}var cn={};St(cn,{CORPOS:()=>Yt,FATOR_VELOCIDADE:()=>zo,MODELO_CAMINHAO:()=>Qt,PERFIL_CAMINHOES:()=>Co,criarMaterialCaminhao:()=>Lo,distanciaDaViagem:()=>No,passosDoCaminho:()=>yo,planoDaRota:()=>wo,poseDaViagem:()=>So,registrar:()=>sn});var Co=Object.freeze({ultra:{raio:3e3,lod0:160,max:64},alta:{raio:2400,lod0:120,max:48},media:{raio:1600,lod0:90,max:32},leve:{raio:900,lod0:60,max:16}}),Yt=Object.freeze(["basculante","carroceria","betoneira","bau"]),Qt=Object.freeze({c:8.6,l:2.5}),zo=.9,an=[236,236,232];function yo(e){return Array.from(e??[],t=>t<0?{e:~t,sentido:-1}:{e:t,sentido:1})}function wo(e,t){let o=yo(t);if(!o.length)return null;let i=[],c=[0],r=[0],f=null;for(let v of o){let g=e.arestas.get(v.e);if(!g)return null;let d=v.sentido>0?g.a:g.b;if(f!==null&&d!==f)return null;f=v.sentido>0?g.b:g.a,i.push(g),c.push(c[c.length-1]+g.L),r.push(r[r.length-1]+g.L/(ae(g.tipo).velocidade/3.6*zo))}return{passos:o,ars:i,cum:c,tempos:r,L:c[c.length-1],T:r[r.length-1],curvas:[],versao:e.versao}}function No(e,t,o){let i=Math.max(1,e.tFim-e.tIni),c;if(t.T<=i?c=o-(e.tIni+(i-t.T)/2):c=(o-e.tIni)/i*t.T,!(c>=0)||c>t.T)return null;let r=0;for(;r+1<t.passos.length&&t.tempos[r+1]<=c;)r++;let f=(c-t.tempos[r])/Math.max(1e-9,t.tempos[r+1]-t.tempos[r]);return t.cum[r]+Math.min(1,Math.max(0,f))*(t.cum[r+1]-t.cum[r])}var Vo=(e,t)=>t>0?e.cIni:e.cFim,To=(e,t)=>t>0?e.L-e.cFim:e.L-e.cIni,Wt=(e,t)=>Pe(e.tipo,e.mao,t).at(-1)??null;function So(e,t,o={}){let i=0;for(;i+1<e.passos.length&&e.cum[i+1]<=t;)i++;let c=e.ars[i],{sentido:r}=e.passos[i],v=Wt(c,r)?.u??0,g=Math.max(0,Math.min(c.L,t-e.cum[i])),d=x=>{if(!e.curvas[x]){let b=e.ars[x],q=e.ars[x+1],J=e.passos[x].sentido,Y=e.passos[x+1].sentido;e.curvas[x]=Ct(b,Wt(b,J)?.u??0,J,q,Wt(q,Y)?.u??0,Y)}return e.curvas[x]};o.k=i,o.ar=c,o.u=v,o.curva=!1;let E=Vo(c,r),O=To(c,r);if(g<E&&i>0){let x=e.ars[i-1],b=e.passos[i-1].sentido,q=e.cum[i-1]+To(x,b),J=(t-q)/Math.max(.1,e.cum[i]+E-q);return qe(d(i-1).p,Math.min(1,Math.max(0,J)),o),o.curva=!0,o}if(g>O&&i+1<e.passos.length){let x=e.cum[i]+O,b=(t-x)/Math.max(.1,e.cum[i+1]+Vo(e.ars[i+1],e.passos[i+1].sentido)-x);return qe(d(i).p,Math.min(1,Math.max(0,b)),o),o.curva=!0,o}let h=Math.min(O,Math.max(E,g));return Be(c,v,r>0?h:c.L-h,r,o),o.s=r>0?h:c.L-h,o}function He(e,t,o){if(!e.includes(t))throw new Error(`caminhão: shader sem '${t}'`);return e.replace(t,o)}function Lo(e,t,o){let i=new We({color:16777215,roughness:.4,metalness:0});return i.name="caminhao",i.onBeforeCompile=c=>{Object.assign(c.uniforms,t);let r=c.vertexShader;r=He(r,"#include <common>",`#include <common>
${o.CAMINHAO_VERTICE_PARS}`),r=He(r,"#include <beginnormal_vertex>",o.CAMINHAO_VERTICE_NORMAL),r=He(r,"#include <begin_vertex>",o.CAMINHAO_VERTICE_MAIN);let f=c.fragmentShader;f=He(f,"#include <common>",`#include <common>
${o.CAMINHAO_FRAGMENTO_PARS}`),f=He(f,"#include <color_fragment>",o.CAMINHAO_FRAGMENTO_COR),f=He(f,"#include <roughnessmap_fragment>",o.CAMINHAO_FRAGMENTO_RUGOSIDADE),f=He(f,"#include <metalnessmap_fragment>",o.CAMINHAO_FRAGMENTO_METAL),f=He(f,"#include <emissivemap_fragment>",`#include <emissivemap_fragment>
${o.CAMINHAO_FRAGMENTO_EMISSIVO}`),c.vertexShader=r,c.fragmentShader=f},i.customProgramCacheKey=()=>"caminhao-1",e.aplicar(i,e.nomes().filter(c=>c!=="camada"))}function on(e,t){return e.setAttribute("position",new te(t?t.posicao:new Float32Array(9),3)),e.setAttribute("normal",new te(t?t.normal:new Float32Array(9),3)),e.setAttribute("aParte2",new te(t?t.parte:new Float32Array(6),2)),e.setIndex(new te(t?t.indices:Uint16Array.of(0,1,2),1)),e.boundingSphere=new Xe(new Ne,1e7),e}var nn=e=>{let t=parseInt(String(e??"#c9a86a").replace("#",""),16);return Number.isFinite(t)?[t>>16&255,t>>8&255,t&255]:[201,168,106]};function rn(e){let{cena:t,medidas:o}=e,i={gCamNoite:{value:0},gCamTempo:{value:0},gCamTambor:{value:new ot(1.95,1.85,2.55,-3.6)},gCamPiso:{value:1.28}},c=null,r=()=>Ye(Co,e.perfil),f=null,v=[];function g(){for(let G of v)t.remove(G.mesh),G.mesh.geometry.dispose(),G.mesh.dispose();if(v.length=0,!f)return;let L=r().max;Yt.forEach((G,re)=>{for(let X of[0,1]){let ue=on(new Ke,f.malhaCaminhao(G,X)),Me=new nt(new Uint8Array(L*4),4,!1),ce=new nt(new Uint8Array(L*4),4,!1);Me.setUsage(Ue),ce.setUsage(Ue),ue.setAttribute("aCab",Me),ue.setAttribute("aCarga",ce);let W=new gt(ue,c,L);W.instanceMatrix.setUsage(Ue),W.frustumCulled=!1,W.count=0,W.visible=!1,W.name=`caminhoes:${G}:${X}`,o.familia(W,"vida"),t.add(W),v.push({ci:re,lod:X,mesh:W,cab:Me,carga:ce,cap:L,tris:f.malhaCaminhao(G,X).tris})}})}let d=e.perfil.id,E=()=>v.map(L=>L.mesh),O=import("./parte.20261003164736.OKFGZZYH.js").then(L=>{f=L,c=Lo(e.ganchos,i,L),i.gCamTambor.value.set(L.TAMBOR.y0,L.TAMBOR.z0,L.TAMBOR.y1,L.TAMBOR.z1),i.gCamPiso.value=L.CAMINHAO.piso,d=e.perfil.id,g();let G=e.quadro?.aquecer;return G?.pronto&&(G.delete?.(E),G.add?.(E)),L}),h=!1;O.catch(L=>{h=!0,console.error("caminhoes: o modelo dos caminhões não carregou",L)});let x=new Map,b=new Map,q=new Map,J=null,Y=0,ne=null,Ie=[],fe=0,he=0,Q=0,P={x:0,z:0,hx:1,hz:0};function ge(L,G){let re=x.get(G.id);if(re&&re.caminho===G.caminho&&re.pl?.versao===L.versao)return re.pl;let X=wo(L,G.caminho);return x.set(G.id,{pl:X,caminho:G.caminho}),X}return{nome:"caminhoes",quadro(L,G){let re=G.dominio("vias");if(!re?.rede||!f)return;d!==G.perfil.id&&(d=G.perfil.id,g());let X=G.sim.espelho,ue=X.terreno,Me=r(),ce=G.dominio("trafego"),W=X.tempo,ze=ne??(W?.velocidade??1)>0,Ze=J===null?0:Math.min(100,L-J)/1e3*(ze?Math.max(1,W?.mult??1):0);J=L,Y+=Ze,ne===!0&&!((W?.velocidade??0)>0)&&(fe+=Ze),i.gCamTempo.value=Y,i.gCamNoite.value=Math.min(1,Math.max(0,1-(G.sol?.dia??1)*1.4));let Se=(W?.tique??0)+(W?.frac??0)+fe,at=nn(X.holding?.cor),ye=G.camera.position,Ve=v.map(()=>0),Je=new Set;he=0,Q=0;let je=(U,le,p,A,V,S,H,$)=>{let w=Math.hypot(p-ye.x,A-ye.y,V-ye.z);if(w>Me.raio)return;let se=f.cargaDe(le.item),y=Yt.indexOf(se.corpo)*2+(w<Me.lod0?0:1),ee=v[y],me=Ve[y];if(me>=ee.cap)return;Ve[y]++,he++,Tt(ee.mesh.instanceMatrix.array,me*16,p,A,V,S,H);let Re=le.visual?an:at,Ee=(i.gCamNoite.value>.25?1:0)|($?2:0);ee.cab.array.set([Re[0],Re[1],Re[2],Ee+4*(U%64)],4*me),ee.carga.array.set([se.cor[0],se.cor[1],se.cor[2],Math.max(0,Math.min(10,Math.round(le.n??10)))],4*me)};for(let U of Ie.length?[...X.entregas??[],...Ie]:X.entregas??[]){if(!U?.caminho?.length)continue;Je.add(U.id);let le={item:U.item,n:U.n,visual:!!U.visual};if(b.set(U.id,le),ce?.chegou?.(U.id))continue;let p=ge(re.rede,U);if(!p)continue;let A=No(U,p,Se),V=ce?.externo?.(U.id)??null;if(A===null&&!V)continue;if(V=ce?.seguir?.(U.id,p,A??p.L,Qt)??V,V){Q++,q.set(U.id,{agente:!0,k:V.externo?.k??0,x:V.x,z:V.z,e:V.e,curva:!!V.curva,d:A}),je(U.id,le,V.x,V.y,V.z,V.hx,V.hz,V.freio);continue}So(p,A,P);let S=ae(P.ar.tipo),H=P.curva?Qe.pista+.03:At(S,P.u),$=P.ar.ponte&&!P.curva?P.ar.cotas[0]+(P.ar.cotas[1]-P.ar.cotas[0])*P.s/P.ar.L+H-Qe.pista:(ue?ht(ue,P.x,P.z):0)+H;q.set(U.id,{agente:!1,k:P.k,x:P.x,z:P.z,e:P.ar.e,curva:P.curva,d:A}),je(U.id,le,P.x,$,P.z,P.hx,P.hz,!1)}for(let[U,le]of b){if(Je.has(U))continue;let p=ce?.externo?.(U),A=x.get(U)?.pl;if(!p||!A){b.delete(U),x.delete(U),q.delete(U),ce?.esquecer?.(U);continue}ce.seguir(U,A,A.L,Qt),Q++,je(U,le,p.x,p.y,p.z,p.hx,p.hz,p.freio)}v.forEach((U,le)=>{let p=Ve[le];if(U.mesh.count=p,U.mesh.visible=p>0,!p)return;let A=U.mesh.instanceMatrix;A.clearUpdateRanges(),A.addUpdateRange(0,p*16),A.needsUpdate=!0;for(let V of[U.cab,U.carga])V.clearUpdateRanges(),V.addUpdateRange(0,p*4),V.needsUpdate=!0})},animar(L){ne=L},preparar:()=>O,pronto:()=>!!f||h,amostras(L){Ie=L??[]},agora(L=e){let G=L.sim.espelho.tempo;return(G?.tique??0)+(G?.frac??0)+fe},estado:L=>q.get(L)??null,medidas(){let L=0;for(let G of v)L+=G.mesh.count*G.tris;return{entregas:b.size,naRua:Q,desenhados:he,tris:L}},descartar(){e.quadro?.aquecer?.delete?.(E);for(let L of v)t.remove(L.mesh),L.mesh.geometry.dispose(),L.mesh.dispose();c?.dispose()}}}function sn(e){e.registrarDominio("caminhoes",rn)}export{un as a,mn as b,dn as c,vn as d,pn as e,hn as f,gn as g,_t as h,Jo as i,_o as j,bo as k,qe as l,Tt as m,Io as n,tn as o,wo as p,No as q,So as r,cn as s};
