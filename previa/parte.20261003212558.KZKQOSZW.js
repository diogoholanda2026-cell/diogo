import{a as v,b as e,c as t,d as c,e as l}from"./parte.20261003212558.72DAPONS.js";import{a as f,b as s,c as m,d as n}from"./parte.20261003212558.BL3UOIH2.js";import"./parte.20261003212558.ROPLBJLA.js";var u=Object.freeze({ultra:2048,alta:1024,media:1024,leve:512}),x={vertice:`
out vec2 vUv;
void main(){
vUv=uv;
gl_Position=vec4(position.xy,0.0,1.0);
}
`,fragmento:`
uniform float uSemente;
in vec2 vUv;
uint fHashU(uvec3 v){
uint h=(v.x * 1597334677u)^(v.y * 3812015801u)^(v.z * 2654435769u);
h ^=h >> 16u;
h *=2246822519u;
h ^=h >> 13u;
h *=3266489917u;
h ^=h >> 16u;
return h;
}
float fHash(vec2 c,float s){return float(fHashU(uvec3(uvec2(ivec2(c)+ 4096),uint(s))))*(1.0 / 4294967295.0);}
float fValor(vec2 p,vec2 per,float s){
vec2 i=floor(p);
vec2 f=p - i;
vec2 u=f * f *(3.0 - 2.0 * f);
float a=fHash(mod(i,per),s);
float b=fHash(mod(i + vec2(1.0,0.0),per),s);
float c=fHash(mod(i + vec2(0.0,1.0),per),s);
float d=fHash(mod(i + vec2(1.0,1.0),per),s);
return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fFbm(vec2 p,vec2 per,float s){
float t=0.0;
float a=0.5;
for(int o=0;o < 4;o ++){
t +=a * fValor(p,per,s + float(o)* 13.0);
p *=2.0;
per *=2.0;
a *=0.5;
}
return t / 0.9375;
}
float folhaForma(vec2 q,float L,float W,float ponta){
float t=q.x / L;
float larg=W * pow(max(0.0,1.0 - t * t),0.55)*(1.0 - ponta * max(t,0.0));
float px=fwidth(q.y)+ 1e-4;
return(1.0 - smoothstep(larg - px,larg + px,abs(q.y)))* step(abs(t),1.0);
}
float cachoRaio(vec2 d,float s){
vec2 dir=d / max(length(d),1e-4);
return 0.36 + 0.11 * fFbm(dir * 1.6 + vec2(3.1,1.7),vec2(64.0),s + 91.0);
}
vec4 cacho(vec2 uv,float G,float L,float W,float ponta,float dens2,float gravetos,vec3 tintura,float s){
vec2 p=uv * G;
vec2 ip=floor(p);
float melhorZ=-1.0;
vec3 cor=vec3(0.0);
float alfa=0.0;
for(int j=-1;j <=1;j ++){
for(int i=-1;i <=1;i ++){
vec2 c=ip + vec2(float(i),float(j));
for(int k=0;k < 2;k ++){
float sk=s + float(k)* 31.0;
float h1=fHash(c,sk);
float h2=fHash(c,sk + 1.0);
float h3=fHash(c,sk + 2.0);
float h4=fHash(c,sk + 3.0);
if(k==1 && h4 > dens2)continue;
vec2 base=(c + vec2(h1,h2))/ G;
vec2 dd=base - 0.5;
float rr=length(dd)/ cachoRaio(dd,s);
if(rr > 1.0 - 0.25 * h3)continue;
float a0=atan(dd.y,dd.x + 1e-5)+(h3 - 0.5)* 2.4;
vec2 dir=vec2(cos(a0),sin(a0));
float Lk=L *(0.75 + 0.5 * h4);
vec2 q=uv - base - dir * Lk;
vec2 ql=vec2(dot(q,dir),dot(q,vec2(-dir.y,dir.x)));
float f=folhaForma(ql,Lk,W *(0.8 + 0.4 * h1),ponta);
if(f <=0.0)continue;
float z=h2 * 0.5 +(1.0 - rr)* 0.25 + h4 * 0.25;
alfa=max(alfa,f);
if(z > melhorZ){
melhorZ=z;
float claro=0.7 + 0.5 * h1;
float nervura=1.0 - 0.22 *(1.0 - smoothstep(0.0,W * 0.12,abs(ql.y)));
float dobra=ql.y > 0.0 ? 1.08 : 0.9;
vec3 t=mix(vec3(1.0),tintura,step(0.86,h3));
cor=vec3(0.5)* claro * nervura * dobra * t *(0.72 + 0.4 * z);
}
}
}
}
for(int g=0;g < 5;g ++){
if(float(g)>=gravetos)break;
float ag=fHash(vec2(float(g),7.0),s + 5.0)* 6.2831;
vec2 dg=vec2(cos(ag),sin(ag));
vec2 q=uv - 0.5;
float t=clamp(dot(q,dg),0.0,0.33);
float dist=length(q - dg * t);
float largura=0.006 *(1.0 - t * 2.0)+ 0.002;
float gv=1.0 - smoothstep(largura,largura + fwidth(dist)+ 1e-4,dist);
if(gv > 0.0 && melhorZ < 0.0){
cor=vec3(0.42,0.33,0.24);
alfa=max(alfa,gv);
}
}
return vec4(cor,alfa);
}
vec4 palmada(vec2 uv,float s){
vec2 d=uv - vec2(0.5,0.44);
float r=length(d);
float ang=atan(d.y,d.x);
const float N=9.0;
float melhor=0.0;
float nerv=0.0;
for(int k=0;k < 9;k ++){
float fk=-1.5708 + 0.5236 + float(k)*(5.236 /(N - 1.0));
float dif=abs(mod(ang - fk + 3.14159,6.28318)- 3.14159);
float Lk=0.42 *(0.72 + 0.28 * cos(fk - 1.5708))*(0.9 + 0.2 * fHash(vec2(float(k),3.0),s));
float t=clamp(r / Lk,0.0,1.0);
float meia=0.075 * pow(sin(3.14159 * min(1.0,t * 0.92 + 0.08)),0.7)+ 0.02 *(1.0 - t);
float lat=dif * r;
float px=fwidth(lat)+ 1e-4;
float dentro=(1.0 - smoothstep(meia - px,meia + px,lat))* step(r,Lk);
melhor=max(melhor,dentro);
nerv=max(nerv,(1.0 - smoothstep(0.0,0.005 + px,lat))* dentro);
}
melhor=max(melhor,1.0 - smoothstep(0.07,0.075,r));
float pec=(1.0 - smoothstep(0.008,0.012,abs(d.x)))* step(-0.42,d.y)* step(d.y,0.0);
float n=fFbm(uv * 6.0,vec2(6.0),s + 4.0);
vec3 cor=vec3(0.5)*(0.85 + 0.3 * n)*(0.92 + 0.12 * r);
cor=mix(cor,vec3(0.66,0.68,0.64),nerv * 0.6);
cor=mix(cor,vec3(0.45,0.42,0.34),pec);
return vec4(cor,max(melhor,pec));
}
vec4 palma(vec2 uv,float s){
float u2=uv.x * 1.0 - uv.y * 0.12;
float per=64.0;
float i=floor(u2 * per);
float f=fract(u2 * per);
float h=fHash(vec2(i,1.0),s);
float compr=0.82 + 0.18 * h;
float larg=0.2 *(1.0 - 0.7 * uv.y / compr)+ 0.04;
float px=fwidth(f)+ 1e-4;
float fol=(1.0 - smoothstep(larg - px,larg + px,abs(f - 0.5)))* step(uv.y,compr);
float raque=1.0 - smoothstep(0.03,0.05,uv.y);
vec3 cor=vec3(0.5)*(0.85 + 0.3 * h)*(0.85 + 0.25 * uv.y)*(1.0 - 0.25 *(1.0 - smoothstep(0.0,0.06,abs(f - 0.5))));
cor=mix(cor,vec3(0.55,0.52,0.4),raque);
return vec4(cor,max(fol,raque));
}
vec4 casca(vec2 uv,float s){
float n=fFbm(vec2(uv.x * 7.0,uv.y * 2.0),vec2(7.0,2.0),s);
float fis=smoothstep(0.04,0.0,abs(fFbm(vec2(uv.x * 11.0,uv.y * 1.5),vec2(11.0,3.0),s + 9.0)- 0.5));
float anel=smoothstep(0.92,1.0,fValor(vec2(uv.x * 3.0,uv.y * 24.0),vec2(3.0,24.0),s + 2.0))* 0.3;
vec3 cor=vec3(0.5)*(0.75 + 0.5 * n)*(1.0 - 0.45 * fis)*(1.0 + anel);
return vec4(cor,1.0);
}
void main(){
vec2 g=vUv * vec2(4.0,2.0);
vec2 cel=floor(g);
vec2 uv=fract(g);
int k=int(cel.x + cel.y * 4.0 + 0.5);
float s=uSemente + float(k)* 101.0;
vec4 c;
if(k==0)c=cacho(uv,13.0,0.032,0.014,0.35,0.9,3.0,vec3(1.05,1.05,0.8),s);
else if(k==1)c=cacho(uv,18.0,0.022,0.008,0.5,0.8,4.0,vec3(1.12,1.06,0.78),s);
else if(k==2)c=cacho(uv,10.0,0.045,0.019,0.45,0.7,4.0,vec3(1.1,1.0,0.75),s);
else if(k==3)c=palmada(uv,s);
else if(k==4)c=palma(uv,s);
else if(k==5)c=cacho(uv,12.0,0.03,0.013,0.4,0.45,5.0,vec3(1.15,1.05,0.72),s);
else if(k==6)c=cacho(uv,7.0,0.07,0.03,0.3,0.55,3.0,vec3(1.1,1.02,0.8),s);
else c=casca(uv,s);
vec2 m=step(vec2(0.02),uv)* step(uv,vec2(0.98));
if(k < 7)c.a *=m.x * m.y;
gl_FragColor=vec4(clamp(c.rgb,0.0,1.0),c.a);
}
`},h=["gArvFolhas","gArvTempo","gArvVento","gArvLado"],i=1.7,r=`
uniform highp sampler2D gArvFolhas;
uniform float gArvLado;
vec4 arvFolha(float cel,vec2 uvL,out float mip){
vec2 c=vec2(mod(cel,4.0),floor(cel / 4.0 + 0.01));
vec2 dx=dFdx(uvL)* vec2(0.25,0.5)* 0.96;
vec2 dy=dFdy(uvL)* vec2(0.25,0.5)* 0.96;
vec2 u=cel > 6.5 ? fract(uvL): clamp(uvL,0.0,1.0);
vec2 uv=(c + vec2(0.02)+ u * 0.96)* vec2(0.25,0.5);
vec2 t=vec2(gArvLado,gArvLado * 0.5);
mip=max(0.0,0.5 * log2(max(dot(dx * t,dx * t),dot(dy * t,dy * t))));
return textureGrad(gArvFolhas,uv,dx,dy);
}
`,A={verticePars:`
attribute vec2 aArv;
attribute vec4 aInst;
uniform float gArvTempo;
uniform vec2 gArvVento;
varying vec2 vArvUv;
flat varying float vArvCel;
varying float vArvFade;
`,vertice:`
vArvUv=uv;
vArvCel=aArv.x;
vArvFade=aInst.z;
{
vec3 aOrig=vec3(instanceMatrix[ 3 ].x,instanceMatrix[ 3 ].y,instanceMatrix[ 3 ].z);
float fase=dot(aOrig.xz,vec2(0.131,0.071))+ aInst.y * 6.2831;
float w=aArv.y;
float onda=sin(gArvTempo * 1.1 + fase)* 0.6 + sin(gArvTempo * 2.3 + fase * 1.7)* 0.3;
transformed.xz +=gArvVento *(w * w * onda * 0.22);
if(aArv.x < 6.5)transformed +=objectNormal *(sin(gArvTempo * 4.7 + fase + position.y * 1.9 + position.x)* 0.035 * w * length(gArvVento));
}
`,cor:`
vColor.rgb *=(0.84 + 0.32 * aInst.x)* mix(vec3(1.0),vec3(1.07,1.03,0.82),aInst.y * aInst.y);
`,fragmentoPars:`
${r}
varying vec2 vArvUv;
flat varying float vArvCel;
varying float vArvFade;
float arvTrans;
`,mapa:`
float aMip;
vec4 aT=arvFolha(vArvCel,vArvUv,aMip);
diffuseColor.rgb *=aT.rgb * 2.0;
#ifdef ARV_LOD1
const float aDens=${i.toFixed(2)};
#else
const float aDens=1.0;
#endif
diffuseColor.a=vArvCel > 6.5 ? 1.0 : clamp(aT.a *(1.0 + aMip * 0.45)* aDens,0.0,1.0);
arvTrans=vArvCel > 6.5 ? 0.0 : 1.0;
if(vArvFade < 0.999){
float aH=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))* 43758.5453);
if(aH > vArvFade)discard;
}
`,luz:`
#if NUM_DIR_LIGHTS > 0
{
float aTr=pow(max(dot(-normalize(vViewPosition),directionalLights[ 0 ].direction),0.0),4.0)* 0.4 * arvTrans;
reflectedLight.directDiffuse +=diffuseColor.rgb * directionalLights[ 0 ].color * aTr;
reflectedLight.indirectDiffuse +=diffuseColor.rgb * directionalLights[ 0 ].color *(0.05 * arvTrans);
}
#endif
`},I={verticePars:`
attribute vec2 aArv;
varying vec2 vArvUv;
flat varying float vArvCel;
`,vertice:`
vArvUv=uv;
vArvCel=aArv.x;
`,fragmentoPars:`
${r}
varying vec2 vArvUv;
flat varying float vArvCel;
`,fragmento:`
{
float aMip;
vec4 aT=arvFolha(vArvCel,vArvUv,aMip);
if(vArvCel < 6.5 && aT.a *(1.0 + aMip * 0.45)* ${i.toFixed(2)} < 0.5)discard;
}
`},a=o=>Number.isInteger(o)?`${o}.0`:String(o),p=`
const float IMP_AZ=${a(8)};
const float IMP_QUADROS=${a(t)};
vec3 impostorQuadros(vec3 d){
float el=degrees(asin(clamp(d.y,-1.0,1.0)));
if(el >=${a(l)})return vec3(IMP_QUADROS - 1.0,IMP_QUADROS - 1.0,0.0);
float anel=el < ${a(c)} ? 0.0 : 1.0;
float az=atan(d.z,d.x)/ 6.2831853;
if(az < 0.0)az +=1.0;
float x=az * IMP_AZ;
float i=mod(floor(x),IMP_AZ);
return vec3(anel * IMP_AZ + i,anel * IMP_AZ + mod(i + 1.0,IMP_AZ),x - floor(x));
}
vec3 impostorDirecao(float k){
if(k > IMP_QUADROS - 1.5)return vec3(0.0,1.0,0.0);
float anel=floor(k / IMP_AZ + 0.01);
float az=mod(k,IMP_AZ)/ IMP_AZ * 6.2831853;
float el=radians(anel < 0.5 ? ${a(e[0])} : ${a(e[1])});
return vec3(cos(el)* cos(az),sin(el),cos(el)* sin(az));
}
vec2 impostorUv(float k,vec3 L,vec3 d){
if(k > IMP_QUADROS - 1.5){
vec3 q=L - d *(L.y / max(d.y,0.2));
return 0.5 + 0.5 * vec2(q.x,-q.z);
}
vec3 dk=impostorDirecao(k);
vec3 dir=normalize(cross(vec3(0.0,1.0,0.0),dk));
vec3 cima=cross(dk,dir);
return 0.5 + 0.5 * vec2(dot(L,dir),dot(L,cima));
}
`,y={vertice:`
attribute vec2 aArv;
varying vec2 vArvUv;
flat varying float vArvCel;
varying vec3 vCor;
varying vec3 vNormalArv;
void main(){
vArvUv=uv;
vArvCel=aArv.x;
vCor=color;
vNormalArv=normal;
gl_Position=projectionMatrix * modelViewMatrix * vec4(position,1.0);
}
`,fragmento:`
${r}
uniform float uModoNormal;
varying vec2 vArvUv;
flat varying float vArvCel;
varying vec3 vCor;
varying vec3 vNormalArv;
void main(){
float aMip;
vec4 aT=arvFolha(vArvCel,vArvUv,aMip);
if(vArvCel < 6.5 && aT.a < 0.5)discard;
if(uModoNormal > 0.5)gl_FragColor=vec4(normalize(vNormalArv)* 0.5 + 0.5,1.0);
else gl_FragColor=vec4(sqrt(clamp(vCor * aT.rgb * 2.0,0.0,1.0)),1.0);
}
`},L={verticePars:`
attribute vec4 aImpPos;
attribute vec2 aImpEsc;
attribute vec4 aInst;
uniform vec2 gImpEsfera[ 8 ];
${p}
flat varying vec4 vImpQ;
varying vec4 vImpUv;
flat varying vec2 vImpGiro;
flat varying vec2 vImpTom;
varying float vImpFade;
`,vertice:`
int aEsp=int(aInst.w * 255.0 + 0.5);
vec2 aEf=gImpEsfera[ aEsp ];
vec3 aC=aImpPos.xyz + vec3(0.0,aEf.x * aImpEsc.y,0.0);
float aR=aEf.y * max(aImpEsc.x,aImpEsc.y);
vec3 aParaCam=normalize(cameraPosition - aC);
vec3 aDir=cross(vec3(0.0,1.0,0.0),aParaCam);
aDir=dot(aDir,aDir)> 1e-6 ? normalize(aDir): vec3(1.0,0.0,0.0);
vec3 aCima=cross(aParaCam,aDir);
vec3 aP=aC +(aDir * position.x + aCima * position.y)* aR;
vec3 transformed=aP;
float aCg=cos(aImpPos.w);
float aSg=sin(aImpPos.w);
mat2 aRot=mat2(aCg,aSg,-aSg,aCg);
vec3 aDl=aParaCam;
aDl.xz=aRot * aDl.xz;
aDl=normalize(aDl / vec3(aImpEsc.x,aImpEsc.y,aImpEsc.x));
vec3 aL=aP - aC;
aL.xz=aRot * aL.xz;
aL /=vec3(aImpEsc.x,aImpEsc.y,aImpEsc.x)* aEf.y;
vec3 aQ=impostorQuadros(aDl);
vImpQ=vec4(aQ,float(aEsp));
vImpUv=vec4(impostorUv(aQ.x,aL,aDl),impostorUv(aQ.y,aL,aDl));
vImpGiro=vec2(aCg,aSg);
vImpTom=aInst.xy;
vImpFade=aInst.z;
objectNormal=aParaCam;
`,fragmentoPars:`
uniform highp sampler2D gImpCor;
uniform highp sampler2D gImpNormal;
uniform vec2 gImpAtlas;
flat varying vec4 vImpQ;
varying vec4 vImpUv;
flat varying vec2 vImpGiro;
flat varying vec2 vImpTom;
varying float vImpFade;
vec3 impNormal;
vec4 impLer(highp sampler2D t,float k,vec2 uv,float lod){
if(any(lessThan(uv,vec2(0.0)))|| any(greaterThan(uv,vec2(1.0))))return vec4(0.0);
return textureLod(t,(vec2(k,vImpQ.w)+ uv)/ gImpAtlas,lod);
}
`,mapa:`
vec2 aDx=dFdx(vImpUv.xy)* vec2(textureSize(gImpCor,0))/ gImpAtlas;
vec2 aDy=dFdy(vImpUv.xy)* vec2(textureSize(gImpCor,0))/ gImpAtlas;
float aLod=clamp(0.5 * log2(max(dot(aDx,aDx),dot(aDy,aDy))),0.0,3.5);
vec4 aCa=impLer(gImpCor,vImpQ.x,vImpUv.xy,aLod);
vec4 aCb=impLer(gImpCor,vImpQ.y,vImpUv.zw,aLod);
vec4 aNa=impLer(gImpNormal,vImpQ.x,vImpUv.xy,aLod);
vec4 aNb=impLer(gImpNormal,vImpQ.y,vImpUv.zw,aLod);
vec4 aCor=mix(aCa,aCb,vImpQ.z);
vec4 aNor=mix(aNa,aNb,vImpQ.z);
float aA=aCor.a;
vec3 aAlb=aCor.rgb / max(aA,1e-3);
diffuseColor.rgb *=aAlb * aAlb *(0.84 + 0.32 * vImpTom.x)* mix(vec3(1.0),vec3(1.07,1.03,0.82),vImpTom.y * vImpTom.y);
diffuseColor.a=clamp(aA *(1.0 + aLod * 0.35),0.0,1.0);
vec3 aNl=aNor.rgb / max(aNor.a,1e-3)* 2.0 - 1.0;
aNl.xz=mat2(vImpGiro.x,-vImpGiro.y,vImpGiro.y,vImpGiro.x)* aNl.xz;
impNormal=normalize(aNl);
if(vImpFade < 0.999){
float aH=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))* 43758.5453);
if(aH > vImpFade)discard;
}
`,normal:`
normal=normalize((viewMatrix * vec4(impNormal,0.0)).xyz);
`,luz:`
#if NUM_DIR_LIGHTS > 0
{
float aTr=pow(max(dot(-normalize(vViewPosition),directionalLights[ 0 ].direction),0.0),4.0)* 0.3;
reflectedLight.directDiffuse +=diffuseColor.rgb * directionalLights[ 0 ].color * aTr;
reflectedLight.indirectDiffuse +=diffuseColor.rgb * directionalLights[ 0 ].color * 0.05;
}
#endif
`};function C(){}export{i as ARV_DENS_LOD1,f as CORES_COPA,A as GLSL_ARVORE,r as GLSL_ARV_ATLAS,I as GLSL_ARV_SOMBRA,m as GLSL_COPA,n as GLSL_FOLHA_TOM,x as GLSL_GERAR_FOLHAS,L as GLSL_IMPOSTOR,y as GLSL_IMP_ASSAR,p as GLSL_IMP_QUADROS,u as LADO_FOLHAS,h as UNIFORMES_ARVORE,C as registrar,s as vec3Linear};
