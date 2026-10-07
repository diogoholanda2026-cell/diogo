import{a as Le,g as Fa}from"./parte.20261007005445.L4OHTOWE.js";import{A as _e,B as pe,D as jt,F as wa,H as Ht,I as Ut,J as Na,K as La,L as Sa,S as Da,e as qe,f as Ta,g as za,s as Ca,t as tt,u as At,v as ya,w as re,x as Mt,y as it,z as be}from"./parte.20261007005445.EHLSY5RA.js";import{b as st,c as Oa}from"./parte.20261007005445.IFOKBQIX.js";import{c as ha,d as ga}from"./parte.20261007005445.LAWWW2BI.js";import{b as et}from"./parte.20261007005445.APIYTGYB.js";import{e as fa,h as da,i as va,j as pa}from"./parte.20261007005445.SWXAPY7D.js";import{b as Dt,d as ua,e as ma,h as Ft}from"./parte.20261007005445.O3C2HCXJ.js";import{f as ca,i as la}from"./parte.20261007005445.6AKE4VCT.js";import{b as gt}from"./parte.20261007005445.VMFMCTFX.js";import{B as Ma,Da as We,Ea as Ye,Ha as Bt,Ia as Va,Ja as rt,Ka as xt,La as Ia,Za as Qe,ca as Ge,ea as Ea,ga as Ne,ka as nt,o as xa,pa as Ra,sa as ba,t as Aa,ua as _a,wa as Pt,ya as ne}from"./parte.20261007005445.ZC67PPPL.js";import{a as St}from"./parte.20261007005445.P3PXPJMP.js";var $o={};St($o,{ALVO_USO_CHAO:()=>Gt,BIT_REALCE:()=>$t,LADO_TAB:()=>xe,PERFIL_VIAS:()=>Ka,Rede:()=>_t,TRECHO:()=>Wa,arestaDaSelecao:()=>Rt,criarMaterialVia:()=>Qa,criarUniformesVia:()=>Ya,desgasteDe:()=>to,geometriaAquecerVia:()=>eo,geometriaDaMalha:()=>qt,ligarChaoNoShader:()=>ao,pedidoDeSetor:()=>no,realcarAresta:()=>kt,registrar:()=>Uo,retalho:()=>oo});var se=e=>Number.isInteger(e)?`${e}.0`:`${e}`,ct=8,lt=6;function Lo(){let e=[],t=[],o=[],i=[],c=[];for(let f of it){for(let h=0;h<ct;h++){let A=f.linhas[h];e.push(A?`vec4( ${se(+A.u.toFixed(4))}, ${se(A.largura)}, ${se(A.cor)}, ${se(A.estilo)} )`:"vec4( 0.0, 0.0, 0.0, -1.0 )")}t.push(`vec2( ${se(f.tracejado[0])}, ${se(f.tracejado[1])} )`);for(let h=0;h<lt;h++)o.push(f.faixas[h]?se(+f.faixas[h].meio.toFixed(4)):"999.0");let v=h=>{let A=f.faixas.filter(_=>_.sentido===h);return A.length?[Math.min(...A.map(_=>_.u0)),Math.max(...A.map(_=>_.u1))]:[0,0]},[x,d]=v(-1),[R,V]=v(1);i.push(`vec4( ${se(x)}, ${se(d)}, ${se(R)}, ${se(V)} )`),c.push(f.meioFio?"1.0":"0.0")}let r=it.length;return`
const vec4 VIA_LINHAS[ ${r*ct} ]=vec4[ ${r*ct} ](${e.join(", ")});
const vec2 VIA_TRACO[ ${r} ]=vec2[ ${r} ](${t.join(", ")});
const float VIA_FAIXAS[ ${r*lt} ]=float[ ${r*lt} ](${o.join(", ")});
const vec4 VIA_RET[ ${r} ]=vec4[ ${r} ](${i.join(", ")});
const float VIA_SARJETA[ ${r} ]=float[ ${r} ](${c.join(", ")});
`}var So=[...Object.entries(Ca).map(([e,t])=>`#define VM_${e} ${se(t)}`),...Object.entries(be).map(([e,t])=>`#define VB_${e} ${t}`),`#define VE_CONTINUA ${se(At.CONTINUA)}`,`#define VE_TRACEJADA ${se(At.TRACEJADA)}`,`#define VE_ESTACIONAMENTO ${se(At.ESTACIONAMENTO)}`,`#define VC_AMARELA ${se(ya.AMARELA)}`,`#define VIA_TERRA ${se(it.findIndex(e=>e.terra))}`,`#define VIA_RODOVIA ${se(it.findIndex(e=>e.barreira))}`].join(`
`),Pa=`
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
`,Ba=`
vec3 objectNormal=viaOct(normal.xy);
#ifdef USE_TANGENT
vec3 objectTangent=vec3(tangent.xyz);
#endif
`,ja=`
{
vec4 gT=texelFetch(gViaTab,ivec2(int(aId % 256u),int(aId / 256u)),0);
vUV=aUV;
vDados=vec4(aDados.xyz,gT.b);
vIdent=vec4(float(aId),floor(gT.g * 255.0 + 0.5),floor(gT.r * 255.0 + 0.5),0.0);
vAO=aDados.w / 255.0;
}
`,Ha=`
{
float gVd=length(mvPosition.xyz);
mvPosition.xyz *=1.0 - min(0.02,gViaLonge.z + gViaLonge.w * gVd);
gl_Position=projectionMatrix * mvPosition;
}
`,Ua=`
#define VIA
${So}
${Lo()}
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
for(int k=0;k < ${ct};k ++){
vec4 L=VIA_LINHAS[ tipo * ${ct} + k ];
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
for(int k=0;k < ${lt};k ++){
float c=VIA_FAIXAS[ tipo * ${lt} + k ];
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
`,$a=`
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
`,ka=`
float roughnessFactor=gViaRug;
`,Ga=`
if((int(vIdent.y + 0.5)& 1)!=0)totalEmissiveRadiance +=vec3(0.25,0.2,0.08)* 0.6;
`,qa=`
#include <aomap_fragment>
reflectedLight.indirectDiffuse *=vAO;
reflectedLight.directDiffuse *=mix(1.0,vAO,0.35);
`,Za=`
#include <dithering_fragment>
if(gViaMascara > 0.5)gl_FragColor=vec4(vec3(gViaGrama),1.0);
`,rn=`
attribute float aParte;
attribute vec4 aObj;
flat varying float vParte;
flat varying vec4 vObj;
`,sn=`
vParte=aParte;
vObj=aObj;
`,cn=`
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
`,ln=`
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
`,fn=`
float roughnessFactor=gObjRug;
`,un=`
float metalnessFactor=gObjMetal;
`,mn=`
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
`;var Ka=Object.freeze({ultra:{alcance:1400,faixa:260,cache:96,envios:3,vagas:.6},alta:{alcance:900,faixa:200,cache:64,envios:2,vagas:.55},media:{alcance:560,faixa:140,cache:40,envios:1,vagas:.5},leve:{alcance:300,faixa:90,cache:20,envios:1,vagas:0}}),Wa=160,xe=256,bt=Object.freeze({k1:3e-4,k2:15e-7}),Po=new Set(["rua","ruaMao","avenida","avenidaG"]);function Te(e,t,o){if(!e.includes(t))throw new Error(`via: shader sem '${t}' (o three mudou?)`);return e.replace(t,o)}function Ya(){return{gViaTab:{value:null},gViaDetalhe:{value:null},gViaLonge:{value:new nt(300,420,bt.k1,bt.k2)},gViaCamada:{value:new nt(0,0,0,0)},gViaRampa:{value:Array.from({length:8},()=>new _a)},gViaMascara:{value:0}}}function Qa(e,t){let o=new Qe({color:16777215,roughness:.85,metalness:0});return o.name="via",o.onBeforeCompile=i=>{Object.assign(i.uniforms,t);let c=i.vertexShader;c=Te(c,"#include <common>",`#include <common>
${Pa}`),c=Te(c,"#include <beginnormal_vertex>",Ba),c=Te(c,"#include <begin_vertex>",`#include <begin_vertex>
${ja}`),c=Te(c,"#include <project_vertex>",`#include <project_vertex>
${Ha}`);let r=i.fragmentShader;r=Te(r,"#include <common>",`#include <common>
${Ua}`),r=Te(r,"#include <color_fragment>",$a),r=Te(r,"#include <roughnessmap_fragment>",ka),r=Te(r,"#include <emissivemap_fragment>",`#include <emissivemap_fragment>
${Ga}`),r=Te(r,"#include <aomap_fragment>",qa),r=Te(r,"#include <dithering_fragment>",Za),i.vertexShader=c,i.fragmentShader=r},o.customProgramCacheKey=()=>"via-1",o.userData.via=!0,e.aplicar(o,e.nomes().filter(i=>i!=="camada"))}function eo(){return qt({atributos:{posicao:new Int16Array(9),normal:new Int8Array(6),uv:new Float32Array(12),dados:new Uint8Array(12),id:new Uint32Array(3)},indices:new Uint16Array([0,1,2])})}function Bo(){this.array={byteLength:this.array.byteLength,length:this.array.length}}function qt(e,{soltar:t=!1}={}){let o=new Ye,i=(f,v,x)=>{let d=new ne(f,v,x);return t&&d.onUpload(Bo),d};if(e.atributos){let f=e.atributos;return o.setAttribute("position",i(f.posicao,3,!0)),o.setAttribute("normal",i(f.normal,2,!0)),o.setAttribute("aUV",i(f.uv,4,!1)),o.setAttribute("aDados",i(f.dados,4,!1)),o.setAttribute("aId",i(f.id,1,!1)),o.setIndex(i(e.indices,1,!1)),o.boundingSphere=new We(new Ne,Math.sqrt(3)*1.01),o.boundingBox=new Pt(new Ne(-1.01,-1.01,-1.01),new Ne(1.01,1.01,1.01)),o}let c=e.nv,r=new Int8Array(c*2);for(let f=0;f<c;f++){let v=e.nor[3*f],x=e.nor[3*f+1],d=e.nor[3*f+2],R=Math.abs(v)+Math.abs(x)+Math.abs(d)||1,V=v/R,h=d/R;if(x<0){let A=(1-Math.abs(h))*(V>=0?1:-1),_=(1-Math.abs(V))*(h>=0?1:-1);V=A,h=_}r[2*f]=Math.round(V*127),r[2*f+1]=Math.round(h*127)}return o.setAttribute("position",new ne(e.pos.slice(0,c*3),3)),o.setAttribute("normal",new ne(r,2,!0)),o.setAttribute("aUV",new ne(e.uv.slice(0,c*4),4)),o.setAttribute("aDados",new ne(e.dados.slice(0,c*4),4)),o.setAttribute("aId",new ne(e.id.slice(0,c),1)),o.setIndex(new ne(e.idx.slice(0,e.ni),1)),o.computeBoundingSphere(),o}var $t=1;function kt(e,t,o){let i=e.length/4;return t>=0&&t<i&&(e[4*t+1]&=~$t),o>=0&&o<i&&(e[4*o+1]|=$t),o>=0&&o<i?o:-1}function Rt(e,t){if(!e||e.tipo!=="aresta"||!Number.isFinite(e.ref)||!t)return-1;let o=va(e.ref);return o<t.n&&t.viva[o]&&t.ger[o]===pa(e.ref)?o:-1}function to(e,t,o){if(!e)return .45+.4*pe(o,97);let i=Math.max(0,t-e)/7200;return Math.min(1,.08+.3*i)}function jo(e,t,o,i){if(i&Dt.ARCOLOGIA)return!0;for(let r of e.areas??[])if(r.id==="orla"&&r.contorno&&fa(t,o,r.contorno))return!0;let c=e.terreno;if(!c?.agua)return!1;for(let r=0;r<12;r++){let f=r*Math.PI/6;for(let v of[120,250]){let x=t+Math.cos(f)*v,d=o+Math.sin(f)*v,R=Math.round((x-c.origem[0])/c.passo),V=Math.round((d-c.origem[1])/c.passo);if(R>=0&&V>=0&&R<c.n&&V<c.n&&c.agua[V*c.n+R]===ma.MAR)return!0}}return!1}var _t=class{constructor(t){this.grade=t,this.arestas=new Map,this.nos=new Map,this.versao=0}bracos(t,o){let i=t.vias.nos,c=[];for(let r=0;r<6;r++){let f=i.lig[6*o+r];if(f<0)continue;let v=this.arestas.get(f);v&&c.push({e:f,tipo:v.tipo,p:v.p,tab:v.tab,inverte:v.b===o&&v.a!==o,marcas:v.pedra?be.PEDRA:0,ponte:v.ponte,cotas:v.cotas})}return c}lerAresta(t,o){let i=t.vias.arestas,c=this.arestas.get(o),r=new Set(c?c.trechos.map(V=>V[2]):[]);if(o>=i.n||!i.viva[o])return this.arestas.delete(o),{sujos:r,nos:c?[c.a,c.b]:[]};let f=Float64Array.from(i.p.subarray(8*o,8*o+8)),v=ca(f),x=i.flags[o],d=_e(f,v,v[16]/2),R={e:o,tipo:i.tipo[o],p:f,tab:v,L:v[16],a:i.a[o],b:i.b[o],mao:i.mao[o],flags:x,idade:i.idade[o],ger:i.ger[o],ponte:!!(x&Dt.PONTE),cotas:[i.y[2*o],i.y[2*o+1]],pedra:c&&c.p.every((V,h)=>V===f[h])?c.pedra:jo(t,d.x,d.z,x),cIni:0,cFim:0,marcas:0,trechos:[]};return this.arestas.set(o,R),{sujos:r,nos:[R.a,R.b,...c?[c.a,c.b]:[]]}}lerNo(t,o){let i=t.vias.nos,c=this.nos.get(o),r=new Set(c?[c.setor]:[]);if(o>=i.n||!i.viva[o])return this.nos.delete(o),{sujos:r,arestas:[]};let f=this.bracos(t,o),v=i.x[o],x=i.z[o],d=this.grade.indice(v,x);if(r.add(d),!f.length)return this.nos.delete(o),{sujos:r,arestas:[]};let R=wa({n:o,x:v,z:x,bracos:f}),V=R.tipo==="cruzamento"&&R.bracos.length>=3,h=V&&R.bracos.some(A=>A.P.id==="avenida"||A.P.id==="avenidaG")&&!R.bracos.some(A=>A.P.id==="rodovia");return this.nos.set(o,{n:o,x:v,z:x,tipo:R.tipo,setor:d,analise:R,zebra:V,semaforos:h}),{sujos:r,arestas:R.bracos.map(A=>A.e)}}fecharAresta(t){let o=this.arestas.get(t);if(!o)return[];let i=(h,A)=>this.nos.get(h)?.analise.bracos.find(_=>_.e===t&&_.inverte===A)?.corte??0;o.cIni=i(o.a,!1),o.cFim=i(o.b,!0);let c=re(o.tipo),r=o.pedra?be.PEDRA:0,f=this.nos.get(o.a),v=this.nos.get(o.b);if(Po.has(c.id)){let h=o.mao===0?-1:-o.mao,A=o.mao===0?1:o.mao,_=(G,q)=>G<0?q?be.RET_INI_A:be.RET_FIM_A:q?be.RET_INI_B:be.RET_FIM_B;f?.zebra&&(r|=be.ZEBRA_INI|(o.mao===Ft.AB?0:_(h,!0))),v?.zebra&&(r|=be.ZEBRA_FIM|(o.mao===Ft.BA?0:_(A,!1)))}o.marcas=r,o.tampaIni=f?.tipo==="cruzamento",o.tampaFim=v?.tipo==="cruzamento";let x=o.cIni,d=o.L-o.cFim,R=Math.max(1,Math.ceil((d-x)/Wa));o.trechos=[];let V={x:0,z:0,tx:1,tz:0,t:0};for(let h=0;h<R;h++){let A=x+(d-x)*h/R,_=x+(d-x)*(h+1)/R;_e(o.p,o.tab,(A+_)/2,V),o.trechos.push([A,_,this.grade.indice(V.x,V.z)])}return o.trechos.map(h=>h[2])}tudo(t){let o=t.vias?.arestas,i=t.vias?.nos,c=new Set([...this.arestas.values()].flatMap(r=>r.trechos.map(f=>f[2])));for(let r of this.nos.values())c.add(r.setor);if(this.arestas.clear(),this.nos.clear(),!o||!i)return c;for(let r=0;r<o.n;r++)o.viva[r]&&this.lerAresta(t,r);for(let r=0;r<i.n;r++)i.viva[r]&&this.lerNo(t,r);for(let r of this.arestas.keys())for(let f of this.fecharAresta(r))c.add(f);for(let r of this.nos.values())c.add(r.setor);return this.versao++,c}tocar(t,o,i){let c=new Set,r=new Set(i);for(let v of o){let x=this.lerAresta(t,v);for(let d of x.sujos)c.add(d);for(let d of x.nos)r.add(d)}let f=new Set;for(let v of r){let x=this.lerNo(t,v);for(let d of x.sujos)c.add(d);for(let d of x.arestas)f.add(d)}for(let v of o)f.add(v);for(let v of f){let x=this.arestas.get(v);if(x){for(let d of x.trechos)c.add(d[2]);for(let d of this.fecharAresta(v))c.add(d)}}return this.versao++,c}},Gt=/vec4\s+tUso\s*=\s*texture\s*\(\s*uTerUso\s*,\s*tUVM\s*\)\s*;/;function ao(e){return!Gt.test(e)||!e.includes("#include <common>")?null:e.replace("#include <common>",`#include <common>
uniform vec2 uViaPerto;`).replace(Gt,t=>`${t}
tUso.r *= smoothstep( uViaPerto.x, uViaPerto.y, vTer.z );`)}function Ja(e){let t=e.chao?.malha?.material;if(!t||t.userData.viaLigada)return t?.userData.viaUniformes??null;let o={uViaPerto:{value:new Ea(0,1)}},i=t.onBeforeCompile;t.onBeforeCompile=(r,f)=>{i?.call(t,r,f);let v=ao(r.fragmentShader);if(!v){console.warn("vias: o chão não tem o uso do solo esperado; a pintura da via fica perto da câmera");return}Object.assign(r.uniforms,o),r.fragmentShader=v};let c=t.customProgramCacheKey?.bind(t);return t.customProgramCacheKey=()=>`${c?c():""}|viaPerto`,t.userData.viaLigada=!0,t.userData.viaUniformes=o,t.needsUpdate=!0,o}var ft={x:0,z:0,tx:1,tz:0,t:0},Et=()=>typeof performance<"u"?performance.now():Date.now();function oo(e,t,o,i,c){let r=Math.max(0,Math.floor((t-e.origem[0])/e.passo)),f=Math.max(0,Math.floor((o-e.origem[1])/e.passo)),v=Math.min(e.n-1,Math.ceil((i-e.origem[0])/e.passo)),x=Math.min(e.n-1,Math.ceil((c-e.origem[1])/e.passo)),d=Math.max(2,Math.max(v-r,x-f)+1),R=new Float32Array(d*d);for(let V=0;V<d;V++){let h=Math.min(e.n-1,f+V);for(let A=0;A<d;A++)R[V*d+A]=e.altura[h*e.n+Math.min(e.n-1,r+A)]}return{ox:e.origem[0]+r*e.passo,oz:e.origem[1]+f*e.passo,n:d,passo:e.passo,altura:R}}function no(e,t,o,i=0){let c=[],r=t.x0,f=t.z0,v=t.x0+qe,x=t.z0+qe;for(let h of e.arestas.values())for(let[A,_,G]of h.trechos){if(G!==t.s)continue;c.push({e:h.e,tipo:h.tipo,p:Array.from(h.p),sIni:h.cIni,sFim:h.L-h.cFim,s0:A,s1:_,marcas:h.marcas,ponte:h.ponte,cotas:h.cotas,tampaIni:h.tampaIni,tampaFim:h.tampaFim,mao:h.mao});let q=re(h.tipo).meia+4,te=Math.max(2,Math.ceil((_-A)/8)+1);for(let ee=0;ee<te;ee++)_e(h.p,h.tab,A+(_-A)*ee/(te-1),ft),r=Math.min(r,ft.x-q),v=Math.max(v,ft.x+q),f=Math.min(f,ft.z-q),x=Math.max(x,ft.z+q)}let d=[];for(let h of e.nos.values()){if(h.setor!==t.s||h.tipo==="reto")continue;d.push({n:h.n,x:h.x,z:h.z,semaforos:h.semaforos,bracos:h.analise.bracos.map(_=>({e:_.e,tipo:_.tipo,p:Array.from(_.p),inverte:_.inverte,marcas:_.marcas,ponte:_.ponte,cotas:_.cotas}))});let A=Math.max(60,...h.analise.bracos.map(_=>_.corte+_.P.meia+4));r=Math.min(r,h.x-A),v=Math.max(v,h.x+A),f=Math.min(f,h.z-A),x=Math.max(x,h.z+A)}let R=o.terreno,V=R?oo(R,r-16,f-16,v+16,x+16):null;return{dados:{setor:t.s,versao:t.versao,ox:t.x0,oz:t.z0,chao:V,arestas:c,nos:d,vagas:i},transferir:V?[V.altura.buffer]:[]}}function Ho(e){let{cena:t,medidas:o}=e,i=e.sim.espelho,c=new Ta({tam:i.mapa?.tam??8192,origem:i.mapa?.origem??[-4096,-4096]}),r=Da(e),f=new _t(c),v=Ya();v.gViaDetalhe.value=e.textura("via.detalhe");let x=new Uint8Array(xe*xe*4),d=new Va(x,xe,xe,Ma,Aa);d.magFilter=d.minFilter=xa,d.generateMipmaps=!1,d.name="vias:tabela",v.gViaTab.value=d;let R=typeof location<"u"&&new URLSearchParams(location.search).get("passe")==="mascara";v.gViaMascara.value=R?1:0;let V=Qa(e.ganchos,v),h=new Bt(eo(),V);h.name="vias:aquecer",h.receiveShadow=!0,e.quadro?.aquecer?.add?.(h);let A=Ja(e),_=new Map,G=[],q=-1,te=null,ee=0,Ee=!1,de=0,Ve=0,K=0,D=0,Ae=0,he=0,w=null,U=new Ia,ce=new Ra,Q=new Pt,ae=()=>et(Ka,e.perfil),Me=p=>{let g=_.get(p);if(!g){let[H,N]=c.canto(p);g={s:p,x0:H,z0:N,versao:1,pedido:0,malha:null,objetos:null,estacionados:null,usado:0,dist:1/0,ymin:-5,ymax:60,caixa:null},_.set(p,g)}return g},fe=p=>{for(let g of p)g>=0&&Me(g).versao++};function Y(p,g){if(g>=xe*xe)return;let H=f.arestas.get(g),N=4*g;x[N+2]=H?Math.round(to(H.idade,p.tempo?.tique??0,g)*255):0,d.needsUpdate=!0}function Ce(p,g){let H=g.vias?.arestas;if(!H||!g.vias?.nos)return;q>=0&&Rt(te,H)!==q&&(q=kt(x,q,Rt(te,H)),d.needsUpdate=!0);let N=!Ee||st(p,"vias")||st(p,"arestas")||st(p,"nos");if(Ee=!0,N){fe(f.tudo(g));for(let C=0;C<Math.min(H.cap,xe*xe);C++)Y(g,C)}else if(p.arestas?.length||p.nos?.length){fe(f.tocar(g,p.arestas??[],p.nos??[]));for(let C of p.arestas??[])Y(g,C)}let S=g.tempo?(g.tempo.ano??0)*12+(g.tempo.mes??0):null;if(S!==w){if(w!==null&&!N)for(let C of f.arestas.keys())Y(g,C);w=S}let Z=st(p,"terreno")?[[-1e9,-1e9,1e9,1e9]]:p.terreno??[];if(Z.length&&!N)for(let C of _.values()){let ge=C.x0+qe,O=C.z0+qe;Z.some(L=>L[0]<=ge+100&&L[2]>=C.x0-100&&L[1]<=O+100&&L[3]>=C.z0-100)&&C.versao++}}let je=p=>no(f,p,e.sim.espelho,ae().vagas);function Ke(p){let g=p.versao;p.pedido=g,ee++;let{dados:H,transferir:N}=je(p);if(!H.arestas.length&&!H.nos.length){ee--,G.push({st:p,r:{malhas:[],objetos:null,estacionados:[]},versao:g});return}let S=Et();r.pedir("vias",H,{chave:p.s,transferir:N}).then(Z=>{ee--,Ae+=Et()-S,he++,G.push({st:p,r:Z,versao:g})})}function He(p){p.malha&&(t.remove(p.malha.mesh),p.malha.mesh.geometry.dispose(),Ve-=p.malha.bytes,K--,p.malha=null)}function Ue(p){let g=0;for(let H=0;H<G.length;){let{st:N,r:S,versao:Z}=G[H];if(S.erro){N.erro=Z,G.splice(H,1);continue}if(g>=p)break;if(G.splice(H,1),N.malha&&N.malha.versao>Z)continue;He(N);let C=S.malhas?.[0];if(N.objetos=S.objetos??null,N.estacionados=S.estacionados??[],D++,!C){N.malha={mesh:new ba,versao:Z,bytes:0,tris:0},K++;continue}let ge=qt(C,{soltar:!0}),O=new Bt(ge,V),[L,oe,ve,ye]=C.escala;O.position.set(N.x0+L,oe,N.z0+ve),O.scale.setScalar(ye),O.matrixAutoUpdate=!1,O.updateMatrix(),O.name=`vias:${N.s}`,O.receiveShadow=!0,o.familia(O,"vias"),t.add(O);let Ie=C.indices.byteLength;for(let Oe of Object.values(C.atributos))Ie+=Oe.byteLength;N.malha={mesh:O,versao:Z,bytes:Ie,tris:C.tris},N.ymin=N.y0=C.caixa[1],N.ymax=C.caixa[4],N.caixa=[N.x0+C.caixa[0],C.caixa[1],N.z0+C.caixa[2],N.x0+C.caixa[3],C.caixa[4],N.z0+C.caixa[5]],Ve+=Ie,K++,g++}}function Re({envios:p=ae().envios,pedidos:g=r.worker?3:1}={}){de++,Ue(p);let H=ae(),N=e.camera;N.updateMatrixWorld(),ce.multiplyMatrices(N.projectionMatrix,N.matrixWorldInverse),U.setFromProjectionMatrix(ce);let S=N.position,Z=[],C=0,ge=0;for(let O of _.values()){let L=O.caixa??[O.x0,O.ymin,O.z0,O.x0+qe,O.ymax,O.z0+qe];O.dist=za(S.x,S.y,S.z,L[0],L[1],L[2],L[3],L[4],L[5]);let oe=O.dist<H.alcance;if(oe&&O.pedido!==O.versao&&O.erro!==O.versao&&(!O.malha||O.malha.versao<O.versao)&&Z.push(O),O.malha){Q.min.set(L[0],L[1]-1,L[2]),Q.max.set(L[3],L[4]+1,L[5]);let ve=oe&&U.intersectsBox(Q);O.malha.mesh.visible=ve,oe&&(O.usado=de),ve&&(C++,ge+=O.malha.tris)}}Z.sort((O,L)=>O.dist-L.dist);for(let O of Z){if(ee>=g)break;Ke(O)}if(K>H.cache){let O=[..._.values()].filter(L=>L.malha&&L.dist>=H.alcance).sort((L,oe)=>L.usado-oe.usado);for(let L of O){if(K<=H.cache)break;He(L),L.objetos=null,L.estacionados=null,L.pedido=0,D++}}return{vis:C,tris:ge}}function $e(){let p=ae(),g=p.alcance-p.faixa;v.gViaLonge.value.set(g-160,g,bt.k1,bt.k2),A&&A.uViaPerto.value.set(g-120,g-40)}let ke=[e.ouvir("qualidade",()=>{A=Ja(e)}),e.ouvir("selecao",p=>{te=p??null,q=kt(x,q,Rt(te,e.sim.espelho.vias?.arestas)),d.needsUpdate=!0}),e.ouvir("camadas",p=>{let g=e.sim.espelho.vias?.arestas,H=!!(p&&p.fonte==="arestas"&&p.dados&&g),N=g?Math.min(g.n,xe*xe):0;for(let S=0;S<xe*xe;S++){let Z=0;if(H&&S<N){let C=p.dados[S];Number.isFinite(C)&&(Z=p.categorico?Math.max(0,Math.min(7,Math.round(C))):1+Math.round(Math.min(1,Math.max(0,(C-(p.min??0))/((p.max??1)-(p.min??0)||1)))*254))}x[4*S]=Z}d.needsUpdate=!0,v.gViaCamada.value.set(p?1:0,Math.min(8,p?.cores?.length??0),p?.categorico?1:0,0),(p?.cores??[]).slice(0,8).forEach((S,Z)=>v.gViaRampa.value[Z].set(S).convertSRGBToLinear())})];function $(p,g){let N=g.sim.espelho.vias?.arestas;if(!N)return null;let S=Number.isFinite(p.xTela)?g.raio(p.xTela,p.yTela):null;if(!S)return null;let Z={t:0,d:0,x:0,z:0},C=null;for(let O of f.arestas.values()){let L=re(O.tipo),oe=1/0,ve=-1/0,ye=1/0,Ie=-1/0;for(let Oe=0;Oe<4;Oe++)oe=Math.min(oe,O.p[2*Oe]),ve=Math.max(ve,O.p[2*Oe]),ye=Math.min(ye,O.p[2*Oe+1]),Ie=Math.max(Ie,O.p[2*Oe+1]);S[0]<oe-L.meia||S[0]>ve+L.meia||S[2]<ye-L.meia||S[2]>Ie+L.meia||(la(O.p,S[0],S[2],0,Z),Z.d<=L.meia+.3&&(!C||Z.d<C.d)&&(C={e:O.e,d:Z.d}))}if(!C)return null;let ge=p.origem;return{tipo:"aresta",idx:C.e,ref:da(C.e,N.ger[C.e]),ponto:S,dist:Math.hypot(S[0]-ge[0],S[1]-ge[1],S[2]-ge[2])}}function le(){if(ee||G.length)return!1;let p=ae();for(let g of _.values())if(g.dist<p.alcance&&g.erro!==g.versao&&(!g.malha||g.malha.versao<g.versao))return!1;return!0}let X={nome:"vias",material:V,tabela:d,uniformes:v,rede:f,grade:c,aplicar:Ce,quadro(p,g){$e(g),Re()},selecionar:$,pronto:le,get versaoObjetos(){return D},*setoresPerto(p=1/0){for(let g of _.values())g.malha&&g.objetos&&g.dist<p&&(yield g)},async preparar({teto:p=12e4}={}){let g=Et();for(e.cameraApi?.atualizar?.(g),Ee||Ce(e.sim.mudancas.desde(-1),e.sim.espelho),$e(e);Et()-g<p&&(Re({envios:64,pedidos:r.worker?6:2}),!le());)r.worker?await new Promise(H=>setTimeout(H,20)):(r.rodarLocal(4),await Promise.resolve());return Re({envios:64}),X.medidas()},medidas(){let p=0,g=0;for(let H of _.values())H.malha?.mesh.visible&&(p++,g+=H.malha.tris);return{setores:_.size,malhas:K,visiveis:p,tris:g,memoriaMB:+(Ve/1048576).toFixed(2),arestas:f.arestas.size,nos:f.nos.size,msPedidoMedio:he?+(Ae/he).toFixed(1):0}},gerarAgora(p){return Sa(je(Me(p)).dados)},descartar(){for(let p of ke)p?.();e.quadro?.aquecer?.delete?.(h),h.geometry.dispose();for(let p of _.values())He(p);d.dispose(),V.dispose()}};return X}function Uo(e){e.registrarDominio("vias",Ho),e.registrarSelecionavel("aresta",(t,o)=>o.dominio("vias")?.selecionar?.(t,o)??null,{prioridade:Oa.mundo})}var Ko={};St(Ko,{A_MAX:()=>Xt,A_PLANO:()=>Ot,BASE_TIPO:()=>Yt,CARRO_GLSL:()=>Mo,DENSIDADE_MAX:()=>lo,DESISTE:()=>vo,FOLGA_FILA:()=>vt,LIMPEZA:()=>ho,PARADA:()=>mt,PERFIL_TRAFEGO:()=>co,VERMELHO:()=>po,V_NO:()=>It,criarMaterialCarro:()=>Eo,curvaEntre:()=>Ct,densidade:()=>uo,densidadeFluxo:()=>mo,distPoligonais:()=>Ao,distanciaNaFila:()=>Go,faixaDestino:()=>Wt,faixasOrdenadas:()=>Fe,faseSemaforo:()=>go,fatorHora:()=>Qt,fatorZona:()=>fo,fimDaFaixa:()=>ze,inicioDaFaixa:()=>De,matrizGiroY:()=>zt,naFaixa:()=>Pe,pesoDistancia:()=>Kt,pontoCurva:()=>Xe,registrar:()=>Xo,restaVermelho:()=>xo,velSegura:()=>dt,virada:()=>Tt});var co=Object.freeze({ultra:{carros:400,estacionados:500,raio:700,lod0:130,parados:450},alta:{carros:240,estacionados:300,raio:500,lod0:95,parados:320},media:{carros:120,estacionados:160,raio:360,lod0:70,parados:230},leve:{carros:50,estacionados:0,raio:220,lod0:40,parados:0}}),Yt=Object.freeze({rua:.45,ruaMao:.5,avenida:1.1,avenidaG:1.35,rodovia:1.3,terra:.08}),ko=Object.freeze({res:1,com:2.2,esc:2.6,ind:1.5}),lo=9;function Qt(e){let t=(o,i)=>Math.exp(-(((e-o+36)%24-12)**2)/(2*i*i));return Math.min(1,.1+.9*Math.max(t(7.5,1.4),.95*t(18,1.8),.6*t(12.5,2.4),.45*t(15,3)))}function fo(e,t){let o=0;for(let[c,r]of Object.entries(e??{}))o+=(ko[c]??1)*r;let i=Math.max(1,t/8*2);return .4+Math.min(1.8,1.4*o/i)}function uo(e,t,o,i){let c=re(e).id;return(Yt[c]??.3)*Qt(t)*fo(o,i)}function mo(e,t,o,i,c){if(!(t>0)||!(o>0))return 0;let r=Math.max(5,re(e).velocidade*Math.max(.15,Math.min(1,i||1)));return Math.min(lo,t/o/r*Qt(c)/10)}var mt=7.3,vt=2,Ot=3,Xt=7,It=Object.freeze({cruzamento:7,curva:10,retorno:5}),ro=45,ot=8,Kt=(e,t)=>e<=.3*t?1:Math.max(.2,1-.8*(e-.3*t)/(.7*t)),vo=50,Go=(e,t)=>(Le[e].c+Le[t].c)/2+vt,so=(e,t)=>(e.c+t.c)/2+vt,dt=(e,t=0)=>Math.sqrt(Math.max(0,2*Ot*e+.6*t*t)),po=21,ho=3;function go(e,t,o){let i=((e+o*.16)%40+40)%40,c=t<.5?i:(i+20)%40;return c<16?0:c<19?1:2}function xo(e,t,o){let i=((e+o*.16)%40+40)%40,c=t<.5?i:(i+20)%40;return c>=19?40-c:0}function Tt(e,t,o,i){let c=Math.atan2(e*i-t*o,e*o+t*i);return Math.abs(c)<.61?0:c>0?1:-1}var io=new Map;function Fe(e,t,o){let i=`${e}:${t}:${o}`,c=io.get(i);return c||(c=jt(e,t).filter(r=>r.sentido===o).sort((r,f)=>r.u*o-f.u*o),io.set(i,c)),c}function Wt(e,t,o,i,c=!1,r=null){return e.length?i>0||i===0&&c?e[e.length-1]:i<0?e[0]:o<=1?r===null?e[e.length-1]:e[Math.min(e.length-1,Math.floor(r*e.length))]:e[Math.round(t/(o-1)*(e.length-1))]:null}function Vt(e,t,o,i,c,r){let f=c-o,v=r-i,x=f*f+v*v,d=x>0?Math.max(0,Math.min(1,((e-o)*f+(t-i)*v)/x)):0,R=e-o-d*f,V=t-i-d*v;return R*R+V*V}function qo(e,t,o,i,c,r,f,v){let x=o-e,d=i-t,R=f-c,V=v-r,h=e-c,A=t-r,_=x*V-d*R;if(Math.abs(_)>1e-12){let G=(R*A-V*h)/_,q=(x*A-d*h)/_;if(G>=0&&G<=1&&q>=0&&q<=1)return 0}return Math.min(Vt(e,t,c,r,f,v),Vt(o,i,c,r,f,v),Vt(c,r,e,t,o,i),Vt(f,v,e,t,o,i))}function Ao(e,t,o,i,c=0,r=1/0){let f=1/0,v=c*c,x=e.length/2-1,d=Math.min(o.length/2-1,r);for(let R=t;R<x;R++)for(let V=i;V<d;V++){let h=qo(e[2*R],e[2*R+1],e[2*R+2],e[2*R+3],o[2*V],o[2*V+1],o[2*V+2],o[2*V+3]);if(h<f&&(f=h,f<v))return Math.sqrt(f)}return Math.sqrt(f)}function Xe(e,t,o){let i=1-t,c=i*i*i,r=3*i*i*t,f=3*i*t*t,v=t*t*t;o.x=c*e[0]+r*e[2]+f*e[4]+v*e[6],o.z=c*e[1]+r*e[3]+f*e[5]+v*e[7];let x=3*i*i*(e[2]-e[0])+6*i*t*(e[4]-e[2])+3*t*t*(e[6]-e[4]),d=3*i*i*(e[3]-e[1])+6*i*t*(e[5]-e[3])+3*t*t*(e[7]-e[5]),R=Math.sqrt(x*x+d*d)||1;return o.hx=x/R,o.hz=d/R,o}function zt(e,t,o,i,c,r,f,v=1){let x=Math.sqrt(r*r+f*f),d=x>1e-9?r/x*v:0,R=x>1e-9?f/x*v:v;e[t]=R,e[t+1]=0,e[t+2]=-d,e[t+3]=0,e[t+4]=0,e[t+5]=v,e[t+6]=0,e[t+7]=0,e[t+8]=d,e[t+9]=0,e[t+10]=R,e[t+11]=0,e[t+12]=o,e[t+13]=i,e[t+14]=c,e[t+15]=1}function ut(e,t){e.x=t.x,e.z=t.z,e.hx=t.hx,e.hz=t.hz}var Ze={x:0,z:0,tx:1,tz:0,t:0};function Pe(e,t,o,i,c){return _e(e.p,e.tab,o,Ze),c.x=Ze.x-Ze.tz*t,c.z=Ze.z+Ze.tx*t,c.hx=Ze.tx*i,c.hz=Ze.tz*i,c}var ze=(e,t)=>t>0?e.L-e.cFim:e.cIni,De=(e,t)=>t>0?e.cIni:e.L-e.cFim,ie={x:0,z:0,hx:1,hz:0},me={x:0,z:0,hx:1,hz:0};function Ct(e,t,o,i,c,r,f=!1){Pe(e,t,ze(e,o),o,ie),Pe(i,c,De(i,r),r,me);let v=Math.hypot(me.x-ie.x,me.z-ie.z),x=f?Math.max(3,v*.9):v*.42,d=[ie.x,ie.z,ie.x+ie.hx*x,ie.z+ie.hz*x,me.x-me.hx*x,me.z-me.hz*x,me.x,me.z],R=Math.hypot(d[2]-d[0],d[3]-d[1])+Math.hypot(d[4]-d[2],d[5]-d[3])+Math.hypot(d[6]-d[4],d[7]-d[5]),V=new Float64Array(2*(ot+1)),h={x:0,z:0,hx:0,hz:0};for(let _=0;_<=ot;_++)Xe(d,_/ot,h),V[2*_]=h.x,V[2*_+1]=h.z;let A=Math.abs(Math.atan2(ie.hx*me.hz-ie.hz*me.hx,ie.hx*me.hx+ie.hz*me.hz));return{p:d,L:Math.max(1,(v+R)/2),poli:V,vir:f?0:Tt(ie.hx,ie.hz,me.hx,me.hz),ang:f?Math.PI:A}}function Zo(e,t,o){return(e==="avenida"||e==="avenidaG")&&t<.06?4:t<.06+(e==="rodovia"?.1:0)+.12*o?5:Ut([[0,.34],[1,.26],[2,.24],[3,.16]],pe(Math.floor(t*1e6),7))}var Zt=Ht.map(([e])=>{let t=parseInt(e.slice(1),16);return[t>>16&255,t>>8&255,t&255]});function Je(e,t,o){if(!e.includes(t))throw new Error(`carro: shader sem '${t}'`);return e.replace(t,o)}var Mo=Object.freeze({verticePars:`
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
`});function Eo(e,t){let o=new Qe({color:16777215,roughness:.4,metalness:0});o.name="carro";let i=Mo;return o.onBeforeCompile=c=>{Object.assign(c.uniforms,t);let r=c.vertexShader;r=Je(r,"#include <common>",`#include <common>
${i.verticePars}`),r=Je(r,"#include <begin_vertex>",`#include <begin_vertex>
${i.vertice}`);let f=c.fragmentShader;f=Je(f,"#include <common>",`#include <common>
${i.fragmentoPars}`),f=Je(f,"#include <color_fragment>",i.cor),f=Je(f,"#include <roughnessmap_fragment>",i.rugosidade),f=Je(f,"#include <metalnessmap_fragment>",i.metal),f=Je(f,"#include <emissivemap_fragment>",`#include <emissivemap_fragment>
${i.emissivo}`),c.vertexShader=r,c.fragmentShader=f},o.customProgramCacheKey=()=>"carro-2",e.aplicar(o,e.nomes().filter(c=>c!=="camada"))}var Se=(e,t,o)=>(e*1024+Math.round(t*8)+512)*2+(o>0?1:0);function at(e,t){let o=e.get(t);return o||e.set(t,o=[]),o}function Jt(e,t){if(t)e.clear();else for(let o of e.values())o.length=0}function Jo(e){let{cena:t,medidas:o}=e,i={gCarroNoite:{value:0}},c=Eo(e.ganchos,i),r=()=>et(co,e.perfil),f=[];function v(){for(let l of f)t.remove(l.mesh),l.mesh.geometry.dispose(),l.mesh.dispose();f.length=0;let n=r(),a=Math.max(16,n.carros+n.estacionados);Le.forEach((l,m)=>{for(let u of[0,1]){let E=Fa(m,u),M=new Ye;M.setAttribute("position",new ne(E.posicao,3)),M.setAttribute("normal",new ne(E.normal,3)),M.setAttribute("aParte",new ne(Float32Array.from(E.parte),1)),M.setIndex(new ne(E.indices,1));let I=new rt(new Uint8Array(a*4),4,!1);I.setUsage(Ge),M.setAttribute("aCarro",I),M.boundingSphere=new We(new Ne,1e7);let s=new xt(M,c,a);s.instanceMatrix.setUsage(Ge),s.frustumCulled=!1,s.count=0,s.visible=!1,s.name=`carros:${Le[m].id}:${u}`,o.familia(s,"vida"),t.add(s),f.push({mi:m,lod:u,mesh:s,cor:I,cap:a,tris:E.tris})}})}v();let x=e.perfil.id,d=[],R=new Map,V=new Set,h=[],A=0,_=0,G=null,q=-1e9,te=null,ee=!0,Ee=-1,de=1,Ve=null,K=new Ne,D={x:0,z:0,tx:1,tz:0,t:0},Ae=new Map,he=new Map,w=new Map,U=[],ce=0,Q=0,ae=0;function Me(n){let a=n.celulas,l=new Map;if(!a)return l;for(let m=0;m<a.n;m++){if(!a.viva[m]||a.estado[m]!==ua.OCUPADA||!a.zona[m])continue;let u=ha[ga[a.zona[m]]]?.familia;if(!u)continue;let E=a.aresta[m],M=l.get(E);M||l.set(E,M={}),M[u]=(M[u]??0)+1}return l}function fe(n,a,l,m){if(!n?.ida||a.e>=n.ida.length)return null;let u=l>0?n.ida[a.e]:n.volta?.[a.e]??0;return!(u>0)&&!m(-l)&&(u=l>0?n.volta?.[a.e]??0:n.ida[a.e]),{q:u||0,vel:n.vel?.[a.e]??1}}function Y(n,a,l){let m=r().raio,u=l?.fluxos??null;h=[],A=0;for(let s of n.rede.arestas.values()){let F=s.L-s.cIni-s.cFim;if(F<12)continue;_e(s.p,s.tab,s.L/2,D);let z=Math.hypot(D.x-K.x,D.z-K.z);if(z>m+s.L/2)continue;let T=jt(s.tipo,s.mao);if(!T.length)continue;let b={1:0,"-1":0};for(let P of T)b[P.sentido]++;let k=P=>b[P]>0,j=(te?.get(s.e)?.ind??0)/Math.max(1,F/8),B=T.map(P=>{let J=u?fe(u,s,P.sentido,k):null;return(J?mo(s.tipo,J.q,b[P.sentido],J.vel,a):uo(s.tipo,a,te?.get(s.e),s.L))*F/100}),y=B.reduce((P,J)=>P+J,0);y<=0||(h.push({ar:s,faixas:T,pesos:B,w:y,ind:j,g:Kt(z,m),ws:0}),A+=y)}let E=Math.min(r().carros,A),M=0;for(let s of h)M+=s.w*s.g;let I=M>=E||A<=M?0:(E-M)/(A-M);_=0;for(let s of h)s.ws=s.w*(s.g+I*(1-s.g)),_+=s.ws;G=K.clone()}function Ce(n,a,l){let m=U[ce];m||U.push(m={c:null,pos:0}),ce++,m.c=a,m.pos=l,at(Ae,n).push(m)}function je(n,a,l,m,u,E=0){let M=Ae.get(Se(n.e,a,l));if(!M)return!0;let I=m*l;for(let s of M)if(Math.abs(s.pos-I)<(u+s.c.c)/2+vt+E)return!1;return!0}function Ke(n,a,l,m,{c:u=Le[m].c,l:E=Le[m].l,vMax:M,cor:I,externo:s=null}={}){let F=de++,z=re(n.tipo),T=M??z.velocidade/3.6*(.72+.25*pe(F,5)),b={id:F,e:n.e,u:a.u,sentido:a.sentido,s:l,v:0,vMax:T,mi:m,c:u,l:E,cor:I??Zt[Ut(Ht.map(([,j],B)=>[B,j]),pe(F,6))],curva:null,prox:null,reserva:null,tPedido:null,quer:!1,espera:0,parado:0,freio:!1,x:0,y:0,z:0,hx:1,hz:0,idade:0,externo:s},k=(ze(n,a.sentido)-l)*a.sentido;return b.v=Math.min(T*.8,dt(Math.max(0,k-mt-u/2))),Pe(n,b.u,b.s,b.sentido,ie),ut(b,ie),b}function He(n=0){if(!h.length||_<=0)return null;let a=pe(de,1)*_,l=h[h.length-1];for(let T of h)if(a-=T.ws,a<0){l=T;break}let m=pe(de,2)*l.w,u=l.faixas[l.faixas.length-1];for(let T=0;T<l.faixas.length;T++)if(m-=l.pesos[T],m<0){u=l.faixas[T];break}let E=l.ar,M=E.cIni+6,I=E.L-E.cFim-6,s=I-M>30?u.sentido>0?M+pe(de,3)*(I-M-24):M+24+pe(de,3)*(I-M-24):(M+I)/2;if(n>0){_e(E.p,E.tab,s,D);let T=e.camera.position;if((D.x-T.x)**2+(D.z-T.z)**2<n*n)return null}let F=re(E.tipo),z=Zo(F.id,pe(de,4),l.ind);if(!je(E,u.u,u.sentido,s,Le[z].c,8))return null;for(let T of Ae.get(Se(E.e,u.u,u.sentido))??[])if(T.c.parado>15)return null;return Ke(E,u,s,z)}function Ue(n,a){let l=Fe(n.tipo,n.mao,a.sentido);return{rank:Math.max(0,l.findIndex(m=>m.u===a.u)),n:l.length}}function Re(n,a,l,m,u,E,M,I={}){let s=!!I.retorno,F=Ct(a,n.u,n.sentido,l,u.u,m,s),z=s?It.retorno:E.tipo==="cruzamento"?It.cruzamento:E.tipo==="curva"?It.curva:n.vMax;return{ar:l,sentido:m,u:u.u,s:De(l,m),no:E,n:M,de:a,...F,vLim:z,retorno:s,...I}}function $e(n,a,l){let m=a.sentido>0?l.b:l.a,u=n.rede.nos.get(m);if(!u)return null;_e(l.p,l.tab,ze(l,a.sentido),D);let E=D.tx*a.sentido,M=D.tz*a.sentido,{rank:I,n:s}=Ue(l,a),F=a.externo;if(F){let B=F.k+1,y=F.plano.passos[B];if(!y)return null;let P=n.rede.arestas.get(y.e);if(!P||(y.sentido>0?P.a:P.b)!==m)return null;let J=Fe(P.tipo,P.mao,y.sentido);if(!J.length)return null;_e(P.p,P.tab,De(P,y.sentido),D);let W=Tt(E,M,D.tx*y.sentido,D.tz*y.sentido);return Re(a,l,P,y.sentido,Wt(J,I,s,W,!0),u,m,{k:B})}let z=[],T=e.sim?.espelho?.fluxos;for(let B of u.analise.bracos){if(B.e===a.e&&B.inverte===a.sentido>0)continue;let y=n.rede.arestas.get(B.e);if(!y)continue;let P=B.inverte?-1:1,J=Fe(y.tipo,y.mao,P);if(!J.length)continue;let W=Tt(E,M,B.dx,B.dz),ue=(Yt[re(y.tipo).id]??.3)+.2;if(T?.ida&&y.e<T.ida.length){let we=P>0?T.ida[y.e]:T.volta?.[y.e]??0;!(we>0)&&y.mao&&(we=P>0?T.volta?.[y.e]??0:T.ida[y.e]),ue=.15+Math.max(0,we||0)/600}n.rede.nos.get(P>0?y.b:y.a)?.tipo==="ponta"&&y.L<40&&(ue*=.001),s>1&&W>0&&I<s-1&&(ue*=.15),s>1&&W<0&&I>0&&(ue*=.03),z.push({a2:y,sentido:P,fx:J,w:ue,vir:W})}if(!z.length){if(u.tipo!=="ponta"||re(l.tipo).id==="rodovia")return null;let B=-a.sentido,y=Fe(l.tipo,l.mao,B);return y.length?Re(a,l,l,B,y[0],u,m,{retorno:!0}):null}let b=z.reduce((B,y)=>B+y.w,0),k=pe(a.id,a.idade+++11)*b,j=z[z.length-1];for(let B of z)if(k-=B.w,k<0){j=B;break}return Re(a,l,j.a2,j.sentido,Wt(j.fx,I,s,j.vir,!1,pe(a.id,a.idade+31)),u,m)}function ke(n,a,l,m){if(n.sinal!==void 0)return n.sinal;let u=a?.semaforos?a.analise.bracos.find(E=>E.e===l&&E.inverte===m>0):null;return n.sinal=u?{grupo:Na(u.theta),defas:La(a.n)}:null,n.sinal}let $=(n,a)=>n?go(a,n.grupo,n.defas):0,le=(n,a)=>n?po-xo(a,n.grupo,n.defas):0;function X(n,a){let l=Ae.get(Se(n.ar.e,n.u,n.sentido));if(!l)return!0;let m=n.s*n.sentido;for(let u of l)if(u.c!==a&&(u.c.curva&&u.c.curva.prox.ar.e===n.ar.e&&u.c.curva.prox.u===n.u&&u.c.curva.prox.sentido===n.sentido||u.pos-m<so(a,u.c)))return!1;return!0}let p=(n,a)=>{let l=a.ang??0;return l<.2?0:Math.min(3,n.c*n.c*l/(8*a.L))},g=n=>(n.tPedido??ae)+(n.prox?.vir<0?2:0)-(n.prox?.principal?3:0);function H(n,a,l){if(l===n)return!1;let m=l.saindoNo===a.n&&!l.curva,u=l.naBoca===a.n&&l.reserva!==a.n;if(!m&&l.e===n.e&&l.u===n.u&&l.sentido===n.sentido)return!1;let E=m?l.saindo:l.curva?l.curva.prox:l.reserva===a.n?l.reservaPx:l.prox;if(!E?.poli)return!1;let M=m?ot-1:l.curva?Math.max(0,Math.floor((l.curva.t-(l.c/2+.5)/l.curva.L)*ot)):0,I=(n.l+l.l)/2+.7+p(n,a)+(u?0:p(l,E));return Ao(a.poli,0,E.poli,u?0:Math.min(ot-1,M),I,u?1:1/0)<I}function N(n,a,l){for(let u of he.get(a.n)??[])if(H(n,a,u))return!1;let m=g(n);for(let u of w.get(a.n)??[]){if(u===n||u.reserva!=null||!u.prox||u.prox.n!==a.n)continue;let E=u.prox;if(!u.livre&&(E.ar.e!==a.ar.e||E.u!==a.u||E.sentido!==a.sentido))continue;let M=g(u);if((M<m||M===m&&u.id<n.id)&&H(n,a,u))return!1}return!(l?.faixaOcupada&&(l.faixaOcupada(a.n,a.ar.e)||l.faixaOcupada(a.n,n.e)))}function S(n){if(n.reserva==null)return;let a=he.get(n.reserva);if(a){let l=a.indexOf(n);l>=0&&a.splice(l,1)}n.reserva=null}function Z(n,a,l){let m=n.v,u=n.c>9?1.2:n.c>6?1.6:2.4;n.v=Math.max(0,n.v+Math.max(-Xt*l,Math.min(u*l,a-n.v))),n.freio=n.v<m-.05*l||n.v<.3}function C(n,a){let m=re(a.tipo).velocidade/3.6*.9,u=n.externo,E=Number.isFinite(u.alvoD)?u.alvoD-ge(n):0;return Math.max(.35*m,Math.min(1.2*m,m*(1+E/80)))}function ge(n){let a=n.externo,l=a.plano,m=a.k,u=l.ars[m];if(!u)return 0;let E=(M,I,s)=>I>0?M:s.L-M;if(n.curva){let M=l.cum[m]+E(ze(u,n.sentido),n.sentido,u),I=l.ars[m+1],s=I?l.cum[m+1]+E(De(I,l.passos[m+1].sentido),l.passos[m+1].sentido,I):M;return M+(s-M)*n.curva.t}return l.cum[m]+E(n.s,n.sentido,u)}let O={x:0,z:0,hx:1,hz:0};function L(n,a,l,m){let u=n.rede,E=e.camera.position;ae=l;let M=++Q%600===0;Jt(Ae,M),Jt(he,M),Jt(w,M),ce=0;for(let s of d){if(s.gap=1/0,s.vL=0,s.curva){let F=u.arestas.get(s.e),z=s.curva,T=z.prox,b=T.vir||T.retorno?1+.12*s.c:.5;F&&Ce(Se(s.e,s.u,s.sentido),s,ze(F,s.sentido)*s.sentido+z.t*z.L+b),Ce(Se(T.ar.e,T.u,T.sentido),s,T.s*T.sentido-(1-z.t)*z.L-b)}else Ce(Se(s.e,s.u,s.sentido),s,s.s*s.sentido);s.saindoNo!=null&&at(he,s.saindoNo).push(s),s.naBoca=null,!s.curva&&s.reserva==null&&s.prox&&s.prox.de===u.arestas.get(s.e)&&(ze(s.prox.de,s.sentido)-s.s)*s.sentido<mt+s.c/2-.5&&(s.naBoca=s.prox.n,at(he,s.naBoca).push(s)),s.reserva!=null?at(he,s.reserva).push(s):s.quer&&s.prox&&at(w,s.prox.n).push(s)}for(let s of Ae.values()){s.sort((F,z)=>F.pos-z.pos||F.c.id-z.c.id);for(let F=0;F+1<s.length;F++){let z=s[F],T=s[F+1],b=T.pos-z.pos-so(z.c,T.c);b<z.c.gap&&(z.c.gap=b,z.c.vL=T.c.v)}}let I=new Set;for(let s of d)s.curva?oe(s,a):ve(n,s,a,l,m)||I.add(s),s.parado=s.v<.1?s.parado+a:0,s.parado>vo&&!s.externo&&Math.hypot(s.x-E.x,s.z-E.z)>60&&I.add(s);if(I.size){for(let s of I)S(s),s.externo&&(s.externo.chegou=!0,R.delete(s.externo.id),V.add(s.externo.id));for(let s=d.length-1;s>=0;s--)I.has(d[s])&&d.splice(s,1)}}function oe(n,a){let l=n.curva,m=l.prox;Z(n,Math.min(m.vLim,n.vMax,dt(n.gap,n.vL)),a);let u=Math.min(n.v*a,Math.max(0,n.gap));if(u<n.v*a&&(n.v=a>0?u/a:0),l.t+=u/l.L,l.t>=1){n.e=m.ar.e,n.u=m.u,n.sentido=m.sentido,n.s=m.s,n.curva=null,n.prox=null,n.reserva!=null&&(n.saindo=m,n.saindoNo=n.reserva,n.reserva=null),n.espera=0,n.externo&&(n.externo.k=m.k),Pe(m.ar,n.u,n.s,n.sentido,O),ut(n,O);return}Xe(m.p,l.t,O),ut(n,O)}function ve(n,a,l,m,u){let E=n.rede,M=E.arestas.get(a.e);if(!M)return!1;a.saindo&&(a.s-De(M,a.sentido))*a.sentido>a.c/2+1&&(a.saindo=null,a.saindoNo=null);let I=ze(M,a.sentido),s=(I-a.s)*a.sentido,F=a.sentido>0?M.b:M.a,z=E.nos.get(F),T=a.externo?C(a,M):a.vMax;T=Math.min(T,dt(a.gap,a.vL)),a.prox&&(E.arestas.get(a.prox.ar.e)!==a.prox.ar||a.prox.de!==M||E.nos.get(a.prox.n)!==a.prox.no)&&(a.prox=null,S(a)),s<ro&&a.prox==null&&(a.prox=$e(n,a,M)??!1);let b=a.prox||null,k=mt+a.c/2,j=!!b;if(a.quer=!1,b&&(T=Math.min(T,Math.sqrt(b.vLim*b.vLim+2*Ot*Math.max(0,s))),s<ro)){let y=X(b,a)||a.espera>15&&z?.tipo!=="cruzamento",P=u?.faixaOcupada?.(F,a.e)??!1;if((z?.tipo==="cruzamento"||z?.tipo==="curva")&&!b.retorno){let W=ke(b,z,a.e,a.sentido),ue=$(W,m),pt=ue===0,we=s<k+1&&a.v<.5,wo=ue===1||ue===2&&b.vir<0&&le(W,m)<ho,Lt=pt||wo&&we&&a.espera>3;if(b.principal===void 0){let ht=z.analise.bracos.map(No=>No.P.velocidade),ia=re(M.tipo).velocidade;b.principal=!z.semaforos&&ia>=Math.max(...ht)&&Math.min(...ht)<ia}if(a.reserva!=null&&(!Lt||!y||P)&&s-k>a.v*a.v/(2*Xt)+.5&&S(a),a.reserva==null){let ht=s-k<=a.v*a.v/(2*Ot)+4||s<k+1;Lt&&ht?(a.tPedido??=m+Math.max(0,s-k)/Math.max(1,a.v),a.quer=!0,a.livre=y&&!P,y&&!P&&N(a,b,u)&&(a.reserva=F,a.reservaPx=b,at(he,F).push(a),a.tPedido=null,a.quer=!1)):Lt||(a.tPedido=null)}j=a.reserva!=null}else j=y&&!P;if(!j){let W=s>=k-.5?s-k:s-.3;T=Math.min(T,dt(Math.max(0,W)))}}Z(a,T,l);let B=Math.min(a.v*l,Math.max(0,a.gap));if(b&&!j&&(B=Math.min(B,Math.max(0,s-.05))),B<a.v*l&&(a.v=l>0?B/l:0),a.espera=a.v<.3?a.espera+l:0,a.s+=B*a.sentido,(I-a.s)*a.sentido<=1e-6){if(!b)return!1;if(j)return a.s=I,a.curva={t:0,L:b.L,prox:b},a.prox=null,Xe(b.p,0,O),ut(a,O),!0;a.s=I}return Pe(M,a.u,a.s,a.sentido,O),ut(a,O),!0}function ye(n,a,l,m){let u=R.get(n);if(u)return u.externo.alvoD=l,u.externo.visto=ae,u;let E=e.dominio("vias");if(!E?.rede||!a?.passos?.length)return null;let M=0;for(;M+1<a.passos.length&&a.cum[M+1]<=l;)M++;let I=a.passos[M],s=E.rede.arestas.get(I.e);if(!s||s!==a.ars[M])return null;let F=l-a.cum[M],z=I.sentido>0?F:s.L-F,T=De(s,I.sentido),b=ze(s,I.sentido);if((z-T)*I.sentido<1||(b-z)*I.sentido<8||(_e(s.p,s.tab,z,D),Math.hypot(D.x-K.x,D.z-K.z)>r().raio))return null;let k=Fe(s.tipo,s.mao,I.sentido);if(!k.length)return null;let j=k[k.length-1],B=Ae.get(Se(s.e,j.u,I.sentido))??[],y=z*I.sentido,P=[];for(let W of B)if(!(Math.abs(W.pos-y)>=(m.c+W.c.c)/2+vt+4)){if(W.c.externo)return null;P.push(W.c)}for(let W of P){S(W);let ue=d.indexOf(W);ue>=0&&d.splice(ue,1)}let J=Ke(s,j,z,5,{c:m.c,l:m.l,vMax:re(s.tipo).velocidade/3.6*.9,externo:{id:n,plano:a,k:M,alvoD:l,visto:ae,chegou:!1}});return J.y=oa(J,s,e.sim.espelho.terreno),d.push(J),R.set(n,J),J}function Ie(n){let a=R.get(n);if(!a)return;R.delete(n),S(a);let l=d.indexOf(a);l>=0&&d.splice(l,1)}function Oe(n,a,l=!1){for(let u of he.get(n)??[]){if(u.saindoNo===n&&!u.curva){if(u.e===a)return!0;continue}let E=u.curva?u.curva.prox:u.reservaPx;if(E&&(E.ar.e===a||u.e===a))return!0}let m=e.dominio("vias")?.rede?.arestas.get(a);if(!m)return!1;for(let u of d)if(!(u.curva||u.e!==a)){if((u.sentido>0?m.b:m.a)===n){let E=(ze(m,u.sentido)-u.s)*u.sentido;if(E<mt+u.c/2-.5||l&&E<30&&u.v>1.5)return!0}else if((u.s-De(m,u.sentido))*u.sentido<5.3+u.c/2)return!0}return!1}let yt={arr:null,o:0};function oa(n,a,l){let m=n.curva||!a?tt.pista+.03:Mt(re(a.tipo),n.u);return a?.ponte&&!n.curva?a.cotas[0]+(a.cotas[1]-a.cotas[0])*n.s/a.L+m-tt.pista:(l?gt(l,n.x,n.z):0)+m}function yo(n,a,l){let m=r(),u=e.camera.position,E=f.map(()=>0),M=a.terreno,I=(b,k)=>b*2+k,s=(b,k,j,B)=>{let y=I(b,k),P=f[y],J=E[y];return J>=P.cap?null:(E[y]++,P.cor.array[4*J]=j[0],P.cor.array[4*J+1]=j[1],P.cor.array[4*J+2]=j[2],P.cor.array[4*J+3]=B,yt.arr=P.mesh.instanceMatrix.array,yt.o=J*16,yt)},F=l>.25?1:0,z=m.lod0*m.lod0;for(let b of d){if(b.y=oa(b,n.rede.arestas.get(b.e),M),b.externo)continue;let k=(b.x-u.x)**2+(b.y-u.y)**2+(b.z-u.z)**2,j=s(b.mi,k<z?0:1,b.cor,F|(b.freio?2:0));j&&zt(j.arr,j.o,b.x,b.y,b.z,b.hx,b.hz)}let T=0;if(m.estacionados>0)for(let b of n.setoresPerto(m.parados))for(let[k,j]of b.estacionados??[])for(let B=0;B<j.n&&T<m.estacionados;B++){let y=B*16,P=j.mat[y+12]-u.x,J=j.mat[y+13]-u.y,W=j.mat[y+14]-u.z,ue=Math.sqrt(P*P+J*J+W*W);if(ue>m.parados)continue;let pt=Zt[j.bytes[4*B]]??Zt[0],we=s(k,ue<m.lod0?0:1,pt,0);we&&we.arr.set(j.mat.subarray(y,y+16),we.o),T++}return f.forEach((b,k)=>{let j=E[k];if(b.mesh.count=j,b.mesh.visible=j>0,!j)return;let B=b.mesh.instanceMatrix;B.clearUpdateRanges(),B.addUpdateRange(0,j*16),B.needsUpdate=!0,b.cor.clearUpdateRanges(),b.cor.addUpdateRange(0,j*4),b.cor.needsUpdate=!0}),e.stats.instancias.carros=d.length-R.size+T,T}function na(n,a,l=0){for(let m=0;m<a&&d.length-R.size<n;m++){let u=He(l);u?(d.push(u),Ce(Se(u.e,u.u,u.sentido),u,u.s*u.sentido)):de++}}function ra(n,a=0){let l=Math.min(n.carros,Math.round(A));na(l,4,n.lod0);let m=d.length-R.size-(l+4),u=a>0&&A>n.carros,E=e.camera.position,M=n.lod0*n.lod0;for(let I=d.length-1;I>=0;I--){let s=d[I],F=(s.x-K.x)**2+(s.z-K.z)**2,z=F>(n.raio+80)**2;if(s.externo){(z||ae-s.externo.visto>90)&&Ie(s.externo.id);continue}let T=(s.x-E.x)**2+(s.z-E.z)**2>M,b=z||m>0&&T;if(!b&&u&&T&&!s.curva){let k=Kt(Math.sqrt(F),n.raio);b=k<1&&pe(s.id,Q+7919)<a*(1-k)/20}b&&(z||m--,S(s),d.splice(I,1))}}let wt=null,sa=0,Nt={nome:"trafego",aplicar(n){(n.celulas?.length||n.tudo?.celulas||n.realocado?.includes("celulas"))&&(ee=!0)},quadro(n,a){let l=a.dominio("vias");if(!l?.rede)return;x!==a.perfil.id&&(x=a.perfil.id,v(),d.length=0,R.clear());let m=a.sim.espelho,u=r(),E=a.horaDoCeu(),M=a.sol?.dia??1,I=Math.min(1,Math.max(0,1-M*1.4));i.gCarroNoite.value=I;let s=m.tempo,F=Ve??(s?.velocidade??1)>0,z=wt===null?0:Math.min(100,n-wt)/1e3*(F?Math.max(1,s?.mult??1):0);wt=n,a.relogioRua=(a.relogioRua??0)+z,ee&&n-(Nt._tZonas??-1e9)>5e3&&(te=Me(m),ee=!1,Nt._tZonas=n),a.cameraApi?.alvo?.(K),(Ee!==l.rede.versao||!G||K.distanceTo(G)>60||n-q>2e3)&&(Y(l,E,m),Ee=l.rede.versao,q=n),ra(u,z),z>0&&L(l,z,a.relogioRua,a.dominio("pedestres")),sa=yo(l,m,I)},animar(n){Ve=n},povoar(n=e){let a=n.dominio("vias");if(!a?.rede)return 0;n.cameraApi?.alvo?.(K),ee&&(te=Me(n.sim.espelho),ee=!1),Y(a,n.horaDoCeu(),n.sim.espelho),Ee=a.rede.versao;let l=Math.min(r().carros,Math.round(A));return na(l,l*4),d.length},avancar(n,a=e){let l=a.dominio("vias");if(l?.rede)for(let m=0;m<n;m+=.1)a.relogioRua=(a.relogioRua??0)+.1,ra(r(),.1),L(l,.1,a.relogioRua,a.dominio("pedestres")),a.dominio("pedestres")?.avancarUm?.(.1,a)},seguir:ye,soltarExterno:Ie,externo(n){return R.get(n)??null},chegou:n=>V.has(n),esquecer(n){V.delete(n)},cruzandoFaixa:Oe,_carros:()=>d,medidas(){let n=0;for(let a of f)n+=a.mesh.count*a.tris;return{andando:d.length-R.size,caminhoes:R.size,parados:sa,tris:n,alvo:Math.round(A),fluxo:!!e.sim?.espelho?.fluxos?.ida}},amostra(){return d.map(n=>({id:n.id,e:n.e,u:n.u,sentido:n.sentido,s:n.s,mi:n.mi,c:n.c,l:n.l,v:n.v,curva:!!n.curva,retorno:!!n.curva?.prox?.retorno,no:n.curva?.prox?.n??null,de:n.curva?n.e:null,para:n.curva?.prox?.ar.e??null,x:n.x,z:n.z,hx:n.hx,hz:n.hz,externo:n.externo?.id??null,k:n.externo?.k??null}))},descartar(){for(let n of f)t.remove(n.mesh),n.mesh.geometry.dispose(),n.mesh.dispose();c.dispose()}};return Nt}function Xo(e){e.registrarDominio("trafego",Jo)}var an={};St(an,{CORPOS:()=>ta,FATOR_VELOCIDADE:()=>Vo,MODELO_CAMINHAO:()=>aa,PERFIL_CAMINHOES:()=>_o,criarMaterialCaminhao:()=>Co,distanciaDaViagem:()=>To,passosDoCaminho:()=>Io,planoDaRota:()=>Oo,poseDaViagem:()=>zo,registrar:()=>tn});var _o=Object.freeze({ultra:{raio:3e3,lod0:160,max:64},alta:{raio:2400,lod0:120,max:48},media:{raio:1600,lod0:90,max:32},leve:{raio:900,lod0:60,max:16}}),ta=Object.freeze(["basculante","carroceria","betoneira","bau"]),aa=Object.freeze({c:8.6,l:2.5}),Vo=.9,Wo=[236,236,232];function Io(e){return Array.from(e??[],t=>t<0?{e:~t,sentido:-1}:{e:t,sentido:1})}function Oo(e,t){let o=Io(t);if(!o.length)return null;let i=[],c=[0],r=[0],f=null;for(let v of o){let x=e.arestas.get(v.e);if(!x)return null;let d=v.sentido>0?x.a:x.b;if(f!==null&&d!==f)return null;f=v.sentido>0?x.b:x.a,i.push(x),c.push(c[c.length-1]+x.L),r.push(r[r.length-1]+x.L/(re(x.tipo).velocidade/3.6*Vo))}return{passos:o,ars:i,cum:c,tempos:r,L:c[c.length-1],T:r[r.length-1],curvas:[],versao:e.versao}}function To(e,t,o){let i=Math.max(1,e.tFim-e.tIni),c;if(t.T<=i?c=o-(e.tIni+(i-t.T)/2):c=(o-e.tIni)/i*t.T,!(c>=0)||c>t.T)return null;let r=0;for(;r+1<t.passos.length&&t.tempos[r+1]<=c;)r++;let f=(c-t.tempos[r])/Math.max(1e-9,t.tempos[r+1]-t.tempos[r]);return t.cum[r]+Math.min(1,Math.max(0,f))*(t.cum[r+1]-t.cum[r])}var Ro=(e,t)=>t>0?e.cIni:e.cFim,bo=(e,t)=>t>0?e.L-e.cFim:e.L-e.cIni,ea=(e,t)=>Fe(e.tipo,e.mao,t).at(-1)??null;function zo(e,t,o={}){let i=0;for(;i+1<e.passos.length&&e.cum[i+1]<=t;)i++;let c=e.ars[i],{sentido:r}=e.passos[i],v=ea(c,r)?.u??0,x=Math.max(0,Math.min(c.L,t-e.cum[i])),d=A=>{if(!e.curvas[A]){let _=e.ars[A],G=e.ars[A+1],q=e.passos[A].sentido,te=e.passos[A+1].sentido;e.curvas[A]=Ct(_,ea(_,q)?.u??0,q,G,ea(G,te)?.u??0,te)}return e.curvas[A]};o.k=i,o.ar=c,o.u=v,o.curva=!1;let R=Ro(c,r),V=bo(c,r);if(x<R&&i>0){let A=e.ars[i-1],_=e.passos[i-1].sentido,G=e.cum[i-1]+bo(A,_),q=(t-G)/Math.max(.1,e.cum[i]+R-G);return Xe(d(i-1).p,Math.min(1,Math.max(0,q)),o),o.curva=!0,o}if(x>V&&i+1<e.passos.length){let A=e.cum[i]+V,_=(t-A)/Math.max(.1,e.cum[i+1]+Ro(e.ars[i+1],e.passos[i+1].sentido)-A);return Xe(d(i).p,Math.min(1,Math.max(0,_)),o),o.curva=!0,o}let h=Math.min(V,Math.max(R,x));return Pe(c,v,r>0?h:c.L-h,r,o),o.s=r>0?h:c.L-h,o}function Be(e,t,o){if(!e.includes(t))throw new Error(`caminhão: shader sem '${t}'`);return e.replace(t,o)}function Co(e,t,o){let i=new Qe({color:16777215,roughness:.4,metalness:0});return i.name="caminhao",i.onBeforeCompile=c=>{Object.assign(c.uniforms,t);let r=c.vertexShader;r=Be(r,"#include <common>",`#include <common>
${o.CAMINHAO_VERTICE_PARS}`),r=Be(r,"#include <beginnormal_vertex>",o.CAMINHAO_VERTICE_NORMAL),r=Be(r,"#include <begin_vertex>",o.CAMINHAO_VERTICE_MAIN);let f=c.fragmentShader;f=Be(f,"#include <common>",`#include <common>
${o.CAMINHAO_FRAGMENTO_PARS}`),f=Be(f,"#include <color_fragment>",o.CAMINHAO_FRAGMENTO_COR),f=Be(f,"#include <roughnessmap_fragment>",o.CAMINHAO_FRAGMENTO_RUGOSIDADE),f=Be(f,"#include <metalnessmap_fragment>",o.CAMINHAO_FRAGMENTO_METAL),f=Be(f,"#include <emissivemap_fragment>",`#include <emissivemap_fragment>
${o.CAMINHAO_FRAGMENTO_EMISSIVO}`),c.vertexShader=r,c.fragmentShader=f},i.customProgramCacheKey=()=>"caminhao-2",e.aplicar(i,e.nomes().filter(c=>c!=="camada"))}function Yo(e,t){return e.setAttribute("position",new ne(t?t.posicao:new Float32Array(9),3)),e.setAttribute("normal",new ne(t?t.normal:new Float32Array(9),3)),e.setAttribute("aParte2",new ne(t?t.parte:new Float32Array(6),2)),e.setIndex(new ne(t?t.indices:Uint16Array.of(0,1,2),1)),e.boundingSphere=new We(new Ne,1e7),e}var Qo=e=>{let t=parseInt(String(e??"#c9a86a").replace("#",""),16);return Number.isFinite(t)?[t>>16&255,t>>8&255,t&255]:[201,168,106]};function en(e){let{cena:t,medidas:o}=e,i={gCamNoite:{value:0},gCamTempo:{value:0},gCamTambor:{value:new nt(1.95,1.85,2.55,-3.6)},gCamPiso:{value:1.28}},c=null,r=()=>et(_o,e.perfil),f=null,v=[];function x(){for(let U of v)t.remove(U.mesh),U.mesh.geometry.dispose(),U.mesh.dispose();if(v.length=0,!f)return;let w=r().max;ta.forEach((U,ce)=>{for(let Q of[0,1]){let ae=Yo(new Ye,f.malhaCaminhao(U,Q)),Me=new rt(new Uint8Array(w*4),4,!1),fe=new rt(new Uint8Array(w*4),4,!1);Me.setUsage(Ge),fe.setUsage(Ge),ae.setAttribute("aCab",Me),ae.setAttribute("aCarga",fe);let Y=new xt(ae,c,w);Y.instanceMatrix.setUsage(Ge),Y.frustumCulled=!1,Y.count=0,Y.visible=!1,Y.name=`caminhoes:${U}:${Q}`,o.familia(Y,"vida"),t.add(Y),v.push({ci:ce,lod:Q,mesh:Y,cab:Me,carga:fe,cap:w,tris:f.malhaCaminhao(U,Q).tris})}})}let d=e.perfil.id,R=()=>v.map(w=>w.mesh),V=import("./parte.20261007005445.LBFGZAKD.js").then(w=>{f=w,c=Co(e.ganchos,i,w),i.gCamTambor.value.set(w.TAMBOR.y0,w.TAMBOR.z0,w.TAMBOR.y1,w.TAMBOR.z1),i.gCamPiso.value=w.CAMINHAO.piso,d=e.perfil.id,x();let U=e.quadro?.aquecer;return U?.pronto&&(U.delete?.(R),U.add?.(R)),w}),h=!1;V.catch(w=>{h=!0,console.error("caminhoes: o modelo dos caminhões não carregou",w)});let A=new Map,_=new Map,G=new Map,q=null,te=0,ee=null,Ee=[],de=0,Ve=0,K=0,D={x:0,z:0,hx:1,hz:0};function Ae(w,U){let ce=A.get(U.id);if(ce&&ce.caminho===U.caminho&&ce.pl?.versao===w.versao)return ce.pl;let Q=Oo(w,U.caminho);return A.set(U.id,{pl:Q,caminho:U.caminho}),Q}return{nome:"caminhoes",quadro(w,U){let ce=U.dominio("vias");if(!ce?.rede||!f)return;d!==U.perfil.id&&(d=U.perfil.id,x());let Q=U.sim.espelho,ae=Q.terreno,Me=r(),fe=U.dominio("trafego"),Y=Q.tempo,Ce=ee??(Y?.velocidade??1)>0,je=q===null?0:Math.min(100,w-q)/1e3*(Ce?Math.max(1,Y?.mult??1):0);q=w,te+=je,ee===!0&&!((Y?.velocidade??0)>0)&&(de+=je),i.gCamTempo.value=te,i.gCamNoite.value=Math.min(1,Math.max(0,1-(U.sol?.dia??1)*1.4));let Ke=(Y?.tique??0)+(Y?.frac??0)+de,He=Qo(Q.holding?.cor),Ue=U.camera.position,Re=v.map(()=>0),$e=new Set;Ve=0,K=0;let ke=($,le,X,p,g,H,N,S)=>{let Z=Math.hypot(X-Ue.x,p-Ue.y,g-Ue.z);if(Z>Me.raio)return;let C=f.cargaDe(le.item),O=ta.indexOf(C.corpo)*2+(Z<Me.lod0?0:1),L=v[O],oe=Re[O];if(oe>=L.cap)return;Re[O]++,Ve++,zt(L.mesh.instanceMatrix.array,oe*16,X,p,g,H,N);let ve=le.visual?Wo:He,ye=(i.gCamNoite.value>.25?1:0)|(S?2:0);L.cab.array.set([ve[0],ve[1],ve[2],ye+4*($%64)],4*oe),L.carga.array.set([C.cor[0],C.cor[1],C.cor[2],Math.max(0,Math.min(10,Math.round(le.n??10)))],4*oe)};for(let $ of Ee.length?[...Q.entregas??[],...Ee]:Q.entregas??[]){if(!$?.caminho?.length)continue;$e.add($.id);let le={item:$.item,n:$.n,visual:!!$.visual};if(_.set($.id,le),fe?.chegou?.($.id))continue;let X=Ae(ce.rede,$);if(!X)continue;let p=To($,X,Ke),g=fe?.externo?.($.id)??null;if(p===null&&!g)continue;if(g=fe?.seguir?.($.id,X,p??X.L,aa)??g,g){K++,G.set($.id,{agente:!0,k:g.externo?.k??0,x:g.x,z:g.z,e:g.e,curva:!!g.curva,d:p}),ke($.id,le,g.x,g.y,g.z,g.hx,g.hz,g.freio);continue}zo(X,p,D);let H=re(D.ar.tipo),N=D.curva?tt.pista+.03:Mt(H,D.u),S=D.ar.ponte&&!D.curva?D.ar.cotas[0]+(D.ar.cotas[1]-D.ar.cotas[0])*D.s/D.ar.L+N-tt.pista:(ae?gt(ae,D.x,D.z):0)+N;G.set($.id,{agente:!1,k:D.k,x:D.x,z:D.z,e:D.ar.e,curva:D.curva,d:p}),ke($.id,le,D.x,S,D.z,D.hx,D.hz,!1)}for(let[$,le]of _){if($e.has($))continue;let X=fe?.externo?.($),p=A.get($)?.pl;if(!X||!p){_.delete($),A.delete($),G.delete($),fe?.esquecer?.($);continue}fe.seguir($,p,p.L,aa),K++,ke($,le,X.x,X.y,X.z,X.hx,X.hz,X.freio)}v.forEach(($,le)=>{let X=Re[le];if($.mesh.count=X,$.mesh.visible=X>0,!X)return;let p=$.mesh.instanceMatrix;p.clearUpdateRanges(),p.addUpdateRange(0,X*16),p.needsUpdate=!0;for(let g of[$.cab,$.carga])g.clearUpdateRanges(),g.addUpdateRange(0,X*4),g.needsUpdate=!0})},animar(w){ee=w},preparar:()=>V,pronto:()=>!!f||h,amostras(w){Ee=w??[]},agora(w=e){let U=w.sim.espelho.tempo;return(U?.tique??0)+(U?.frac??0)+de},estado:w=>G.get(w)??null,medidas(){let w=0;for(let U of v)w+=U.mesh.count*U.tris;return{entregas:_.size,naRua:K,desenhados:Ve,tris:w}},descartar(){e.quadro?.aquecer?.delete?.(R);for(let w of v)t.remove(w.mesh),w.mesh.geometry.dispose(),w.mesh.dispose();c?.dispose()}}}function tn(e){e.registrarDominio("caminhoes",en)}export{rn as a,sn as b,cn as c,ln as d,fn as e,un as f,mn as g,_t as h,$o as i,go as j,xo as k,Xe as l,zt as m,Eo as n,Ko as o,Oo as p,To as q,zo as r,an as s};
