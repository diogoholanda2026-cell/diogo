import{a as i,c as s,f as c,g as e}from"./parte.20261008164809.6U5UNT5A.js";import{p as v}from"./parte.20261008164809.IBIKTCVW.js";var f=Object.entries(i).map(([a,o])=>`#define F_${a} ${o}.0`).join(`
`),g=s.map(a=>a.toFixed(2)).join(", "),l=Object.entries(c).map(([a,o])=>`#define B_${a} ${o}u`).join(`
`),p=l,d=v.map((a,o)=>`#define OBRA_F${o} ${a.ate.toFixed(4)}`).join(`
`),t=.3,r=3;var u=`
${d}
float gProgressoObra(vec4 ob){return clamp((gTique - ob.r)/ max(ob.g - ob.r,1.0),0.0,1.0);}
float gAlturaPronta(float p,float H){
if(p <=OBRA_F0)return -3.0;
if(p <=OBRA_F1)return -0.6 + ${(t+.6).toFixed(2)} * min(1.0,(p - OBRA_F0)/((OBRA_F1 - OBRA_F0)* 0.6));
if(p <=OBRA_F2)return ${t.toFixed(2)};
float t=min(1.0,(p - OBRA_F2)/(1.0 - OBRA_F2));
return max(${t.toFixed(2)},${r.toFixed(1)} * floor(H * t / ${r.toFixed(1)} + 1e-4));
}
float gAlturaEsqueleto(float p,float H){
if(p <=OBRA_F1)return 0.0;
return H * min(1.0,(p - OBRA_F1)/(OBRA_F2 - OBRA_F1));
}
`,y=`
#define EDIFICIO
${f}
#ifdef USE_INSTANCING
attribute vec4 aUnit;
attribute vec4 aTopo;
#else
attribute vec4 aFacUV;
attribute float aAO;
#endif
attribute vec4 aFac;
attribute vec4 aCorA;
attribute vec4 aCorB;
attribute uint aId;
uniform highp sampler2D gPredTab;
uniform highp sampler2D gPredObra;
uniform float gTique;
uniform vec3 gCorHolding;
varying vec4 vPF;
flat varying vec4 vFac;
flat varying vec4 vCor;
flat varying vec4 vIdent;
${l}
${u}
vec3 gOct(vec2 e){
vec3 v=vec3(e,1.0 - abs(e.x)- abs(e.y));
if(v.z < 0.0)v.xy=(1.0 - abs(v.yx))*(step(0.0,v.xy)* 2.0 - 1.0);
return normalize(v.xzy);
}
float gEmp(vec3 c){return floor(c.r + 0.5)* 65536.0 + floor(c.g + 0.5)* 256.0 + floor(c.b + 0.5);}
`,h=`
#ifdef USE_INSTANCING
vec3 objectNormal=vec3(normal);
#else
vec3 objectNormal=gOct(normal.xy);
#endif
#ifdef USE_TANGENT
vec3 objectTangent=vec3(tangent.xyz);
#endif
`,b=`
{
uint gIdx=aId & ${e-1>>>0}u;
vec4 gTab=texelFetch(gPredTab,ivec2(int(gIdx % 512u),int(gIdx / 512u)),0);
uint gBitsT=uint(gTab.g * 255.0 + 0.5);
vIdent=vec4(float(gIdx),float(gBitsT),gTab.b,floor(gTab.r * 255.0 + 0.5));
if((gBitsT & B_APAGADO)!=0u ||((gBitsT & B_ANEXO)!=0u)!=((aId & ${e>>>0}u)!=0u))transformed=vec3(0.0);
float gTipo=aFac.x;
vec3 gC1=aCorA.rgb;
vec3 gC2=aCorB.rgb;
if((gBitsT & B_HOLDING)!=0u){
gC2=mix(gC2,gCorHolding,0.7);
if(gTipo==F_LETREIRO || gTipo==F_TOLDO)gC1=gCorHolding;
}
float gBits=aFac.w;
float gVao=max(aFac.z * 0.1,0.5);
float gNB=1.0;
#ifdef USE_INSTANCING
vec3 gE=vec3(length(instanceMatrix[ 0 ].xyz),length(instanceMatrix[ 1 ].xyz),length(instanceMatrix[ 2 ].xyz));
float gK=aUnit.z;
float gEnt=step(127.5,aTopo.x);
float gTopoT=aTopo.x - 128.0 * gEnt;
float gParap=gTopoT==F_LAJE ? 0.9 : 0.0;
if(gK > 0.5 && gK < 1.5){
vPF=vec4(position.x * gE.x,position.z * gE.z,1e4,1.0);
gTipo=gTopoT;
gC1=aTopo.yzw;
gC2=aTopo.yzw * 0.85;
gBits=mod(gBits,32.0);
}else if(gK > 1.5){
float gL=length(vec2(0.5 * gE.z,gE.y));
vPF=vec4(aUnit.x * gE.x,aUnit.y * gL,1e4,1.0);
gTipo=gTopoT;
gC1=aTopo.yzw;
gC2=aTopo.yzw * 0.85;
gBits=mod(gBits,32.0);
}else{
float gW=aUnit.w < 0.5 ? gE.z : aUnit.w < 1.5 ? gE.x : 1.5708 *(gE.x + gE.z)*(aUnit.w > 2.5 ? 1.0 : 1.12);
gNB=max(1.0,floor(gW / gVao + 0.5));
float gH=position.y * gE.y - 2.0 * gEnt;
vPF=vec4(aUnit.x * gNB,gH,gE.y - 2.0 * gEnt - gParap,1.0);
if(normal.z < 0.5 || aUnit.w > 1.5)gBits=mod(gBits,32.0);
if((gTopoT==F_TELHA || gTopoT==F_FIBRO || gTopoT==F_TELHA_METAL)&& aUnit.y > 0.5){gTipo=F_LISO;}
}
#else
vPF=vec4(aFacUV.xyz,aAO);
gNB=max(1.0,floor(aFacUV.w / gVao + 0.5));
#endif
if((gBitsT &(B_OBRA | B_NIVEL))==B_OBRA){
vec4 gOb=texelFetch(gPredObra,ivec2(int(gIdx % 512u),int(gIdx / 512u)),0);
if(gOb.a > 0.0){
#ifdef USE_INSTANCING
mat4 gMI=modelMatrix * instanceMatrix;
bool gCima=aUnit.z > 0.5;
#else
mat4 gMI=modelMatrix;
bool gCima=objectNormal.y > 0.5;
#endif
float gYc=gOb.b + gAlturaPronta(gProgressoObra(gOb),gOb.a);
float gWy=gMI[ 1 ][ 1 ] * transformed.y + gMI[ 3 ][ 1 ];
if(gWy > gYc){
float gNy=gYc - 0.002 *(gWy - gYc);
transformed.y=(gNy - gMI[ 3 ][ 1 ])/ gMI[ 1 ][ 1 ];
if(!gCima)vPF.y -=gWy - gNy;
}
}
}
vFac=vec4(gTipo,aFac.y * 0.05,aFac.z * 0.1,gBits);
vCor=vec4(gEmp(gC1),gEmp(gC2),min(gNB,250.0)+ min(aCorA.a / 255.0,0.99),aCorB.a / 255.0);
}
`,m=`
#ifdef FAC_BARATA
void gJanelasLonge(inout GSup s,vec2 uv,vec2 duv,float andar,float vao,float nB,float vari,vec3 c2,float uso,float tipo){
float fv=uv.y / andar;
vec2 d=vec2(duv.x,duv.y / andar);
float lonje=gLonge(d);
float id=vIdent.x;
vec2 p=vec2(uv.x,fv);
float i=floor(uv.x);
float j=floor(fv);
vec2 h=gH2(vec3(i,j,id));
vec2 h2=gH2(vec3(i * 1.37 + 17.0,j * 1.13 + 3.0,id + 5.0));
bool fita=tipo==F_FITA;
float pad=mod(vari + floor(gH1(vec3(id,5.0,1.0))* 8.0),8.0);
float jj=min(i,nB - 1.0 - i);
vec4 rr=G_RITMO[ int(pad)];
float kk=mod(jj,4.0);
float tv=kk < 0.5 ? rr.x : kk < 1.5 ? rr.y : kk < 2.5 ? rr.z : rr.w;
if(nB >=5.0 && abs(i -(nB - 1.0)* 0.5)< 0.25 && pad > 3.5)tv=5.0;
if(tipo==F_CASA)tv=mod(i + pad,3.0)< 1.0 ? 1.0 :(mod(i + pad,3.0)< 2.0 ? 0.0 : 2.0);
if(uso > 1.5 || fita)tv=0.0;
float w=1.5;
float y0=1.0;
float y1=2.2;
if(tv > 0.5 && tv < 1.5){w=2.2;y0=mod(vari,2.0)< 0.5 ? 0.12 : 0.9;y1=2.25;}
else if(tv > 1.5 && tv < 2.5){w=0.8;y0=1.5;y1=2.1;}
else if(tv > 2.5 && tv < 3.5){w=0.0;}
else if(tv > 3.5 && tv < 4.5){w=1.5;y0=0.95;y1=2.2;}
else if(tv > 4.5){w=0.6;y0=1.25;y1=2.05;}
w *=0.9 + 0.07 * mod(vari,4.0);
if(tipo==F_CASA)y0=max(y0,0.95);
float kA=max(andar / 2.9,0.8);
y0 *=kA;
y1=min(y1 * kA,andar - 0.28);
if(uso > 1.5){w=vao * 0.78;y0=0.8;y1=andar - 0.35;}
if(uso > 2.5){w=vao * 0.7;y0=andar * 0.62;y1=andar - 0.25;}
if(fita){w=vao;y0=0.95;y1=andar - 0.42;}
w=min(w,fita ? vao : vao - 0.45);
if(w < 0.25)w=0.0;
float x0=0.5 - 0.5 * w / vao;
float x1=0.5 + 0.5 * w / vao;
float yy0=clamp(y0 / andar,0.02,0.9);
float yy1=clamp(y1 / andar,yy0 + 0.06,0.98);
float sx=gPulso(p.x,x0,x1,d.x);
float sy=gPulso(p.y,yy0,yy1,d.y);
float furo=w > 0.01 ? sx * sy : 0.0;
float vidro=furo * sx * sy;
float revela=max(furo - vidro,0.0);
float wy=(1.0 - sy)/ max(2.0 - sx - sy,1e-3);
s.alb=mix(s.alb,s.alb * mix(0.66,0.42,wy),revela);
s.ao *=1.0 - 0.25 * revela;
float caix=vidro * 0.16;
float pano=vidro - caix;
s.alb=mix(s.alb,c2,caix);
s.rug=mix(s.rug,0.45,caix);
s.met=mix(s.met,gLum(c2)> 0.45 ? 0.0 : 0.55,caix);
float lv=0.0;
if(uso < 1.5 && tv < 0.5)lv=h2.x < 0.36 ? 0.0 : h2.x < 0.6 ? 1.0 : 0.15 + 0.7 * h2.y;
if(uso < 1.5 && tv > 0.5 && tv < 1.5)lv=h2.x < 0.8 ? 0.0 : 0.3 * h2.y;
if(fita)lv=h2.x < 0.5 ? 0.0 : 0.2 + 0.8 * h2.y;
if(uso > 1.5)lv=h2.x < 0.55 ? 0.0 : 0.2 + 0.6 * h2.y;
lv=mix(lv,0.3,lonje);
float cyf=min(0.05 / andar,0.25 *(yy1 - yy0));
float pers=pano * gPulso(p.y,mix(yy1 - cyf,yy0 + cyf,lv),yy1 - cyf,d.y);
float cort=mix((tv > 0.5 && tv < 1.5)? step(0.55,h.y): step(0.86,h.y),0.25,lonje);
float vis=max(pano - pers,0.0);
vec2 hu=gH2(vec3(floor(i / 3.0)+ 41.0,j,id + 13.0));
vec3 luz=gAcesa(vec2(fract(hu.x + 0.22 * h.x),h.y),uso,gLongeLuz(d),lonje);
if(tv > 1.5 && tv < 2.5){
s.alb=mix(s.alb,vec3(0.26,0.27,0.26),vis);
s.rug=mix(s.rug,0.25,vis);
s.met=mix(s.met,0.0,vis);
s.emi +=luz * vis * 0.7;
}else if(tv > 3.5 && tv < 4.5){
s.alb=mix(s.alb,mix(vec3(0.03),c2 * 0.95,0.55),vis);
s.rug=mix(s.rug,0.5,vis);
s.met=mix(s.met,0.0,vis);
s.emi +=luz * vis * 0.27;
}else{
if(uso > 1.5)gVidroEspelho(s,vis,h,vec3(0.1,0.11,0.12),lonje);
else gVidroClaro(s,vis,h,cort,lonje);
s.emi +=luz * vis *(1.0 - 0.45 * cort);
vec3 cp=mix(vec3(0.5,0.49,0.46),c2 * 0.9,step(0.7,h.x))*(0.9 + 0.15 * h.y);
s.alb=mix(s.alb,cp *(1.0 - 0.045 *(1.0 - lonje)),pers);
s.rug=mix(s.rug,0.55,pers);
s.met=mix(s.met,0.0,pers);
s.inc=mix(s.inc,vec2(0.0),pers);
s.emi +=luz * pers * 0.16;
}
}
void gPeleLonge(inout GSup s,vec2 uv,vec2 duv,float andar,float vari,vec3 c1,vec3 c2,vec3 tinta,float uso){
float fv=uv.y / andar;
vec2 d=vec2(duv.x * 2.0,duv.y / andar);
float lonje=gLonge(vec2(duv.x,d.y));
vec2 p=vec2(uv.x * 2.0,fv);
vec2 cel=floor(p);
vec2 h=gH2(vec3(cel,vIdent.x));
float mont=gLinha(fract(p.x + 0.5)- 0.5,0.045 + 0.025 * mod(vari,2.0),d.x);
float trav=gLinha(fract(p.y + 0.5)- 0.5,0.03,d.y);
float fe=clamp((0.9 + 0.2 * mod(vari,3.0))/ andar,0.15,0.45);
float esp=gPulso(p.y,0.0,fe,d.y);
s.alb=c2;
s.rug=0.35;
s.met=gLum(c2)> 0.45 ? 0.1 : 0.7;
float vg=1.0 - max(mont,trav);
float contraste=mod(vari,4.0)< 1.5 ? 0.0 : 1.0;
vec3 painel=mix(tinta * 1.22,mix(c1 * 0.42,tinta * 1.6,0.5),0.35 + 0.35 * contraste);
s.alb=mix(s.alb,painel,vg * esp);
s.rug=mix(s.rug,0.07,vg * esp);
s.met=mix(s.met,0.82 - 0.12 * contraste,vg * esp);
float visao=vg *(1.0 - esp);
vec2 hg=gH2(vec3(floor(cel.x / 6.0)+ 31.0,cel.y,vIdent.x + 7.0));
float lv=mix(hg.x < 0.4 ? 0.0 :(hg.x < 0.52 ? 1.0 : 0.2 + 0.65 * hg.y),0.3,lonje);
float rolo=visao * gPulso(p.y,mix(1.0,fe,lv),1.0,d.y);
float vis=max(visao - rolo,0.0);
gVidroEspelho(s,vis,h,tinta,lonje);
s.alb=mix(s.alb,vec3(0.2,0.2,0.19)*(0.9 + 0.2 * h.y)+ tinta * 0.25,rolo);
s.rug=mix(s.rug,0.07,rolo);
s.met=mix(s.met,0.62,rolo);
vec2 hl=gH2(vec3(floor(cel.x /(uso > 1.5 ? 6.0 : 2.0))+ 53.0,cel.y,vIdent.x + 11.0));
vec3 luz=gAcesa(vec2(fract(hl.x + 0.18 * h.x),h.y),uso,gLongeLuz(d),lonje);
s.emi +=luz *(vis + 0.4 * rolo)* 0.7;
}
void gTerreoLonge(inout GSup s,vec2 uv,vec2 duv,float tH,float terreo,vec3 c1,vec3 c2,vec3 tinta){
float id=vIdent.x;
float fv=uv.y / tH;
vec2 d=vec2(duv.x,duv.y / tH);
float tt=terreo > 5.5 ? terreo - 5.0 : terreo;
if(tt < 1.5){
float pil=gPulso(uv.x,0.0,0.07,d.x)+ gPulso(uv.x,0.93,1.0,d.x);
float letr=gPulso(fv,0.72,0.93,d.y)*(1.0 - pil);
float vao0=gPulso(fv,0.02,0.68,d.y)*(1.0 - pil);
vec2 h=gH2(vec3(floor(uv.x),3.0,id));
float hl=gH1(vec3(7.0,3.0,id));
vec3 cl=gLin(gRGB(vCor.y));
vec3 corL=hl < 0.2 ? vec3(0.22,0.04,0.03): hl < 0.4 ? vec3(0.025,0.07,0.12): hl < 0.55 ? cl * 0.8 : hl < 0.7 ? vec3(0.3,0.19,0.04): hl < 0.85 ? vec3(0.55,0.53,0.5): vec3(0.05);
vec3 corT=gLum(corL)> 0.2 ? vec3(0.04,0.05,0.08): vec3(0.62,0.6,0.55);
s.alb=mix(s.alb,c1 * 0.85,pil);
s.alb=mix(s.alb,mix(corL,corT,0.12),letr);
s.rug=mix(s.rug,0.5,letr);
float aberta=(gHora > 7.5 + 2.0 * h.y && gHora < 19.0 + 4.0 * h.x)? 1.0 : 0.0;
if(gH1(vec3(floor(uv.x),4.0,id))< 0.08)aberta=0.0;
float vg=vao0 * gPulso(uv.x,0.08,0.92,d.x);
s.alb=mix(s.alb,c1 * 0.6,max(vao0 - vg,0.0));
vec3 loja=mix(vec3(0.09,0.085,0.075),vec3(0.05,0.055,0.06),h.x)+ vec3(0.012,0.011,0.009);
loja=mix(loja,mix(vec3(0.16,0.1,0.06),vec3(0.07,0.1,0.13),h.y),0.25);
vec3 aco=mix(vec3(0.34,0.35,0.35),cl * 0.7,step(0.6,h.y))* 0.91;
s.alb=mix(s.alb,mix(aco,mix(loja,tinta,0.3),aberta),vg);
s.rug=mix(s.rug,mix(0.5,0.06,aberta),vg);
s.met=mix(s.met,mix(0.5,0.0,aberta),vg);
s.emi +=vec3(1.0,0.9,0.76)* vg * aberta *((0.035 + 0.16 * gNoite)*(0.86 + 0.3 * h.y)+ 0.09 *(0.16 + 0.3 * gNoite));
s.emi +=mix(corL,vec3(1.0,0.9,0.75),0.12)* 1.2 * letr * step(0.5,fract(hl * 5.3))* step(gHora,23.0)* gNoite;
}else if(tt < 2.5){
float vg=gPulso(fv,0.02,0.86,d.y)* 0.94;
vec2 h=gH2(vec3(floor(uv.x * 2.0),8.0,id));
s.alb=mix(c1 * 0.95,mix(vec3(0.2,0.17,0.13),tinta,0.5),vg);
s.alb=mix(s.alb,c2,0.06 * gPulso(fv,0.02,0.86,d.y));
s.rug=mix(s.rug,0.07,vg);
s.met=mix(s.met,0.6,vg);
s.emi +=vec3(1.0,0.85,0.65)* vg *(0.012 + 0.14 * gNoite)*(0.3 + 1.0 * h.x * h.x);
}else if(tt < 3.5){
float ab=gPulso(uv.x,0.12,0.88,d.x)* gPulso(fv,0.0,0.8,d.y);
s.alb=mix(s.alb * 0.9,mix(vec3(0.03),c2 * 0.6,0.16),ab);
s.rug=mix(s.rug,0.5,ab * 0.2);
}else if(tt < 4.5){
s.alb=mix(vec3(0.05,0.05,0.048),c1 * 0.7,gPulso(uv.x,0.44,0.56,d.x));
s.ao *=0.6;
}else{
float porta=gPulso(uv.x * 0.5,0.12,0.88,d.x * 0.5)* gPulso(fv,0.0,0.78,d.y);
s.alb=mix(s.alb,c2 * 0.84,porta);
s.met=mix(s.met,0.6,porta);
s.rug=mix(s.rug,0.45,porta);
}
s.alb *=mix(0.72,1.0,smoothstep(0.0,0.5,uv.y));
}
GSup gFachadaLonge(){
GSup s;
float tipo=vFac.x;
float andar=max(vFac.y,0.5);
float vao=max(vFac.z,0.4);
float bits=vFac.w;
float uso=mod(bits,4.0);
float vari=mod(floor(bits / 4.0),8.0);
float terreo=floor(bits / 32.0);
vec3 c1=gLin(gRGB(vCor.x));
vec3 c2=gLin(gRGB(vCor.y));
float desg=fract(vCor.z);
vec2 uv=vPF.xy;
vec2 duv=max(fwidth(uv),vec2(1e-4));
float um=uv.x * vao;
float id=vIdent.x;
vec4 dt=texture(gDetalhe,vec2(um * 0.11 + id * 0.173,uv.y * 0.11));
float escG=texture(gDetalhe,vec2(um * 0.23 + id * 0.31,uv.y * 0.035)).g;
vec3 tinta=gTinta(vCor.w);
s.alb=c1;
s.rug=0.82;
s.met=0.0;
s.emi=vec3(0.0);
s.inc=vec2(0.0);
s.ao=vPF.w;
if(tipo >=F_TELHA || tipo==F_LISO){
float suja=0.0;
if(tipo==F_TELHA){
s.alb=c1 * 0.92 *(0.8 + 0.35 * dt.r);
s.alb=mix(s.alb,s.alb * vec3(0.62,0.64,0.6),desg * smoothstep(0.45,0.8,dt.g));
s.rug=0.72;
}else if(tipo==F_FIBRO){
s.alb=c1 *(0.84 + 0.3 * dt.r)*(0.985 - 0.45 * desg * smoothstep(0.35,0.75,dt.g));
s.rug=0.88;
}else if(tipo==F_LAJE){
s.alb=c1 * 0.963 *(0.78 + 0.35 * dt.r)*(1.0 - 0.3 * desg * smoothstep(0.55,0.8,dt.g));
s.rug=0.9;
}else if(tipo==F_TELHA_METAL){
s.alb=c1 * 0.95 *(0.85 + 0.2 * dt.r)*(1.0 - 0.3 * desg * smoothstep(0.5,0.85,dt.b));
s.rug=0.45;
s.met=0.55;
}else if(tipo==F_CONCRETO || tipo==F_LISO){
s.alb=c1 *(0.84 + 0.3 * dt.r)*(1.0 -(0.06 + 0.2 * desg)* smoothstep(0.5,0.85,escG)- 0.15 * desg * smoothstep(0.55,0.85,dt.g));
s.rug=tipo==F_CONCRETO ? 0.88 : 0.8;
}else if(tipo==F_METAL){
s.alb=c1 *(0.9 + 0.15 * dt.r);
s.rug=0.38;
s.met=0.8;
}else if(tipo==F_VIDRO){
s.alb=mix(tinta,c1 * 0.5,0.25);
s.rug=0.06;
s.met=0.85;
}else if(tipo==F_VERDE){
s.alb=c1 * 0.9 *(0.7 + 0.5 * dt.g);
s.rug=0.92;
}else if(tipo==F_PISO){
s.alb=c1 * 0.984 *(0.82 + 0.3 * dt.r);
s.rug=0.9;
}else if(tipo==F_AGUA){
s.alb=vec3(0.02,0.07,0.075);
s.rug=0.04;
s.met=0.25;
}else if(tipo==F_LETREIRO){
s.alb=c1 * 0.9;
s.rug=0.5;
s.emi=mix(c1,vec3(1.0,0.86,0.66),0.3)*(0.12 + 0.4 * gNoite)* step(7.5,gHora)* step(gHora,23.0)* gNoite * mix(1.0,0.25,smoothstep(0.15,0.5,gLum(c1)));
}else if(tipo==F_SOLAR){
s.alb=mix(vec3(0.015,0.02,0.035),c2,0.09);
s.rug=0.145;
s.met=0.52;
}else if(tipo==F_PORTA){
s.alb=mix(c2,c1 * 0.9,0.88);
s.rug=0.6;
}else if(tipo==F_GARAGEM){
s.alb=c1 * 0.84;
s.rug=0.45;
s.met=0.6;
}else{
s.alb=c1 *(tipo==F_MADEIRA ? 0.926 : tipo==F_PEDRA ? 0.936 : 0.95);
s.rug=tipo==F_TOLDO ? 0.85 : 0.7;
}
if(tipo==F_TELHA || tipo==F_FIBRO || tipo==F_LAJE || tipo==F_TELHA_METAL || tipo==F_SOLAR)gMascaraTelhado=1.0;
s.alb=clamp(s.alb,0.0,0.8);
return s;
}
float pano=gH1(vec3(floor(um / 3.6),floor(uv.y / 6.0),id));
s.alb=c1 *(0.9 + 0.2 * dt.r)*(1.0 +(pano - 0.5)* 0.07 * desg);
float daBorda=smoothstep(vPF.z - 9.0,vPF.z,uv.y);
s.alb *=1.0 -(0.03 + 0.15 * desg)* smoothstep(0.55,0.88,escG)* daBorda * daBorda;
float tH=G_TERREO_H[ int(terreo)];
vec2 uvA=vec2(uv.x,uv.y -(terreo > 0.5 ? tH : 0.0));
if(terreo > 0.5 && uv.y < tH){
gTerreoLonge(s,uv,duv,tH,terreo,c1,c2,tinta);
}else if(uv.y > vPF.z){
s.alb=c1 *(0.88 + 0.2 * dt.r)*(0.973 - 0.1 * desg * dt.g);
}else if(tipo==F_CORTINA){
gPeleLonge(s,uvA,duv,andar,vari,c1,c2,tinta,uso);
}else if(tipo==F_BRISE_H || tipo==F_BRISE_V){
gBrise(s,uvA,duv,andar,vao,vari,c1,c2,tinta,uso,tipo,vec3(0.0,0.0,1.0),dt);
}else if(tipo==F_VARANDA){
gVarandas(s,uvA,duv,andar,vari,c1,c2,tinta,uso,vec3(0.0,0.0,1.0));
}else if(tipo==F_COBOGO){
s.alb=mix(c1 *(0.9 + 0.2 * dt.r),vec3(0.03,0.03,0.028),0.27);
s.ao *=0.92;
s.emi +=vec3(1.0,0.82,0.6)* 0.027 * gNoite * step(0.65,gH1(vec3(floor(uv.x),floor(uvA.y / 3.0),id)));
}else if(tipo==F_GALPAO){
s.alb=c1 * 0.96 *(0.85 + 0.2 * dt.r)*(1.0 - 0.25 * desg * smoothstep(0.4,0.9,dt.g)* smoothstep(6.0,0.0,uv.y));
s.met=0.45;
s.rug=0.5;
s.alb=mix(s.alb,c2 * 0.8,gPulso(uv.x,0.0,0.05,duv.x));
float fv=uvA.y / andar;
vec2 d=vec2(duv.x,duv.y / andar);
float jan=gPulso(fv,0.74,0.88,d.y)* gPulso(uv.x,0.08,0.92,d.x);
vec2 h=gH2(vec3(floor(uv.x),floor(fv),id));
gVidroClaro(s,jan,h,0.4,gLonge(d));
s.alb=mix(s.alb,vec3(0.3,0.31,0.3),jan * 0.5);
s.emi +=gAcesa(h,uso,gLongeLuz(d),gLonge(d))* jan;
float base=1.0 - smoothstep(1.75,1.85,uv.y);
s.alb=mix(s.alb,vec3(0.3,0.29,0.27)*(0.85 + 0.25 * dt.r)* 0.98,base);
s.met=mix(s.met,0.0,base);
s.rug=mix(s.rug,0.9,base);
}else{
if(tipo==F_PASTILHA){
s.alb=c1 * 0.954 *(0.9 + 0.2 * dt.r);
s.rug=0.45;
}else if(tipo==F_TIJOLO){
s.alb=c1 * 0.958;
s.rug=0.88;
}else if(tipo==F_PAINEL){
s.alb *=0.99;
s.rug=0.8;
}
gJanelasLonge(s,uvA,duv,andar,vao,floor(vCor.z),vari,c2,uso,tipo);
}
s.alb *=mix(1.0 - 0.28 * desg,1.0,smoothstep(0.0,0.8,uv.y));
s.alb=clamp(s.alb,0.0,0.8);
s.ao *=mix(0.7,1.0,smoothstep(0.0,1.6,uv.y));
return s;
}
#endif
`,A=`
#define EDIFICIO
${f}
${l}
varying vec4 vPF;
flat varying vec4 vFac;
flat varying vec4 vCor;
flat varying vec4 vIdent;
uniform highp sampler2D gDetalhe;
uniform float gHora;
uniform float gNoite;
uniform float gSelecionado;
uniform float gPrediosMascara;
uniform float gCeuLigado;
uniform vec3 gCeuZen;
uniform vec3 gCeuHor;
uniform vec3 gCeuChao;
float gMascaraTelhado=0.0;
const float G_TERREO_H[ 8 ]=float[ 8 ](${g});
const vec4 G_RITMO[ 8 ]=vec4[ 8 ](
vec4(0.0,1.0,2.0,0.0),vec4(1.0,0.0,0.0,2.0),vec4(0.0,2.0,1.0,1.0),vec4(0.0,0.0,0.0,0.0),
vec4(1.0,1.0,2.0,0.0),vec4(0.0,3.0,1.0,2.0),vec4(4.0,0.0,1.0,0.0),vec4(0.0,1.0,1.0,3.0));
struct GSup{vec3 alb;float rug;float met;vec3 emi;vec2 inc;float ao;};
float gH1(vec3 p){
p=fract(p * vec3(0.1031,0.1030,0.0973));
p +=dot(p,p.yxz + 33.33);
return fract((p.x + p.y)* p.z);
}
vec2 gH2(vec3 p){
p=fract(p * vec3(0.1031,0.1030,0.0973));
p +=dot(p,p.yxz + 33.33);
return fract((p.xx + p.yz)* p.zy);
}
vec3 gRGB(float p){return vec3(floor(p / 65536.0),floor(mod(p,65536.0)/ 256.0),mod(p,256.0))/ 255.0;}
vec3 gLin(vec3 c){return pow(c,vec3(2.2));}
float gLum(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}
float gInt(float x,float a,float b){return floor(x)*(b - a)+ clamp(fract(x),a,b)- a;}
float gPulso(float x,float a,float b,float dx){
float w=max(dx,1e-4);
return clamp((gInt(x + 0.5 * w,a,b)- gInt(x - 0.5 * w,a,b))/ w,0.0,1.0);
}
float gRet(vec2 p,vec4 r,vec2 d){return gPulso(p.x,r.x,r.y,d.x)* gPulso(p.y,r.z,r.w,d.y);}
float gLinha(float x,float l,float dx){return gPulso(x + 0.5 * l,0.0,l,dx);}
float gLonge(vec2 d){return smoothstep(0.1,0.45,max(d.x,d.y));}
float gLongeLuz(vec2 d){return smoothstep(0.45,1.1,max(d.x,d.y));}
float gDisco(vec2 q,float r,float w){return 1.0 - smoothstep(r - w,r + w,length(q));}
float gAgenda(float uso,float h){
if(uso < 0.5){
if(h < 5.0)return mix(0.12,0.05,h / 5.0);
if(h < 7.0)return mix(0.05,0.28,(h - 5.0)/ 2.0);
if(h < 9.0)return mix(0.28,0.06,(h - 7.0)/ 2.0);
if(h < 17.0)return 0.06;
if(h < 20.0)return mix(0.06,0.42,(h - 17.0)/ 3.0);
if(h < 23.0)return mix(0.42,0.28,(h - 20.0)/ 3.0);
return mix(0.28,0.12,h - 23.0);
}
if(uso < 1.5)return(h > 7.5 && h < 22.0)? 0.6 : 0.05;
if(uso < 2.5){
if(h < 7.0)return 0.06;
if(h < 9.0)return mix(0.06,0.8,(h - 7.0)/ 2.0);
if(h < 18.0)return 0.78;
if(h < 20.5)return mix(0.78,0.12,(h - 18.0)/ 2.5);
return 0.09;
}
return 0.38;
}
vec3 gLuz(float h){
return h < 0.42 ? vec3(1.0,0.64,0.36): h < 0.78 ? vec3(1.0,0.78,0.56): h < 0.93 ? vec3(1.0,0.9,0.8): vec3(0.62,0.74,1.0);
}
vec3 gAcesa(vec2 h,float uso,float lonje,float queda){
float hora=mod(gHora +(h.y - 0.5)* 1.6 +(vIdent.z - 0.5)* 1.2 + 24.0,24.0);
float fr=gAgenda(uso,hora);
float acesa=mix(step(h.x,fr),fr,lonje);
uint gB=uint(vIdent.y + 0.5);
if((gB & B_ABANDONADO)!=0u ||(gB &(B_OBRA | B_NIVEL))==B_OBRA)acesa=0.0;
vec3 luz=mix(gLuz(fract(h.x * 7.13 + h.y)),vec3(1.0,0.76,0.52),lonje);
float brilho=mix(0.3 + 0.7 * fract(h.y * 13.7 + h.x),0.6,lonje);
return luz * acesa * brilho *(0.01 + 0.26 * gNoite)* mix(1.0,0.36,max(lonje,0.85 * queda));
}
void gVidroClaro(inout GSup s,float m,vec2 h,float cortina,float lonje){
vec3 fundo=vec3(0.032,0.03,0.028)* mix(0.6 + 0.8 * h.y,1.0,lonje);
vec3 cor=mix(fundo,vec3(0.34,0.31,0.26)* mix(0.8 + 0.4 * h.x,1.0,lonje),cortina);
s.alb=mix(s.alb,cor,m);
s.rug=mix(s.rug,0.04,m);
s.met=mix(s.met,0.0,m);
s.inc=mix(s.inc,(h - 0.5)* 0.025 *(1.0 - lonje),m);
}
void gVidroEspelho(inout GSup s,float m,vec2 h,vec3 tinta,float lonje){
s.alb=mix(s.alb,tinta *(1.22 + 0.12 *(mix(h.y,0.5,lonje)- 0.5)),m);
s.rug=mix(s.rug,0.05 + 0.02 * h.x,m);
s.met=mix(s.met,0.88,m);
s.inc=mix(s.inc,(h - 0.5)* 0.03 *(1.0 - lonje),m);
}
float gPixo(float um,float v,float y0,float dm,float id){
float t=gH1(vec3(floor(um / 4.0),floor(y0),id + 31.0));
if(t > 0.62 || v < y0 || v > y0 + 1.6)return 0.0;
vec2 p=vec2(um / 0.55,(v - y0)/ 1.6);
vec2 d=vec2(dm / 0.55,dm / 1.6);
vec2 h=gH2(vec3(floor(p.x),floor(y0),id + 37.0));
vec2 f=vec2(fract(p.x),p.y);
float l=0.11;
float k=gLinha(f.x - 0.18,l,d.x)+ gLinha(f.x - 0.82,l,d.x)* step(0.3,h.x);
k +=gLinha(f.y -(0.35 + 0.5 * h.y),l * 0.35,d.y)* gPulso(f.x,0.15,0.85,d.x);
k +=gLinha(f.y - 0.97,l * 0.35,d.y)* gPulso(f.x,0.05,0.95,d.x)* step(0.5,h.y);
k +=gLinha(f.x - 0.18 - 0.64 * f.y,l,d.x)* step(0.7,h.x);
return clamp(k,0.0,1.0)* gPulso(f.x,0.05,0.95,d.x);
}
void gAbandono(inout GSup s){
float tipo=vFac.x;
vec2 uv=vPF.xy;
vec2 duv=max(fwidth(uv),vec2(1e-4));
float id=vIdent.x;
s.emi *=0.0;
if(tipo==F_PISO || tipo==F_VERDE){
vec2 h=gH2(vec3(floor(uv / 0.7),id + 3.0));
float m=mix(0.35 + 0.6 * h.y,0.65,gLonge(duv / 0.7));
s.alb=mix(s.alb,mix(vec3(0.16,0.15,0.07),vec3(0.07,0.11,0.04),h.x),m);
s.rug=mix(s.rug,0.95,m);
return;
}
if(tipo < F_TELHA){
float andar=max(vFac.y,0.5);
float vao=max(vFac.z,0.4);
float tH=G_TERREO_H[ int(floor(vFac.w / 32.0))];
if(s.rug < 0.15){
vec2 c=vec2(floor(uv.x),floor((uv.y - tH)/ andar));
vec2 h=gH2(vec3(c,id + 17.0));
if(h.x < 0.38){
vec2 f=vec2(fract(uv.x),fract((uv.y - tH)/ andar));
float caco=step(0.5,fract(atan(f.y - h.y,f.x - 0.5)* 1.6 + h.y * 5.0))* step(0.22,length(f - vec2(0.5,h.y)));
caco=mix(caco,0.4,gLonge(duv));
s.alb=mix(vec3(0.012),s.alb,caco * 0.6);
s.rug=mix(0.9,s.rug,caco);
s.met *=caco;
s.inc *=caco;
}
}
float um=uv.x * vao;
float dm=max(duv.x * vao,duv.y);
float tinta=max(gPixo(um,uv.y,0.45,dm,id),uv.y > vPF.z ? gPixo(um,uv.y,vPF.z + 0.05,dm,id + 9.0): 0.0);
vec3 cor=gH1(vec3(floor(um / 4.0),2.0,id))< 0.8 ? vec3(0.015): vec3(0.32,0.03,0.02);
s.alb=mix(s.alb,cor,tinta * 0.92);
s.rug=mix(s.rug,0.7,tinta);
}
s.alb *=vec3(0.62,0.6,0.57);
}
void gJanelas(inout GSup s,vec2 uv,vec2 duv,float andar,float vao,float nB,float vari,vec3 c1,vec3 c2,float uso,
float desg,float tipo,vec3 vista,vec4 dt){
float fv=uv.y / andar;
vec2 d=vec2(duv.x,duv.y / andar);
float lonje=gLonge(d);
float id=vIdent.x;
vec2 p=vec2(uv.x,fv);
float i=floor(uv.x);
float j=floor(fv);
vec2 h=gH2(vec3(i,j,id));
vec2 h2=gH2(vec3(i * 1.37 + 17.0,j * 1.13 + 3.0,id + 5.0));
bool fita=tipo==F_FITA;
bool casa=tipo==F_CASA;
float pad=mod(vari + floor(gH1(vec3(id,5.0,1.0))* 8.0),8.0);
float jj=min(i,nB - 1.0 - i);
vec4 rr=G_RITMO[ int(pad)];
float kk=mod(jj,4.0);
float tv=kk < 0.5 ? rr.x : kk < 1.5 ? rr.y : kk < 2.5 ? rr.z : rr.w;
if(nB >=5.0 && abs(i -(nB - 1.0)* 0.5)< 0.25 && pad > 3.5)tv=5.0;
if(casa)tv=mod(i + pad,3.0)< 1.0 ? 1.0 :(mod(i + pad,3.0)< 2.0 ? 0.0 : 2.0);
if(uso > 1.5 || fita)tv=0.0;
float w=1.5;
float y0=1.0;
float y1=2.2;
if(tv > 0.5 && tv < 1.5){w=2.2;y0=mod(vari,2.0)< 0.5 ? 0.12 : 0.9;y1=2.25;}
else if(tv > 1.5 && tv < 2.5){w=0.8;y0=1.5;y1=2.1;}
else if(tv > 2.5 && tv < 3.5){w=0.0;}
else if(tv > 3.5 && tv < 4.5){w=1.5;y0=0.95;y1=2.2;}
else if(tv > 4.5){w=0.6;y0=1.25;y1=2.05;}
float esc=0.9 + 0.07 * mod(vari,4.0);
w *=esc;
if(casa){y0=max(y0,0.95);}
float kA=max(andar / 2.9,0.8);
y0 *=kA;
y1=min(y1 * kA,andar - 0.28);
if(uso > 1.5){w=vao * 0.78;y0=0.8;y1=andar - 0.35;}
if(uso > 2.5){w=vao * 0.7;y0=andar * 0.62;y1=andar - 0.25;}
if(fita){w=vao;y0=0.95;y1=andar - 0.42;}
w=min(w,fita ? vao : vao - 0.45);
if(w < 0.25)w=0.0;
float x0=0.5 - 0.5 * w / vao;
float x1=0.5 + 0.5 * w / vao;
float yy0=clamp(y0 / andar,0.02,0.9);
float yy1=clamp(y1 / andar,yy0 + 0.06,0.98);
vec4 R=vec4(x0,x1,yy0,yy1);
float dep=tv > 3.5 && tv < 4.5 ? 0.06 : 0.14 + 0.08 * mod(vari,2.0);
vec2 off=clamp(- vista.xy / vista.z * dep,vec2(-0.45),vec2(0.45))*(1.0 - lonje);
vec2 q=p + vec2(off.x / vao,off.y / andar);
float furo=w > 0.01 ? gRet(p,R,d): 0.0;
float sx=gPulso(q.x,x0,x1,d.x);
float sy=gPulso(q.y,yy0,yy1,d.y);
float vidro=furo * sx * sy;
float revela=max(furo - vidro,0.0);
float fy=fract(fv);
if(!fita && w > 0.01){
float pe=gPulso(p.x,x0 - 0.03,x1 + 0.03,d.x)* gPulso(fv,max(yy0 - 0.06 / andar,0.0),yy0,d.y);
s.alb=mix(s.alb,vec3(0.42,0.41,0.39)*(0.9 + 0.2 * dt.b),pe);
float esc2=smoothstep(yy0 - 1.1 / andar,yy0,fy)* step(fy,yy0)* gPulso(p.x,x0 + 0.08,x1 - 0.08,d.x);
s.alb *=1.0 - desg * 0.22 * esc2 *(0.6 + 0.8 * dt.g)*(1.0 - lonje);
}
float wy=(1.0 - sy)/ max(2.0 - sx - sy,1e-3);
float sombraR=mix(0.66,off.y < 0.0 ? 0.9 : 0.42,wy);
s.alb=mix(s.alb,s.alb * sombraR,revela);
s.ao *=1.0 - 0.25 * revela;
float cxf=min(0.05 / vao,0.25 *(x1 - x0));
float cyf=min(0.05 / andar,0.25 *(yy1 - yy0));
vec4 Rv=vec4(x0 + cxf,x1 - cxf,yy0 + cyf,yy1 - cyf);
float pano=furo * gRet(q,Rv,d);
float nf=tv > 0.5 && tv < 1.5 ? 4.0 :(fita ? max(2.0,floor(vao / 0.9)): 2.0);
float lw=max(x1 - x0,0.01);
float tm=(q.x - x0)/ lw * nf;
float mont=gLinha(fract(tm + 0.5)- 0.5,0.05 * nf /(lw * vao),d.x * nf / lw)* pano;
float caix=max(vidro - pano,0.0)+ mont;
pano *=1.0 - mont;
float cBrilho=gLum(c2);
s.alb=mix(s.alb,c2,caix);
s.rug=mix(s.rug,0.45,caix);
s.met=mix(s.met,cBrilho > 0.45 ? 0.0 : 0.55,caix);
float lv=0.0;
if(uso < 1.5 && tv < 0.5)lv=h2.x < 0.36 ? 0.0 : h2.x < 0.6 ? 1.0 : 0.15 + 0.7 * h2.y;
if(uso < 1.5 && tv > 0.5 && tv < 1.5)lv=h2.x < 0.8 ? 0.0 : 0.3 * h2.y;
if(fita)lv=h2.x < 0.5 ? 0.0 : 0.2 + 0.8 * h2.y;
if(uso > 1.5)lv=h2.x < 0.55 ? 0.0 : 0.2 + 0.6 * h2.y;
lv=mix(lv,0.3,lonje);
float yp=mix(yy1 - cyf,yy0 + cyf,lv);
float pers=pano * gPulso(q.y,yp,yy1 - cyf,d.y);
float cort=(tv > 0.5 && tv < 1.5)? step(0.55,h.y): step(0.86,h.y);
cort=mix(cort,0.25,lonje);
float vis=max(pano - pers,0.0);
vec2 hu=gH2(vec3(floor(i / 3.0)+ 41.0,j,id + 13.0));
vec3 luz=gAcesa(vec2(fract(hu.x + 0.22 * h.x),h.y),uso,gLongeLuz(d),lonje);
if(tv > 1.5 && tv < 2.5){
s.alb=mix(s.alb,vec3(0.26,0.27,0.26),vis);
s.rug=mix(s.rug,0.25,vis);
s.met=mix(s.met,0.0,vis);
s.emi +=luz * vis * 0.7;
}else if(tv > 3.5 && tv < 4.5){
float lam=gPulso(q.y * andar / 0.09,0.0,0.55,d.y * andar / 0.09);
vec3 fundo=vec3(0.03);
s.alb=mix(s.alb,mix(fundo,c2 * 0.95,lam),vis);
s.rug=mix(s.rug,0.5,vis);
s.met=mix(s.met,0.0,vis);
s.emi +=luz * vis *(1.0 - lam)* 0.6;
}else{
if(uso > 1.5)gVidroEspelho(s,vis,h,vec3(0.1,0.11,0.12),lonje);
else gVidroClaro(s,vis,h,cort,lonje);
s.emi +=luz * vis *(1.0 - 0.45 * cort);
float ripa=gLinha(fract(q.y * andar / 0.055 + 0.5)- 0.5,0.18,d.y * andar / 0.055);
vec3 cp=mix(vec3(0.5,0.49,0.46),c2 * 0.9,step(0.7,h.x))*(0.9 + 0.15 * h.y);
s.alb=mix(s.alb,cp *(1.0 - 0.25 * ripa *(1.0 - lonje)),pers);
s.rug=mix(s.rug,0.55,pers);
s.met=mix(s.met,0.0,pers);
s.inc=mix(s.inc,vec2(0.0),pers);
s.emi +=luz * pers * 0.16;
}
if(casa && vari > 3.5){
float bx=gLinha(fract((p.x - x0)/ lw * 6.0 + 0.5)- 0.5,0.08,d.x * 6.0 / lw);
float by=gLinha(fract((fy - yy0)/ max(yy1 - yy0,0.01)* 2.0 + 0.5)- 0.5,0.04,2.0 * d.y / max(yy1 - yy0,0.01));
float barra=max(bx,by)* furo *(1.0 - lonje);
s.alb=mix(s.alb,vec3(0.035),barra);
s.met=mix(s.met,0.3,barra);
s.rug=mix(s.rug,0.6,barra);
}
if(uso < 2.5 && tv < 0.5 && !fita && y0 > 0.8){
float tem=step(h2.y,0.2 + 0.3 * desg)*(1.0 - lonje);
if(tem > 0.0){
float lado=h.x < 0.5 ? -1.0 : 1.0;
float acx=0.5 + lado * min(0.25 * w,0.5 * vao - 0.5)/ vao;
vec4 A=vec4(acx - 0.4 / vao,acx + 0.4 / vao,yy0 - 0.7 / andar,yy0 - 0.14 / andar);
float caixa=gRet(p,A,d)* tem;
vec2 cm=vec2((fract(p.x)-(acx - 0.15 * lado / vao))* vao,(fy -(A.z + A.w)* 0.5)* andar);
float ven=gDisco(cm,0.19,max(duv.x * vao,0.01))* caixa;
float somb=gRet(p,vec4(A.x,A.y,max(A.z - 0.12 / andar,0.0),A.z),d)* tem;
float pinga=gRet(p,vec4(acx - 0.05 / vao,acx + 0.05 / vao,max(A.z - 1.6 / andar,0.0),A.z),d)* tem * desg;
s.alb *=1.0 - 0.35 * somb - 0.3 * pinga * smoothstep(A.z - 1.6 / andar,A.z,fy);
s.alb=mix(s.alb,vec3(0.52,0.52,0.5)*(0.85 + 0.2 * dt.r),caixa);
s.alb=mix(s.alb,vec3(0.06),ven * 0.85);
s.rug=mix(s.rug,0.6,caixa);
s.met=mix(s.met,0.0,caixa);
}
}
}
void gPele(inout GSup s,vec2 uv,vec2 duv,float andar,float vao,float vari,vec3 c1,vec3 c2,vec3 tinta,float uso){
float fv=uv.y / andar;
vec2 d=vec2(duv.x * 2.0,duv.y / andar);
float lonje=gLonge(vec2(duv.x,d.y));
vec2 p=vec2(uv.x * 2.0,fv);
vec2 cel=floor(p);
vec2 h=gH2(vec3(cel,vIdent.x));
vec2 h2=gH2(vec3(cel.x * 0.37 + 11.0,cel.y * 1.7,vIdent.x + 2.0));
float mont=gLinha(fract(p.x + 0.5)- 0.5,0.045 + 0.025 * mod(vari,2.0),d.x);
float trav=gLinha(fract(p.y + 0.5)- 0.5,0.03,d.y);
float fe=clamp((0.9 + 0.2 * mod(vari,3.0))/ andar,0.15,0.45);
float esp=gPulso(p.y,0.0,fe,d.y);
s.alb=c2;
s.rug=0.35;
s.met=gLum(c2)> 0.45 ? 0.1 : 0.7;
float vg=1.0 - max(mont,trav);
float contraste=mod(vari,4.0)< 1.5 ? 0.0 : 1.0;
vec3 painel=mix(tinta * 1.22,mix(c1 * 0.42,tinta * 1.6,0.5),0.35 + 0.35 * contraste);
s.alb=mix(s.alb,painel,vg * esp);
s.rug=mix(s.rug,0.07,vg * esp);
s.met=mix(s.met,0.82 - 0.12 * contraste,vg * esp);
float visao=vg *(1.0 - esp);
vec2 hg=gH2(vec3(floor(cel.x / 6.0)+ 31.0,cel.y,vIdent.x + 7.0));
float lv=hg.x < 0.4 ? 0.0 :(hg.x < 0.52 ? 1.0 : 0.2 + 0.65 * hg.y);
lv=clamp(lv +(h2.x - 0.5)*(lv > 0.01 && lv < 0.99 ? 0.16 : 0.0),0.0,1.0);
if(h2.y < 0.08)lv=h2.x;
lv=mix(lv,0.3,lonje);
float yb=mix(1.0,fe,lv);
float rolo=visao * gPulso(p.y,yb,1.0,d.y);
float vis=max(visao - rolo,0.0);
gVidroEspelho(s,vis,h,tinta,lonje);
s.alb=mix(s.alb,vec3(0.2,0.2,0.19)*(0.9 + 0.2 * h.y)+ tinta * 0.25,rolo);
s.rug=mix(s.rug,0.07,rolo);
s.met=mix(s.met,0.62,rolo);
vec2 hl=gH2(vec3(floor(cel.x /(uso > 1.5 ? 6.0 : 2.0))+ 53.0,cel.y,vIdent.x + 11.0));
vec3 luz=gAcesa(vec2(fract(hl.x + 0.18 * h.x),h.y),uso,gLongeLuz(d),lonje);
float teto=gPulso(p.y,0.86,0.94,d.y)* vis *(abs(uso - 2.0)< 0.5 ? 1.0 : 0.0);
s.emi +=luz *(vis + 0.4 * rolo)* 0.7 + vec3(0.9,0.95,1.0)* teto * step(h.x,0.7)* 0.05 *(1.0 - gNoite)*(1.0 - lonje);
}
void gBrise(inout GSup s,vec2 uv,vec2 duv,float andar,float vao,float vari,vec3 c1,vec3 c2,vec3 tinta,float uso,
float tipo,vec3 vista,vec4 dt){
float fv=uv.y / andar;
vec2 d=vec2(duv.x,duv.y / andar);
float lonje=gLonge(d);
vec2 cel=vec2(floor(uv.x),floor(fv));
vec2 h=gH2(vec3(cel,vIdent.x));
float laje=gPulso(fv,0.0,0.07,d.y);
gVidroEspelho(s,1.0 - laje,h,tinta * 0.9,lonje);
vec2 hp=gH2(vec3(floor(uv.x * 2.0),cel.y,vIdent.x + 3.0));
s.emi +=gAcesa(hp,uso,gLongeLuz(vec2(d.x * 2.0,d.y)),lonje)* gPulso(fv,0.12,0.86,d.y);
float lam;
float lado=1.0;
if(tipo==F_BRISE_V){
float passo=vao / 4.0;
float t=uv.x * 4.0;
float lf=min(0.12 / passo,0.5);
float sw=clamp(0.4 * abs(vista.x)/ vista.z / passo,0.0,0.85 - lf)*(1.0 - lonje);
float lp=lf + sw;
lam=vista.x > 0.0 ? gPulso(t,0.0,lp,duv.x * 4.0): gPulso(t + sw,0.0,lp,duv.x * 4.0);
float face=vista.x > 0.0 ? gPulso(t,0.0,lf,duv.x * 4.0): gPulso(t + sw,sw,lp,duv.x * 4.0);
lado=mix(0.72,1.0,face / max(lam,1e-3));
}else{
float mo=gPulso(uv.x,0.0,0.1,duv.x);
float lp=0.34 + clamp(0.3 * max(vista.y,0.0)/ vista.z,0.0,0.4)*(1.0 - lonje);
float t=fv * andar / 0.5;
lam=max(gPulso(t,0.0,lp,duv.y / 0.5),mo);
lado=mix(0.82 + 0.3 * h.x,0.95,lonje);
lam=max(lam,laje);
}
vec3 cl=c2 *(0.9 + 0.2 * dt.r)* lado;
s.alb=mix(s.alb,cl,lam);
s.rug=mix(s.rug,0.75,lam);
s.met=mix(s.met,0.0,lam);
s.inc=mix(s.inc,vec2(0.0),lam);
s.emi *=1.0 - lam;
}
void gVarandas(inout GSup s,vec2 uv,vec2 duv,float andar,float vari,vec3 c1,vec3 c2,vec3 tinta,float uso,vec3 vista){
float fv=uv.y / andar;
vec2 d=vec2(duv.x,duv.y / andar);
float lonje=gLonge(d);
vec2 cel=vec2(floor(uv.x),floor(fv));
vec2 h=gH2(vec3(cel,vIdent.x));
float div=gPulso(uv.x,0.0,0.06,d.x);
float laje=gPulso(fv,0.0,0.07,d.y);
float gc=gPulso(fv,0.07,0.43,d.y)*(1.0 - div);
float fundo=gPulso(fv,0.43,1.0,d.y)*(1.0 - div);
float fecha=mix(step(0.76,h.x),0.2,lonje);
vec3 luz=gAcesa(h,uso,gLongeLuz(d),lonje);
gVidroClaro(s,fundo * gPulso(uv.x,0.1,0.9,d.x),h,step(0.6,h.y),lonje);
s.alb *=1.0 - 0.3 * fundo *(1.0 - fecha);
s.ao *=1.0 - 0.4 * fundo *(1.0 - fecha);
s.emi +=luz * fundo * 0.8;
gVidroEspelho(s,fundo * fecha,h,vec3(0.1,0.11,0.12),lonje);
bool gv=mod(vari,2.0)< 0.5;
vec3 gcCor=gv ? vec3(0.07,0.08,0.085): c1;
s.alb=mix(s.alb,gcCor,gc);
s.met=mix(s.met,gv ? 0.75 : 0.0,gc);
s.rug=mix(s.rug,gv ? 0.1 : 0.8,gc);
s.alb=mix(s.alb,c2 * 1.05,laje);
s.rug=mix(s.rug,0.8,laje);
s.met=mix(s.met,0.0,laje);
s.emi *=1.0 - max(laje,gc * 0.7);
}
void gTerreo(inout GSup s,vec2 uv,vec2 duv,float tH,float terreo,float vao,vec3 c1,vec3 c2,vec3 tinta,vec3 vista){
float id=vIdent.x;
float fv=uv.y / tH;
vec2 d=vec2(duv.x,duv.y / tH);
float um=uv.x * vao;
float tt=terreo > 5.5 ? terreo - 5.0 : terreo;
if(tt < 1.5){
float pil=gPulso(uv.x,0.0,0.07,d.x)+ gPulso(uv.x,0.93,1.0,d.x);
float letr=gPulso(fv,0.72,0.93,d.y)*(1.0 - pil);
float vao0=gPulso(fv,0.02,0.68,d.y)*(1.0 - pil);
vec2 h=gH2(vec3(floor(uv.x),3.0,id));
float hl=gH1(vec3(7.0,3.0,id));
vec3 cl=gLin(gRGB(vCor.y));
vec3 corL=hl < 0.2 ? vec3(0.22,0.04,0.03): hl < 0.4 ? vec3(0.025,0.07,0.12): hl < 0.55 ? cl * 0.8 : hl < 0.7 ? vec3(0.3,0.19,0.04): hl < 0.85 ? vec3(0.55,0.53,0.5): vec3(0.05);
vec3 corT=gLum(corL)> 0.2 ? vec3(0.04,0.05,0.08): vec3(0.62,0.6,0.55);
float ln=(fv - 0.72)/ 0.21;
float ch=floor(um / 0.32);
float gl=step(0.35,gH1(vec3(ch,9.0,id)))* gPulso(um / 0.32,0.12,0.88,duv.x * vao / 0.32);
float txt=gl * gPulso(ln,0.28,0.72,d.y / 0.21)* step(0.12,fract(uv.x))* step(fract(uv.x),0.88);
txt *=1.0 - gLonge(vec2(duv.x * vao / 0.32));
s.alb=mix(s.alb,c1 * 0.85,pil);
s.alb=mix(s.alb,mix(corL,corT,txt),letr);
s.rug=mix(s.rug,0.5,letr);
float abreH=7.5 + 2.0 * h.y;
float fechaH=19.0 + 4.0 * h.x;
float aberta=(gHora > abreH && gHora < fechaH)? 1.0 : 0.0;
if(gH1(vec3(floor(uv.x),4.0,id))< 0.08)aberta=0.0;
vec2 off=clamp(- vista.xy / vista.z * 0.3,vec2(-0.6),vec2(0.6));
float vg=vao0 * gPulso(uv.x + off.x / vao,0.08,0.92,d.x)* gPulso(fv + off.y / tH,0.02,0.68,d.y);
s.alb=mix(s.alb,c1 * 0.6,max(vao0 - vg,0.0));
float prat=gPulso(fv * 4.0,0.0,0.18,d.y * 4.0)* step(fv,0.5);
vec3 merc=mix(vec3(0.16,0.1,0.06),vec3(0.07,0.1,0.13),h.y)*(0.6 + 0.8 * gH1(vec3(floor(um / 0.6),floor(fv * 8.0),id)));
float gond=gPulso(fv,0.06,0.42,d.y)* step(0.3,fract(um / 1.8));
vec3 loja=mix(vec3(0.09,0.085,0.075),vec3(0.05,0.055,0.06),h.x)+ prat * vec3(0.08,0.07,0.055);
loja=mix(loja,merc,gond * 0.8);
float forro=gPulso(fv,0.6,0.66,d.y);
float ripa=gLinha(fract(fv * tH / 0.1 + 0.5)- 0.5,0.3,duv.y / 0.1);
vec3 aco=mix(vec3(0.34,0.35,0.35),cl * 0.7,step(0.6,h.y))*(1.0 - 0.3 * ripa);
vec3 dentro=mix(aco,mix(loja,tinta,0.3),aberta);
s.alb=mix(s.alb,dentro,vg);
s.rug=mix(s.rug,mix(0.5,0.06,aberta),vg);
s.met=mix(s.met,mix(0.5,0.0,aberta),vg);
s.emi +=vec3(1.0,0.9,0.76)* vg * aberta *((0.035 + 0.16 * gNoite)*(0.6 + 0.6 * prat + 0.5 * gond + 0.3 * h.y)+ forro *(0.16 + 0.3 * gNoite));
s.emi +=mix(corL,vec3(1.0,0.9,0.75),txt)* 1.2 * letr * step(0.5,fract(hl * 5.3))* step(gHora,23.0)* gNoite;
}else if(tt < 2.5){
float mont=gLinha(fract(uv.x * 2.0 + 0.5)- 0.5,0.06,d.x * 2.0);
float vg=gPulso(fv,0.02,0.86,d.y)*(1.0 - mont);
vec2 h=gH2(vec3(floor(uv.x * 2.0),8.0,id));
s.alb=mix(c1 * 0.95,mix(vec3(0.2,0.17,0.13),tinta,0.5),vg);
s.alb=mix(s.alb,c2,mont * gPulso(fv,0.02,0.86,d.y));
s.rug=mix(s.rug,0.07,vg);
s.met=mix(s.met,0.6,vg);
s.emi +=vec3(1.0,0.85,0.65)* vg *(0.012 + 0.14 * gNoite)*(0.3 + 1.0 * h.x * h.x);
}else if(tt < 3.5){
float ab=gPulso(uv.x,0.12,0.88,d.x)* gPulso(fv,0.0,0.8,d.y);
float grade=gLinha(fract(um / 0.15 + 0.5)- 0.5,0.2,duv.x * vao / 0.15);
s.alb=mix(s.alb * 0.9,mix(vec3(0.03),c2 * 0.6,grade * 0.8),ab);
s.rug=mix(s.rug,0.5,ab * grade);
}else if(tt < 4.5){
float pil=gPulso(uv.x,0.44,0.56,d.x);
s.alb=mix(vec3(0.05,0.05,0.048),c1 * 0.7,pil);
s.ao *=0.6;
}else{
float porta=gPulso(uv.x * 0.5,0.12,0.88,d.x * 0.5)* gPulso(fv,0.0,0.78,d.y);
float ripa=gLinha(fract(uv.y / 0.1 + 0.5)- 0.5,0.3,duv.y / 0.1);
s.alb=mix(s.alb,c2 *(0.9 - 0.2 * ripa),porta);
s.met=mix(s.met,0.6,porta);
s.rug=mix(s.rug,0.45,porta);
}
s.alb *=mix(0.72,1.0,smoothstep(0.0,0.5,uv.y));
}
vec3 gTinta(float vid){
return vid < 0.42 ? vec3(0.14,0.158,0.176): vid < 0.68 ? vec3(0.15,0.15,0.15): vid < 0.84 ? vec3(0.115,0.145,0.19): vid < 0.93 ? vec3(0.12,0.148,0.135): vec3(0.165,0.142,0.12);
}
GSup gFachada(vec3 vista){
GSup s;
float tipo=vFac.x;
float andar=max(vFac.y,0.5);
float vao=max(vFac.z,0.4);
float bits=vFac.w;
float uso=mod(bits,4.0);
float vari=mod(floor(bits / 4.0),8.0);
float terreo=floor(bits / 32.0);
vec3 c1=gLin(gRGB(vCor.x));
vec3 c2=gLin(gRGB(vCor.y));
float nB=floor(vCor.z);
float desg=fract(vCor.z);
float vid=vCor.w;
vec2 uv=vPF.xy;
vec2 duv=max(fwidth(uv),vec2(1e-4));
float um=uv.x * vao;
float id=vIdent.x;
vec4 dt=texture(gDetalhe,vec2(um * 0.11 + id * 0.173,uv.y * 0.11));
vec4 df=texture(gDetalhe,vec2(um * 0.53,uv.y * 0.53 + id * 0.07));
vec3 tinta=gTinta(vid);
s.alb=c1;
s.rug=0.82;
s.met=0.0;
s.emi=vec3(0.0);
s.inc=vec2(0.0);
s.ao=vPF.w;
float tH=G_TERREO_H[ int(terreo)];
if(tipo >=F_TELHA || tipo==F_LISO){
if(tipo==F_TELHA){
vec2 t=vec2(uv.x / 0.21,uv.y / 0.33);
vec2 dd=duv / vec2(0.21,0.33);
float l=gLonge(dd);
float fiada=gPulso(t.y,0.0,0.16,dd.y);
float capa=0.5 + 0.5 * cos(6.2832 * t.x);
float tom=gH1(vec3(floor(t),id));
vec3 c=c1 *(0.86 + 0.26 * mix(tom,0.5,l))* mix(0.82 + 0.25 * capa,1.0,l)* mix(1.0 - 0.3 * fiada,0.93,l);
c *=0.8 + 0.35 * dt.r;
s.alb=mix(c,c * vec3(0.62,0.64,0.6),desg * smoothstep(0.45,0.8,dt.g));
s.rug=0.72;
s.inc=vec2(0.0,(capa - 0.5)* 0.25 *(1.0 - l));
gMascaraTelhado=1.0;
}else if(tipo==F_FIBRO){
float o=uv.x / 0.177;
float l=gLonge(vec2(duv.x / 0.177));
float onda=cos(6.2832 * o);
s.alb=c1 *(0.84 + 0.3 * dt.r)* mix(0.9 + 0.12 * onda,1.0,l);
s.alb *=1.0 - 0.45 * desg * smoothstep(0.35,0.75,dt.g)- 0.12 * smoothstep(0.6,0.9,df.b);
s.rug=0.88;
s.inc=vec2(sin(6.2832 * o)* 0.35 *(1.0 - l),0.0);
gMascaraTelhado=1.0;
}else if(tipo==F_LAJE){
vec2 dd=duv;
float jt=max(gLinha(fract(uv.x + 0.5)- 0.5,0.03,dd.x),gLinha(fract(uv.y + 0.5)- 0.5,0.03,dd.y));
float tom=gH1(vec3(floor(uv),id));
s.alb=c1 *(0.9 + 0.14 * tom)*(0.78 + 0.35 * dt.r)*(1.0 - 0.18 * jt);
s.alb *=1.0 - 0.3 * desg * smoothstep(0.55,0.8,dt.g);
s.rug=0.9;
gMascaraTelhado=1.0;
}else if(tipo==F_TELHA_METAL){
float o=uv.x / 0.25;
float l=gLonge(vec2(duv.x / 0.25));
float nerv=gPulso(o,0.0,0.18,duv.x / 0.25);
s.alb=c1 *(0.85 + 0.2 * dt.r)* mix(1.0 - 0.18 * nerv,0.95,l);
s.rug=0.45;
s.met=0.55;
s.inc=vec2((fract(o)< 0.09 ? 0.4 : fract(o)< 0.18 ? -0.4 : 0.0)*(1.0 - l),0.0);
s.alb *=1.0 - 0.3 * desg * smoothstep(0.5,0.85,dt.b);
gMascaraTelhado=1.0;
}else if(tipo==F_CONCRETO || tipo==F_LISO){
s.alb=c1 *(0.84 + 0.3 * dt.r)*(0.95 + 0.1 * df.g);
float esc=smoothstep(0.5,0.85,texture(gDetalhe,vec2(um * 0.23 + id * 0.31,uv.y * 0.035)).g);
s.alb *=1.0 -(0.06 + 0.2 * desg)* esc - 0.15 * desg * smoothstep(0.55,0.85,dt.g);
float remendo=step(0.8,gH1(vec3(floor(um / 2.3),floor(uv.y / 1.7),id)))* desg *(1.0 - gLonge(duv / 1.7));
s.alb *=1.0 + 0.08 * remendo;
s.rug=tipo==F_CONCRETO ? 0.88 : 0.8;
}else if(tipo==F_METAL){
s.alb=c1 *(0.9 + 0.15 * dt.r);
s.rug=0.38;
s.met=0.8;
}else if(tipo==F_VIDRO){
s.alb=mix(tinta,c1 * 0.5,0.25);
s.rug=0.06;
s.met=0.85;
}else if(tipo==F_MADEIRA){
float veio=gPulso(uv.x * vao / 0.14,0.0,0.1,duv.x * vao / 0.14);
s.alb=c1 *(0.8 + 0.3 * df.r)*(1.0 - 0.25 * veio);
s.rug=0.7;
}else if(tipo==F_PEDRA){
vec2 p=vec2(um / 0.6,uv.y / 0.3);
p.x +=step(0.5,fract(p.y * 0.5))* 0.5;
vec2 dd=vec2(duv.x * vao / 0.6,duv.y / 0.3);
float jt=max(gLinha(fract(p.x + 0.5)- 0.5,0.05,dd.x),gLinha(fract(p.y + 0.5)- 0.5,0.08,dd.y));
s.alb=c1 *(0.8 + 0.35 * mix(gH1(vec3(floor(p),id)),0.5,gLonge(dd)))*(1.0 - 0.3 * jt);
s.rug=0.7;
}else if(tipo==F_TOLDO){
s.alb=c1 *(0.85 + 0.2 * df.r);
s.rug=0.85;
}else if(tipo==F_VERDE){
s.alb=c1 *(0.55 + 0.7 * df.r)*(0.7 + 0.5 * dt.g);
s.rug=0.92;
s.inc=(df.gb - 0.5)* 0.6;
}else if(tipo==F_PISO){
float jt=max(gLinha(fract(uv.x * 1.25 + 0.5)- 0.5,0.04,duv.x * 1.25),gLinha(fract(uv.y * 1.25 + 0.5)- 0.5,0.04,duv.y * 1.25));
s.alb=c1 *(0.82 + 0.3 * dt.r)*(1.0 - 0.2 * jt);
s.rug=0.9;
}else if(tipo==F_AGUA){
s.alb=vec3(0.02,0.07,0.075);
s.rug=0.04;
s.met=0.25;
s.inc=(df.rg - 0.5)* 0.12;
}else if(tipo==F_LETREIRO){
s.alb=c1 * 0.9;
s.rug=0.5;
float aberto=step(7.5,gHora)* step(gHora,23.0);
s.emi=mix(c1,vec3(1.0,0.86,0.66),0.3)*(0.12 + 0.4 * gNoite)* aberto * gNoite * mix(1.0,0.25,smoothstep(0.15,0.5,gLum(c1)));
}else if(tipo==F_SOLAR){
vec2 p=vec2(uv.x / 1.0,uv.y / 1.65);
vec2 dd=duv / vec2(1.0,1.65);
float mold=max(gLinha(fract(p.x + 0.5)- 0.5,0.05,dd.x),gLinha(fract(p.y + 0.5)- 0.5,0.04,dd.y));
s.alb=mix(vec3(0.015,0.02,0.035),c2,mold);
s.rug=mix(0.12,0.4,mold);
s.met=mix(0.5,0.7,mold);
gMascaraTelhado=1.0;
}else if(tipo==F_PORTA){
float fr=gPulso(uv.x,0.06,0.94,duv.x);
s.alb=mix(c2,c1 *(0.8 + 0.2 * df.r),fr);
s.rug=0.6;
}else if(tipo==F_GARAGEM){
float ripa=gLinha(fract(uv.y / 0.12 + 0.5)- 0.5,0.25,duv.y / 0.12);
s.alb=c1 *(0.9 - 0.25 * ripa);
s.rug=0.45;
s.met=0.6;
}
s.alb=clamp(s.alb,0.0,0.8);
return s;
}
float pano=gH1(vec3(floor(um / 3.6),floor(uv.y / 6.0),id));
s.alb=c1 *(0.9 + 0.2 * dt.r)*(1.0 +(pano - 0.5)* 0.07 * desg);
float escP=smoothstep(0.55,0.88,texture(gDetalhe,vec2(um * 0.23 + id * 0.31,uv.y * 0.035)).g);
float daBorda=smoothstep(vPF.z - 9.0,vPF.z,uv.y);
s.alb *=1.0 -(0.03 + 0.15 * desg)* escP * daBorda * daBorda;
bool noTerreo=terreo > 0.5 && uv.y < tH;
bool platibanda=uv.y > vPF.z;
vec2 uvA=vec2(uv.x,uv.y -(terreo > 0.5 ? tH : 0.0));
if(noTerreo){
gTerreo(s,uv,duv,tH,terreo,vao,c1,c2,tinta,vista);
}else if(platibanda){
float topo=smoothstep(vPF.z + 0.9,vPF.z + 0.5,uv.y);
s.alb=c1 *(0.88 + 0.2 * dt.r);
s.alb *=1.0 - desg * 0.2 *(1.0 - topo)* dt.g;
s.alb *=1.0 - 0.2 * gPulso(uv.y - vPF.z,0.0,0.12,duv.y);
}else if(tipo==F_CORTINA){
gPele(s,uvA,duv,andar,vao,vari,c1,c2,tinta,uso);
}else if(tipo==F_BRISE_H || tipo==F_BRISE_V){
gBrise(s,uvA,duv,andar,vao,vari,c1,c2,tinta,uso,tipo,vista,dt);
}else if(tipo==F_COBOGO){
vec2 p=vec2(um / 0.4,uvA.y / 0.4);
vec2 dd=vec2(duv.x * vao / 0.4,duv.y / 0.4);
float fu=gPulso(p.x,0.18,0.82,dd.x)* gPulso(p.y,0.18,0.82,dd.y);
float cruz=gPulso(p.x,0.44,0.56,dd.x)+ gPulso(p.y,0.44,0.56,dd.y);
float furo=clamp(fu - cruz * 0.6,0.0,1.0);
s.alb=mix(c1 *(0.9 + 0.2 * dt.r),vec3(0.03,0.03,0.028),furo);
s.ao *=1.0 - 0.3 * furo;
s.emi +=vec3(1.0,0.82,0.6)* furo * 0.1 * gNoite * step(0.65,gH1(vec3(floor(uv.x),floor(uvA.y / 3.0),id)));
}else if(tipo==F_VARANDA){
gVarandas(s,uvA,duv,andar,vari,c1,c2,tinta,uso,vista);
}else if(tipo==F_GALPAO){
float o=um / 0.25;
float l=gLonge(vec2(duv.x * vao / 0.25));
float nerv=gPulso(o,0.0,0.2,duv.x * vao / 0.25);
s.alb=c1 * mix(1.0 - 0.16 * nerv,0.96,l)*(0.85 + 0.2 * dt.r);
s.inc=vec2((fract(o)< 0.1 ? 0.35 : fract(o)< 0.2 ? -0.35 : 0.0)*(1.0 - l),0.0);
s.met=0.45;
s.rug=0.5;
s.alb *=1.0 - 0.25 * desg * smoothstep(0.4,0.9,dt.g)* smoothstep(6.0,0.0,uv.y);
float pil=gPulso(uv.x,0.0,0.05,duv.x);
s.alb=mix(s.alb,c2 * 0.8,pil);
float fv=uvA.y / andar;
vec2 d=vec2(duv.x,duv.y / andar);
float jan=gPulso(fv,0.74,0.88,d.y)* gPulso(uv.x,0.08,0.92,d.x);
vec2 h=gH2(vec3(floor(uv.x),floor(fv),id));
gVidroClaro(s,jan,h,0.4,gLonge(d));
s.alb=mix(s.alb,vec3(0.3,0.31,0.3),jan * 0.5);
s.emi +=gAcesa(h,uso,gLongeLuz(d),gLonge(d))* jan;
float base=1.0 - smoothstep(1.75,1.85,uv.y);
vec2 pb=vec2(um / 0.4,uv.y / 0.2);
pb.x +=step(0.5,fract(pb.y * 0.5))* 0.5;
vec2 db=vec2(duv.x * vao / 0.4,duv.y / 0.2);
float jb=max(gLinha(fract(pb.x + 0.5)- 0.5,0.04,db.x),gLinha(fract(pb.y + 0.5)- 0.5,0.06,db.y));
vec3 bloco=vec3(0.3,0.29,0.27)*(0.85 + 0.25 * dt.r)*(1.0 - 0.2 * jb);
s.alb=mix(s.alb,bloco,base);
s.met=mix(s.met,0.0,base);
s.rug=mix(s.rug,0.9,base);
s.inc *=1.0 - base;
}else{
if(tipo==F_PASTILHA){
vec2 p=vec2(um / 0.05,uv.y / 0.05);
vec2 dd=vec2(duv.x * vao / 0.05,duv.y / 0.05);
float rj=max(gLinha(fract(p.x + 0.5)- 0.5,0.12,dd.x),gLinha(fract(p.y + 0.5)- 0.5,0.12,dd.y));
float tom=gH1(vec3(floor(p),id));
s.alb=c1 *(0.92 + 0.16 * mix(tom,0.5,gLonge(dd)))*(1.0 - 0.2 * rj)*(0.9 + 0.2 * dt.r);
s.rug=0.45;
}else if(tipo==F_TIJOLO){
vec2 p=vec2(um / 0.24,uv.y / 0.09);
p.x +=step(0.5,fract(p.y * 0.5))* 0.5;
vec2 dd=vec2(duv.x * vao / 0.24,duv.y / 0.09);
float rj=max(gLinha(fract(p.x + 0.5)- 0.5,0.06,dd.x),gLinha(fract(p.y + 0.5)- 0.5,0.12,dd.y));
float tom=gH1(vec3(floor(p),id));
s.alb=c1 *(0.85 + 0.3 * mix(tom,0.5,gLonge(dd)))*(1.0 - 0.25 * rj);
s.rug=0.88;
}else if(tipo==F_PAINEL){
float fv=uvA.y / andar;
vec2 d=vec2(duv.x,duv.y / andar);
float jt=max(gLinha(fract(uv.x + 0.5)- 0.5,0.02,d.x),gLinha(fract(fv + 0.5)- 0.5,0.02,d.y));
s.alb *=1.0 - 0.28 * jt;
s.rug=0.8;
}
gJanelas(s,uvA,duv,andar,vao,nB,vari,c1,c2,uso,desg,tipo,vista,dt);
}
s.alb *=mix(1.0 - 0.28 * desg,1.0,smoothstep(0.0,0.8,uv.y));
s.alb=clamp(s.alb,0.0,0.8);
s.ao *=mix(0.7,1.0,smoothstep(0.0,1.6,uv.y));
return s;
}
${m}
`,F=`
#include <color_fragment>
#ifdef FAC_BARATA
GSup gS=gFachadaLonge();
#else
vec3 gVista=vec3(0.0,0.0,1.0);
{
vec3 gNf=normalize(vNormal);
vec3 gVv=normalize(vViewPosition);
vec3 gUpv=normalize((viewMatrix * vec4(0.0,1.0,0.0,0.0)).xyz);
vec3 gTv=cross(gUpv,gNf);
float gTl=length(gTv);
if(gTl > 0.3){
gTv /=gTl;
gVista=vec3(dot(gVv,gTv),dot(gVv,cross(gNf,gTv)),max(dot(gVv,gNf),0.12));
}
}
GSup gS=gFachada(gVista);
#endif
if((uint(vIdent.y + 0.5)& B_ABANDONADO)!=0u)gAbandono(gS);
diffuseColor.rgb=gS.alb;
`,L=`
#include <roughnessmap_fragment>
roughnessFactor=clamp(gS.rug,0.0,1.0);
`,_=`
#include <metalnessmap_fragment>
metalnessFactor=clamp(gS.met,0.0,1.0);
`,T=`
#include <normal_fragment_maps>
{
vec3 gCima=normalize((viewMatrix * vec4(0.0,1.0,0.0,0.0)).xyz);
vec3 gT=cross(gCima,normal);
float gTl=length(gT);
gT=gTl > 0.1 ? gT / gTl : normalize(cross(normalize((viewMatrix * vec4(1.0,0.0,0.0,0.0)).xyz),normal));
vec3 gB=cross(normal,gT);
normal=normalize(normal + gT * gS.inc.x + gB * gS.inc.y);
}
`,P=`
#include <emissivemap_fragment>
totalEmissiveRadiance +=gS.emi;
if(abs(vIdent.x - gSelecionado)< 0.5){
float gFr=pow(1.0 - abs(dot(normalize(vViewPosition),normal)),3.0);
totalEmissiveRadiance +=vec3(0.9,0.72,0.42)*(0.12 + 1.4 * gFr);
}
`,E=`
#include <lights_fragment_maps>
#if defined( RE_IndirectSpecular ) && !defined( USE_ENVMAP )
{
vec3 gR=inverseTransformDirection(reflect(- geometryViewDir,geometryNormal),viewMatrix);
vec3 gCeu=gR.y > 0.0 ? mix(gCeuHor,gCeuZen,pow(gR.y,0.55)): mix(gCeuHor,gCeuChao,smoothstep(0.0,0.2,- gR.y));
radiance +=gCeu * gCeuLigado;
}
#endif
`,R=`
#include <aomap_fragment>
reflectedLight.indirectDiffuse *=gS.ao;
reflectedLight.indirectSpecular *=mix(1.0,gS.ao,0.6);
reflectedLight.directDiffuse *=mix(1.0,gS.ao,0.3);
`,O=`
#include <dithering_fragment>
if(gPrediosMascara > 0.5)gl_FragColor=vec4(vec3(gMascaraTelhado),1.0);
`;export{p as a,u as b,y as c,h as d,b as e,A as f,F as g,L as h,_ as i,T as j,P as k,E as l,R as m,O as n};
