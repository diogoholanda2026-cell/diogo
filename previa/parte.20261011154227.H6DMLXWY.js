import{a as g,b as a}from"./parte.20261011154227.WMXISCKJ.js";import"./parte.20261011154227.L5CKLLCT.js";import"./parte.20261011154227.BQDRZNIW.js";import"./parte.20261011154227.UWSGNFNN.js";import"./parte.20261011154227.BTUNWWMN.js";import"./parte.20261011154227.TWB47F47.js";import"./parte.20261011154227.Z7INZF66.js";var e=`
attribute vec4 aObra;
attribute vec4 aAux;
uniform highp sampler2D gPredTab;
uniform highp sampler2D gPredObra;
uniform float gTique;
uniform vec3 gCorHolding;
flat varying vec4 vObra;
varying vec3 vFace;
${g}
${a}
vec4 gDadosObra(float idx,out bool holding){
uint i=uint(idx + 0.5);
ivec2 t=ivec2(int(i % 512u),int(i / 512u));
uint b=uint(texelFetch(gPredTab,t,0).g * 255.0 + 0.5);
holding=(b & B_HOLDING)!=0u;
if((b & B_OBRA)==0u)return vec4(0.0);
vec4 ob=texelFetch(gPredObra,t,0);
return vec4(gProgressoObra(ob),ob.b,ob.a,(b & B_NIVEL)!=0u ? 2.0 : 1.0);
}
vec2 gGira(vec2 v,float a){float c=cos(a);float s=sin(a);return vec2(c * v.x + s * v.y,-s * v.x + c * v.y);}
vec2 gRot2(vec2 v,float a){float c=cos(a);float s=sin(a);return vec2(c * v.x - s * v.y,s * v.x + c * v.y);}
bool gE(float t,float k){return abs(t - k)< 0.5;}
float gHash1(float x){return fract(sin(x * 12.9898 + 4.1414)* 43758.5453);}
float gTri(float x){return abs(fract(x)* 2.0 - 1.0);}
vec3 gCicloCaminhao(float idx,float k){
float c=84.0;
float t=mod(gTique + gHash1(idx + 3.7 + k * 5.3)* c,c);
if(t < 12.0){float u=1.0 - t / 12.0;return vec3(-52.0 * u * u,1.0,1.0);}
if(t < 62.0)return vec3(0.0,1.0,0.0);
if(t < 74.0){float u=(t - 62.0)/ 12.0;return vec3(52.0 * u * u,1.0,1.0);}
return vec3(0.0);
}
float gCicloEscavadeira(float idx){return fract(gTique / 16.0 + gHash1(idx));}
vec4 gCicloGrua(float u){
float sA=smoothstep(0.20,0.46,u)- smoothstep(0.56,0.86,u);
float sR=smoothstep(0.22,0.44,u)- smoothstep(0.58,0.84,u);
float d1=smoothstep(0.0,0.10,u)- smoothstep(0.16,0.26,u);
float d2=smoothstep(0.44,0.52,u)- smoothstep(0.54,0.60,u);
return vec4(sA,sR,d1,d2);
}
vec2 gPontoEstaca(float k,float nx,float sx,float sz){
float j=floor(k / nx);
float i=k - j * nx;
if(mod(j,2.0)> 0.5)i=nx - 1.0 - i;
return vec2(i * sx,j * sz);
}
`,o=`
flat varying vec4 vObra;
varying vec3 vFace;
uniform vec3 gCorHolding;
uniform float gTique;
float gObraRug=0.85;
float gObraMet=0.0;
vec3 gObraEmis=vec3(0.0);
vec3 gLinC(vec3 c){return pow(c / 255.0,vec3(2.2));}
float gIntO(float x,float a,float b){return floor(x)*(b - a)+ clamp(fract(x),a,b)- a;}
float gPulsoO(float x,float a,float b,float dx){
float w=max(dx,1e-4);
return clamp((gIntO(x + 0.5 * w,a,b)- gIntO(x - 0.5 * w,a,b))/ w,0.0,1.0);
}
float gLinhaO(float x,float l,float dx){return gPulsoO(x + 0.5 * l,0.0,l,dx);}
`,t=`
{
bool gHold;
vec4 gD=gDadosObra(aObra.x,gHold);
float gT0=aObra.y;
bool gFe=gT0 > 31.5;
float gT=gFe ? gT0 - 32.0 : gT0;
float gP=gD.x;
float gW=aObra.w;
float gIdx=aObra.x;
float gAge=gFe ? gTique - aAux.x : 0.0;
bool gNova=gD.w > 0.5 && gD.w < 1.5;
float gEsq=gAlturaEsqueleto(gP,gD.z);
float gTopoEsq=gD.y + gEsq;
float gY0=instanceMatrix[ 3 ][ 1 ];
vec3 gC0=instanceMatrix[ 0 ].xyz;
vec3 gC2=instanceMatrix[ 2 ].xyz;
float gHh=length(instanceMatrix[ 1 ].xyz);
float gWw=length(gC0);
float gDd=length(gC2);
bool gVer=gFe || gD.w > 0.5;
float gTopo=1e9;
float gSh=0.0;
float gAlfa=1.0;
float gSz=0.0;
vec3 gBo=vec3(0.0);
bool gBill=gT > 11.5 && gT < 13.5;
float gQ=(gEsq + 8.0)/ 4.0;
float gTn=min(gD.z,4.0 *(floor(gQ)+ smoothstep(0.8,1.0,fract(gQ))));
if(gFe){
gVer=false;
if(gE(gT,5.0)|| gE(gT,2.0)|| gE(gT,3.0)){
float gS=clamp((gAge - 1.5 - aObra.z * 5.0)/ 4.0,0.0,1.0);
gVer=gS < 0.999;
transformed.y -=gS * 1.2;
}else if(gE(gT,4.0)){
gVer=gAge < 9.0;
float gS=max(gAge - 1.0,0.0);
transformed.z +=0.9 * gS * gS / gDd;
}else if(gE(gT,14.0)){
gVer=gAge < 16.0;
if(gW < 0.5)transformed.y *=smoothstep(0.0,2.5,gAge);
else{
gVer=gVer && gAge > 2.0;
transformed.x=(position.x + 0.5)* smoothstep(2.0,4.0,gAge)- 0.5;
transformed.z +=0.1 * sin(position.x * 7.0 - gTique * 5.0)*(position.x + 0.5)/ gDd;
}
}else if(gE(gT,13.0)){
float gA2=gAge - aObra.z * 1.2;
gVer=gA2 > 0.0 && gA2 < 7.0;
float gTw=0.5 + 0.5 * sin(gA2 * 9.0 + aObra.z * 30.0);
gSz=gWw *(1.0 - gA2 / 7.0)*(0.6 + 0.8 * gTw);
gBo=vec3(0.0,gA2 * 0.9,0.0)+ vec3(sin(aObra.z * 40.0),0.0,cos(aObra.z * 40.0))* gA2 * 0.35;
}
}else{
if(gT < 0.5){gVer=gVer && gNova && gP > OBRA_F1;gTopo=gTopoEsq;}
else if(gT < 1.5)gVer=gVer && gNova && gP > OBRA_F1 && gTopoEsq >=gY0 + gHh - 0.01;
else if(gT < 2.5)gVer=gVer && gNova;
else if(gT < 3.5){
gVer=gVer && gNova && gP < OBRA_F2;
transformed.y *=mix(1.0,0.3,smoothstep(OBRA_F0,OBRA_F2,gP));
}else if(gT < 4.5){
vec3 gCi=gCicloCaminhao(gIdx,0.0);
gVer=gVer && gNova && gP > OBRA_F0 && gP < OBRA_F2 && gCi.y > 0.5;
transformed.z +=gCi.x / gDd;
}else if(gT < 5.5){
}else if(gT < 6.5){
#ifdef OBRA_SOMBRA
gVer=gVer && gNova;
gTopo=gD.y + gAlturaPronta(gP,gD.z);
#else
gVer=false;
#endif
}else if(gT < 7.5){
float gN=max(floor(gW / 64.0),1.0);
float gK=gW - floor(gW / 64.0)* 64.0;
float gTs=0.012 +(gK + 0.7)/ gN * 0.14;
gVer=gVer && gNova && gP > gTs && gP < OBRA_F1;
transformed.y *=smoothstep(gTs,gTs + 0.004,gP);
}else if(gT < 9.5){
bool gAlto=gT > 8.5;
float gPe=gAlto ? max(2.6,floor(gW / 1000.0)/ 100.0): 3.0;
float gLen=gAlto ? gW - floor(gW / 1000.0)* 1000.0 : gW;
float gPh=aObra.z * 13.0 + gTique *(0.045 + 0.02 * aObra.z);
float gWk=clamp((gTri(gPh)- 0.2)/ 0.6,0.0,1.0);
float gMov=step(0.001,gWk)* step(gWk,0.999);
transformed.x +=(gWk - 0.5)* gLen / gWw;
float gBob=gMov * 0.05 * abs(sin(gTique * 6.0 + aObra.z * 20.0))/ gHh;
transformed.y +=gBob;
gSh=gBob;
if(gAlto){
float gTp=min(gTopoEsq,gD.y + gD.z);
float gOff=gPe * floor(max(gTp - gY0,0.0)/ gPe + 1e-3)/ gHh;
transformed.y +=gOff;
gSh +=gOff;
gVer=gVer && gNova && gP > OBRA_F1 + 0.02 && gP < 0.985;
}else gVer=gVer && gP < 0.99;
}else if(gT < 10.5){
gVer=gVer && gNova && gP > OBRA_F1;
gTopo=gD.y + gTn;
}else if(gT < 11.5){
float gYb=gD.y + gTn -(gW < 0.5 ? 3.2 : 1.8);
gVer=gVer && gNova && gP > OBRA_F1 && gTn < gD.z - 0.3 && gYb > gY0 - 0.5;
float gOff=(gYb - gY0)/ gHh;
transformed.y +=gOff;
gSh=gOff;
}else if(gT < 12.5){
float gAg=fract(gTique /(6.0 + 4.0 * aObra.z)+ aObra.z * 7.0);
float gAct=1.0;
float gLim=OBRA_F1;
if(gW < 0.5){
float gC=gCicloEscavadeira(gIdx);
gAct=smoothstep(0.02,0.08,gC)*(1.0 - smoothstep(0.22,0.30,gC));
}else if(gW < 1.5){
vec3 gCi=gCicloCaminhao(gIdx,0.0);
gAct=gCi.z * gCi.y;
gLim=OBRA_F2;
gBo +=normalize(gC2)* gCi.x;
}else{
float gC=gCicloEscavadeira(gIdx);
gAct=smoothstep(0.44,0.50,gC)*(1.0 - smoothstep(0.58,0.68,gC));
}
gVer=gVer && gNova && gP > 0.012 && gP < gLim && gAct > 0.02;
gSz=gWw *(0.7 + 1.3 * gAg);
gBo +=vec3(0.9,2.2,0.4)* gAg *(0.6 + aObra.z)+ vec3(sin(aObra.z * 50.0),0.0,cos(aObra.z * 50.0))* 0.6;
gAlfa=0.95 * gAct *(1.0 - 0.7 * gAg)* smoothstep(0.0,0.1,gAg);
}else if(gT < 13.5){
float gKd=mod(gW,8.0);
float gPe=max(2.6,floor(gW / 8.0)/ 100.0);
float gQd=floor(gTique * 6.0)+ aObra.z * 91.0 + gIdx;
float gBl=step(0.45,gHash1(gQd));
gSz=gWw *(0.7 + 0.6 * gHash1(gQd + 1.0));
gBo=vec3(gHash1(gQd + 2.0)- 0.5,gHash1(gQd + 3.0)* 0.3,gHash1(gQd + 4.0)- 0.5)* 0.6;
if(gKd < 0.5){
float gTp=min(gTopoEsq,gD.y + gD.z);
gBo.y +=gPe * floor(max(gTp - gY0,0.0)/ gPe + 1e-3)+ 0.3;
gVer=gVer && gNova && gP > OBRA_F1 + 0.02 && gP < 0.98 && gBl > 0.5;
}else{
gBo.y +=0.35;
gVer=gVer && gNova && gP > 0.02 && gP < OBRA_F1 && gBl > 0.5;
}
}else if(gT < 14.5){
gVer=false;
}else if(gT < 15.5){
float gGr=smoothstep(0.012,OBRA_F0,gP)*(1.0 - 0.85 * smoothstep(OBRA_F0 +(OBRA_F1 - OBRA_F0)* 0.3,OBRA_F1,gP));
gVer=gVer && gNova && gP < OBRA_F1 && gGr > 0.03;
transformed.y *=gGr;
transformed.xz *=mix(1.0,0.35,step(0.5,position.y))* mix(0.5,1.0,gGr);
}else if(gT < 16.5){
vec3 gCi=gCicloCaminhao(gIdx,1.0);
gVer=gVer && gNova && gP > 0.012 && gP < OBRA_F1 && gCi.y > 0.5;
transformed.z +=gCi.x / gDd;
}else{
float gRoof=gD.y + gD.z;
float gPl=mix(gRoof - 1.0,gD.y + 2.2,smoothstep(0.90,0.995,gP));
gVer=gVer && gNova && gP > 0.9 && gD.z > 8.0;
if(gW < 1.5){
transformed.y +=(gPl - gY0)/ gHh;
gSh=(gPl - gY0)/ gHh;
}else{
transformed.y=position.y *(gRoof - gPl)/ gHh +(gPl - gY0)/ gHh;
gSh=(gPl - gY0)/ gHh;
}
}
}
#ifdef OBRA_SOMBRA
if(gT > 6.5)gVer=false;
#endif
if(gTopo < 1e8){
gVer=gVer && gTopo > gY0 + 0.05;
if(position.y > 0.5)transformed.y=min(1.0,(gTopo - gY0)/ gHh);
}
if(gBill){
if(normal.z < 0.5)gVer=false;
vec3 gR=vec3(viewMatrix[ 0 ][ 0 ],viewMatrix[ 1 ][ 0 ],viewMatrix[ 2 ][ 0 ]);
vec3 gU=vec3(viewMatrix[ 0 ][ 1 ],viewMatrix[ 1 ][ 1 ],viewMatrix[ 2 ][ 1 ]);
vec3 gV=gR *(position.x * gSz)+ gU *((position.y - 0.5)* gSz)+ gBo;
vec3 gC1=instanceMatrix[ 1 ].xyz;
transformed=vec3(dot(gV,gC0)/ dot(gC0,gC0),dot(gV,gC1)/ dot(gC1,gC1),dot(gV,gC2)/ dot(gC2,gC2));
}
if(!gVer)transformed=vec3(0.0);
vObra=vec4(gT,gHold ? 1.0 : 0.0,aObra.z,gW);
vFace=gBill ? vec3(position.x * 2.0,(position.y - 0.5)* 2.0,gAlfa): vec3(abs(normal.x)> 0.5 ? position.z * gDd : position.x * gWw,(transformed.y - gSh)* gHh,abs(normal.y)> 0.5 ? 1.0 : 0.0);
}
`,r=`
{
float gT=vObra.x;
float gK=vObra.w;
float gH=vObra.z;
vec3 c=vec3(0.48,0.46,0.43);
float gA=1.0;
if(gT < 1.5){
float forma=gLinhaO(fract(vFace.x / 1.2 + 0.5)- 0.5,0.03,fwidth(vFace.x)/ 1.2);
c=vec3(0.4,0.39,0.37)*(0.9 + 0.12 * gH)*(1.0 - 0.15 * forma);
gObraRug=0.9;
}else if(gT < 2.5){
if(gK < 0.5){
c=gH < 0.55 ? vec3(0.6,0.6,0.58): vec3(0.06,0.13,0.26);
c *=0.9 + 0.1 * cos(vFace.x * 20.94);
float jan=gPulsoO(vFace.x * 0.25 + 0.5,0.55,0.8,fwidth(vFace.x)* 0.25)* gPulsoO(vFace.y / 2.6,0.45,0.8,fwidth(vFace.y)/ 2.6);
c=mix(c,vec3(0.03,0.035,0.04),jan *(1.0 - vFace.z));
gObraMet=0.3;
gObraRug=0.55;
}else{
c=gH < 0.5 ? vec3(0.5,0.25,0.03): vec3(0.32,0.33,0.12);
if(vFace.z > 0.5)c=vec3(0.22,0.19,0.16);
gObraMet=0.35;
gObraRug=0.6;
}
}else if(gT < 3.5){
c=gK < 0.5 ? vec3(0.36,0.15,0.08)*(0.85 + 0.2 * step(0.5,fract(vFace.y / 0.2))): vec3(0.48,0.4,0.27);
}else if(gT < 4.5){
c=gK < 0.5 ? vec3(0.62,0.62,0.6): vec3(0.6,0.27,0.04);
if(gK > 0.5)c *=1.0 - 0.3 * step(0.5,fract(vFace.x * 0.55 - gTique * 0.6));
gObraMet=0.25;
gObraRug=0.45;
}else if(gT < 5.5){
if(gK < 0.5){
vec3 base=vObra.y > 0.5 ? gLinC(gCorHolding): gH < 0.6 ? vec3(0.62,0.62,0.6): vec3(0.05,0.15,0.08);
float nerv=gPulsoO(vFace.x / 0.25,0.0,0.2,fwidth(vFace.x)/ 0.25);
c=base *(1.0 - 0.14 * nerv);
float faixa=gPulsoO(vFace.y / 2.2,0.68,0.8,fwidth(vFace.y)/ 2.2);
c=mix(c,vObra.y > 0.5 ? vec3(0.62): vec3(0.03,0.09,0.24),faixa);
c *=mix(0.75,1.0,smoothstep(0.0,0.5,vFace.y));
gObraMet=0.35;
gObraRug=0.5;
}else if(gK < 1.5){
float az=step(0.72,vFace.y / 2.0);
float logo=gPulsoO(vFace.x / 3.0 + 0.5,0.06,0.32,fwidth(vFace.x)/ 3.0)* gPulsoO(vFace.y / 2.0,0.1,0.62,fwidth(vFace.y)/ 2.0);
c=mix(vec3(0.7),vObra.y > 0.5 ? gLinC(gCorHolding): vec3(0.02,0.07,0.25),max(az,logo * 0.85));
if(vFace.z > 0.5)c=vec3(0.3);
gObraRug=0.6;
}else{
c=vec3(0.18);
gObraMet=0.6;
gObraRug=0.5;
}
}else if(gT < 6.5){
c=vec3(0.4);
}else if(gT < 7.5){
float estribo=gLinhaO(fract(vFace.y / 0.35 + 0.5)- 0.5,0.09,fwidth(vFace.y)/ 0.35);
gA=max(step(0.17,abs(vFace.x)),estribo);
if(vFace.z > 0.5)gA=0.0;
c=vec3(0.2,0.09,0.05);
gObraMet=0.4;
gObraRug=0.7;
}else if(gT < 9.5){
float y=vFace.y;
c=y < 0.85 ? vec3(0.045,0.06,0.13): y < 1.52 ? vec3(0.8,0.26,0.02): y < 1.63 ? vec3(0.4,0.26,0.18): gH < 0.5 ? vec3(0.78): vec3(0.85,0.62,0.05);
c=mix(c,vec3(0.7),step(1.12,y)* step(y,1.2));
gObraRug=0.85;
}else if(gT < 10.5){
float junta=gLinhaO(fract(vFace.y / 4.0 + 0.5)- 0.5,0.012,fwidth(vFace.y)/ 4.0);
float tir=gLinhaO(fract(vFace.x / 1.2 + 0.5)- 0.5,0.012,fwidth(vFace.x)/ 1.2);
c=vec3(0.43,0.42,0.4)*(0.92 + 0.1 * gH)*(1.0 - 0.28 * max(junta,tir * 0.5));
gObraRug=0.92;
}else if(gT < 11.5){
if(gK < 0.5){
float pv=gLinhaO(fract(vFace.x / 1.5 + 0.5)- 0.5,0.025,fwidth(vFace.x)/ 1.5);
float ph=gLinhaO(fract(vFace.y / 1.8 + 0.5)- 0.5,0.02,fwidth(vFace.y)/ 1.8);
c=vec3(0.55,0.33,0.03)*(1.0 - 0.35 * max(pv,ph));
gObraMet=0.5;
gObraRug=0.5;
}else{
c=vec3(0.13,0.13,0.14);
if(vFace.z < 0.5)c=vec3(0.55,0.33,0.03);
gObraMet=0.5;
gObraRug=0.6;
}
}else if(gT < 12.5){
float r=length(vFace.xy);
gA=vFace.z *(1.0 - smoothstep(0.3,1.0,r));
c=vec3(0.46,0.41,0.35)*(1.1 - 0.3 * r);
gObraRug=1.0;
}else if(gT < 13.5){
float r=length(vFace.xy);
gA=1.0 - smoothstep(0.55,1.0,r);
bool brilho=mod(gK,8.0)> 1.5;
c=brilho ? vec3(1.0,0.85,0.5): vec3(1.0,0.7,0.3);
gObraEmis=(brilho ? vec3(7.0,5.0,2.2): vec3(12.0,5.5,1.4))*(1.0 - 0.6 * r);
}else if(gT < 14.5){
if(gK < 0.5){
c=vec3(0.55);
gObraMet=0.6;
gObraRug=0.4;
}else{
c=vObra.y > 0.5 ? gLinC(gCorHolding): vec3(0.02,0.07,0.25);
c=mix(c,vec3(0.75),step(0.4,vFace.y)* step(vFace.y,0.6)*(vObra.y > 0.5 ? 0.0 : 1.0));
gObraRug=0.75;
}
}else if(gT < 15.5){
c=vec3(0.27,0.19,0.12)*(0.8 + 0.4 * fract(sin(floor(vFace.x * 2.0)* 12.9 + floor(vFace.y * 3.0)* 7.7 + gH * 31.0)* 4375.5));
gObraRug=1.0;
}else if(gT < 16.5){
c=gK < 0.5 ? vec3(0.62,0.62,0.6): vec3(0.55,0.33,0.04);
gObraMet=0.25;
gObraRug=0.5;
}else{
if(gK < 0.5){
c=vec3(0.3,0.23,0.13);
if(vFace.z < 0.5)c=vec3(0.55,0.33,0.03);
}else if(gK < 1.5){
gA=max(gLinhaO(fract(vFace.x / 0.25 + 0.5)- 0.5,0.2,fwidth(vFace.x)/ 0.25),step(0.85,vFace.y));
c=vec3(0.5);
}else{
c=vec3(0.04);
gObraMet=0.6;
}
}
if(gA < 0.03)discard;
diffuseColor=vec4(c,gA);
}
`,l=`
{
bool gHold;
vec4 gD=gDadosObra(aObra.x,gHold);
float gT=aObra.y;
float gP=gD.x;
float gB=gD.y;
float gHp=gD.z;
float gEsq=gAlturaEsqueleto(gP,gHp);
float gA=gB;
float gZ=gB;
if(gD.w > 0.5 && gD.w < 1.5){
if(gT < 0.5){if(gP > OBRA_F1){gA=gB - 0.2;gZ=gB + min(gHp,gEsq)+ 1.2;}}
else if(gP > OBRA_F2){
gA=gB + max(gAlturaPronta(gP,gHp),0.0);
gZ=min(gB + gEsq + 0.8,gA + 10.0);
}
}else if(gD.w > 1.5){
gZ=gB + gHp + 1.0;
gA=gB + 2.0 +(gHp - 2.0)* smoothstep(0.6,1.0,gP);
}
float gHh=length(instanceMatrix[ 1 ].xyz);
float gIb=instanceMatrix[ 3 ][ 1 ];
gA=max(gA,gIb - 0.2);
gZ=min(gZ,gIb + gHh + 1.2);
if(gZ - gA < 0.3)transformed=vec3(0.0);
else transformed.y=(mix(gA,gZ,position.y)- gIb)/ gHh;
vec3 gE=vec3(length(instanceMatrix[ 0 ].xyz),gHh,length(instanceMatrix[ 2 ].xyz));
vObra=vec4(gT,gHold ? 1.0 : 0.0,aObra.z,0.0);
vFace=vec3(abs(normal.x)> 0.5 ? position.z * gE.z : position.x * gE.x,mix(gA,gZ,position.y)- gB,0.0);
}
`,f=`
{
vec2 gU=vFace.xy;
vec2 gDd=max(fwidth(gU),vec2(1e-4));
float gA=0.0;
vec3 c=vec3(0.4);
if(vObra.x < 0.5){
vec2 q=gU / 2.0;
vec2 dq=gDd / 2.0;
float mont=gLinhaO(fract(q.x + 0.5)- 0.5,0.03,dq.x);
float trav=gLinhaO(fract(q.y + 0.5)- 0.5,0.03,dq.y);
float tabua=gPulsoO(q.y,0.0,0.11,dq.y);
float diag=gLinhaO(fract(q.x - q.y + 0.5)- 0.5,0.025,dq.x + dq.y)* step(0.5,fract(floor(q.x)* 0.5));
gA=max(max(mont,trav),max(tabua,diag));
c=tabua > max(mont,trav)? vec3(0.3,0.2,0.1): vec3(0.36,0.37,0.38);
gObraMet=tabua > 0.5 ? 0.0 : 0.6;
gObraRug=tabua > 0.5 ? 0.9 : 0.45;
gA=mix(gA,0.42,smoothstep(0.25,0.8,max(dq.x,dq.y)* 10.0));
}else{
c=vObra.z < 0.6 ? vec3(0.045,0.12,0.065): vec3(0.035,0.075,0.17);
float rolo=floor(gU.x / 1.6);
c *=0.82 + 0.3 * fract(sin(rolo * 12.9898 + vObra.z * 78.233)* 43758.5453);
float emenda=gLinhaO(fract(gU.x / 1.6 + 0.5)- 0.5,0.04,gDd.x / 1.6);
float laje=gLinhaO(fract(gU.y / 3.0 + 0.5)- 0.5,0.06,gDd.y / 3.0);
float fecha=max(emenda,laje);
c *=1.0 - 0.35 * fecha;
gA=mix(0.6,0.95,fecha);
gObraRug=0.8;
}
if(gA < 0.03)discard;
diffuseColor=vec4(c,gA);
}
`,c=`
attribute float aParte;
attribute float aModelo;
attribute vec4 aTrel;
`,i=`
{
bool gHold;
vec4 gD=gDadosObra(aObra.x,gHold);
float gP=gD.x;
float gHp=gD.z;
float gL=aObra.w;
float gFase=aObra.z * 6.2832;
float gEsq=gAlturaEsqueleto(gP,gHp);
float gEs=max(gEsq,2.0);
bool gVer=gD.w > 0.5 && abs(aModelo - aObra.y)< 0.5;
vec3 gPos=transformed;
float gAo=0.0;
float gCls=aTrel.w;
float gU=fract((gTique + aObra.z * 70.0)/ 70.0);
vec4 gCi=gCicloGrua(gU);
float gCarga=step(0.15,gU)* step(gU,0.55);
if(aObra.y < 0.5){
gVer=gVer &&(gD.w > 1.5 || gP > OBRA_F0);
float gHm=max(14.0,(gD.w > 1.5 ? gHp : gEsq)+ 7.0);
if(aParte < 0.5){
gPos.y *=gHm;
gAo=gPos.y;
}else{
float gGiro=mix(aAux.y,aAux.z,gCi.x)+ 0.03 * sin(gTique * 0.31 + gFase);
if(aParte > 1.5 && aParte < 2.5)gPos.x=0.8 + gPos.x *(gL - 0.8);
gAo=aTrel.z > 1.5 ? gPos.x : gPos.y + gHm;
if(aParte > 2.5 && aParte < 4.5){
float gRp=mod(aAux.w,1024.0)/ 4.0;
float gRl=floor(aAux.w / 1024.0)/ 4.0;
float gCarro=clamp(mix(gRp,gRl,gCi.y),4.0,max(5.0,gL - 3.0));
float gLg=gHm - 1.4;
float gLc=max(3.0,gHm - gEs - 3.5);
float gLp=max(3.0,gHm - gEs - 1.0);
float gHl=gLc +(gLg - gLc)* gCi.z +(gLp - gLc)* gCi.w;
gPos.x +=gCarro;
if(aParte > 3.5){
gPos.y -=gHl - 1.0;
gVer=gVer && gCarga > 0.5;
gCls=gP > OBRA_F2 ? 6.0 : 5.0;
}else if(gPos.y > -0.95)gPos.y *=gHl;
else gPos.y -=gHl - 1.0;
}
gPos.xz=gGira(gPos.xz,gGiro);
gPos.y +=gHm;
}
}else if(aObra.y < 1.5){
gVer=gVer && gD.w < 1.5 && gP > OBRA_F1;
float gAlvo=max(gEsq,4.0)+ 4.0;
float gElP=clamp(atan(gAlvo - 3.2,gL * 0.75),0.35,1.25);
float gEl=mix(0.40,gElP,gCi.y);
float gSl=mix(-0.22,0.20,gCi.x)+ 0.02 * sin(gTique * 0.4 + gFase);
vec2 gTip=vec2(gL * cos(gEl)- 1.3,gL * sin(gEl)+ 3.4);
if(aParte > 5.5){
vec2 gXy=vec2(gPos.x * gL,gPos.y);
gAo=gXy.x;
gXy=vec2(gXy.x * cos(gEl)- gXy.y * sin(gEl),gXy.x * sin(gEl)+ gXy.y * cos(gEl));
gPos=vec3(gXy.x - 1.3,gXy.y + 3.4,gPos.z);
gPos.xz=gGira(gPos.xz + vec2(1.3,0.0),gSl)- vec2(1.3,0.0);
}else if(aParte > 2.5 && aParte < 4.5){
float gLg=max(2.0,gTip.y - 1.2);
float gLc=max(2.5,gTip.y - gEs - 5.0);
float gLp=max(2.0,gTip.y - gEs - 1.2);
float gHl=gLc +(gLg - gLc)* gCi.z +(gLp - gLc)* gCi.w;
vec3 q=gPos;
if(aParte > 3.5){
q.y -=gHl - 1.0;
gVer=gVer && gCarga > 0.5;
gCls=gP > OBRA_F2 ? 6.0 : 5.0;
}else if(q.y > -0.95)q.y *=gHl;
else q.y -=gHl - 1.0;
gPos=vec3(q.x + gTip.x,q.y + gTip.y,q.z);
gPos.xz=gGira(gPos.xz + vec2(1.3,0.0),gSl)- vec2(1.3,0.0);
}
}else if(aObra.y < 2.5){
gVer=gVer && gD.w < 1.5 && gP > 0.005 && gP < OBRA_F1;
float gC=gCicloEscavadeira(aObra.x);
float gLev=smoothstep(0.24,0.36,gC)- smoothstep(0.64,0.78,gC);
float gSw=1.9 *(smoothstep(0.26,0.44,gC)- smoothstep(0.60,0.78,gC));
float a1=0.30 + 0.55 * gLev;
float a2=-1.75 + 0.95 * gLev + 0.1 * sin(gC * 37.7)*(1.0 - gLev);
float a3=-0.95 + 1.55 * smoothstep(0.02,0.24,gC)- 1.55 * smoothstep(0.46,0.56,gC);
vec2 xy=gPos.xy * gL;
if(aParte > 10.5)xy=gRot2(xy,a3)+ vec2(2.4 * gL,0.0);
if(aParte > 9.5)xy=gRot2(xy,a2)+ vec2(4.2 * gL,0.0);
if(aParte > 8.5)xy=gRot2(xy,a1)+ vec2(1.0 * gL,1.4 * gL);
vec3 q=vec3(xy,gPos.z * gL);
if(aParte > 7.5)q.xz=gGira(q.xz,gSw);
gPos=q;
}else{
gVer=gVer && gD.w < 1.5 && gP > 0.012 && gP < 0.19;
float gNx=max(mod(gL,8.0),1.0);
float gNz=max(mod(floor(gL / 8.0),8.0),1.0);
float gSx=mod(floor(gL / 64.0),64.0);
float gSz=floor(gL / 4096.0);
float gKf=clamp((gP - 0.012)/ 0.14,0.0,0.9999)* gNx * gNz;
float gK=floor(gKf);
float gKk=fract(gKf);
vec2 gA0=gPontoEstaca(max(gK - 1.0,0.0),gNx,gSx,gSz);
vec2 gA1=gPontoEstaca(gK,gNx,gSx,gSz);
float gDr=smoothstep(0.30,0.52,gKk)- smoothstep(0.56,0.78,gKk);
gAo=gPos.y;
if(aParte > 11.5)gPos.x +=1.4;
if(aParte > 12.5)gPos.y +=mix(13.0,1.0,gDr);
gPos.xz +=mix(gA0,gA1,smoothstep(0.0,0.28,gKk));
}
if(!gVer)gPos=vec3(0.0);
transformed=gPos;
vObra=vec4(gCls,gHold ? 1.0 : 0.0,aObra.z,aTrel.z);
vFace=vec3(aTrel.x,gAo,aTrel.y);
}
`,s=`
{
float gC=vObra.x;
vec3 c=vObra.y > 0.5 ? gLinC(gCorHolding): vObra.z < 0.7 ? vec3(0.6,0.38,0.015): vec3(0.58,0.58,0.56);
float gA=1.0;
if(vObra.w > 0.5){
vec2 d=max(fwidth(vFace.xy),vec2(1e-4));
float m=max(vFace.z,0.1);
float corda=gPulsoO(abs(vFace.x)/ m,0.82,1.0,d.x / m);
float s=vFace.y / 1.6;
float trav=gLinhaO(fract(s + 0.5)- 0.5,0.07,d.y / 1.6);
float diag=gLinhaO(fract(s -(vFace.x / m)* 0.5 + 0.5)- 0.5,0.07,(d.x / m + d.y / 1.6));
gA=max(corda,max(trav,diag));
gA=mix(gA,0.6,smoothstep(0.3,1.0,d.x / m));
if(gA < 0.03)discard;
gObraMet=0.35;
gObraRug=0.5;
}
if(gC > 0.5 && gC < 1.5){c=vec3(0.42,0.41,0.39);gObraMet=0.0;gObraRug=0.9;}
else if(gC > 1.5 && gC < 2.5){c=vec3(0.62,0.62,0.6);gObraRug=0.4;}
else if(gC > 3.5 && gC < 4.5){c=vec3(0.02);gObraMet=0.5;gObraRug=0.5;}
else if(gC > 4.5 && gC < 5.5){c=vec3(0.26,0.1,0.05);gObraMet=0.3;gObraRug=0.8;}
else if(gC > 5.5 && gC < 6.5){c=vec3(0.42,0.56,0.64);gObraMet=0.6;gObraRug=0.2;}
else if(gC > 6.5 && gC < 7.5){c=vec3(0.045);gObraMet=0.2;gObraRug=0.9;}
else if(gC > 7.5 && gC < 8.5){c=vec3(0.78,0.5,0.02);gObraMet=0.3;gObraRug=0.5;}
else if(gC > 8.5){c=vec3(0.02,0.04,0.06);gObraMet=0.6;gObraRug=0.15;}
diffuseColor=vec4(c,gA);
}
`,x=Object.freeze({comumVertice:e,comumFragmento:o,caixas:{pars:"",vertice:t,cor:r},cascas:{pars:"",vertice:l,cor:f},gruas:{pars:c,vertice:i,cor:s}});function n(){}export{x as GLSL_OBRA,n as registrar};
