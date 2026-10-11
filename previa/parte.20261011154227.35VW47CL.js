var f=`
#ifndef G_NORMAL_MUNDO
#if defined( STANDARD ) || defined( PHYSICAL ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON )
#define G_NORMAL_MUNDO inverseTransformDirection( geometryNormal, viewMatrix )
#define G_ILUMINADO
#else
#define G_NORMAL_MUNDO normalize( cross( dFdx( vGPosMundo ), dFdy( vGPosMundo ) ) )
#endif
#endif
`,i=`
${f}
#ifndef G_CAMPO_PARS
#define G_CAMPO_PARS
uniform sampler2D gCampoMapa;
uniform vec4 gCampoParams;
uniform float gCampoLigado;
vec4 gCampo(vec2 xz){return texture(gCampoMapa,(xz - gCampoParams.xy)* gCampoParams.z);}
#endif
`,n=`
uniform highp sampler2DShadow gSombraMapa;
uniform mat4 gSombraMatriz;
uniform mat4 gSombraMatriz1;
uniform float gSombraLigada;
uniform float gSombraCascatas;
uniform float gSombraTexel;
uniform float gSombraVies;
uniform float gSombraNormal;
uniform float gSombraNormal1;
uniform float gSombraRaioPcf;
uniform float gSombraAmostras;
uniform float gSombraForca;
uniform sampler2D gNuvemMapa;
uniform vec4 gNuvemParams;
uniform vec4 gNuvemDesloc;
const vec2 G_VOGEL[ 8 ]=vec2[ 8 ](vec2(0.70710678,0.00000000),vec2(-0.90308875,0.82730327),vec2(0.13823221,-1.57508471),vec2(1.13828488,1.48469106),vec2(-2.08889275,-0.36949572),vec2(1.97878157,-1.25873886),vec2(-0.66186371,2.46210000),vec2(-1.26224587,-2.43037762));
float gSombraPcf(vec3 s,float c,float n){
float z=s.z - gSombraVies;
vec2 texel=vec2(gSombraTexel / n,gSombraTexel);
vec2 lim0=vec2(c / n,0.0)+ 0.5 * texel;
vec2 lim1=vec2((c + 1.0)/ n,1.0)- 0.5 * texel;
vec2 uv=vec2((s.x + c)/ n,s.y);
vec2 cel=floor(s.xy / gSombraTexel);
float fase=fract(52.9829189 * fract(dot(cel,vec2(0.06711056,0.00583715))))* 6.2831853;
float cf=cos(fase);
float sf=sin(fase);
mat2 giro=mat2(cf,sf,-sf,cf);
vec2 raio=texel * gSombraRaioPcf * inversesqrt(gSombraAmostras);
float soma=0.0;
float k=0.0;
for(int i=0;i < 8;i ++){
if(float(i)>=gSombraAmostras)break;
vec2 o=(giro * G_VOGEL[ i ])* raio;
soma +=texture(gSombraMapa,vec3(clamp(uv + o,lim0,lim1),z));
k +=1.0;
}
return soma / max(k,1.0);
}
float gSombraBorda(vec3 s){
vec2 b=min(s.xy,1.0 - s.xy);
return s.z <=0.0 || s.z >=1.0 ? -1.0 : min(b.x,b.y);
}
float gSombraPerto(vec3 nMundo,out float w){
w=0.0;
if(gSombraLigada < 0.5)return 1.0;
vec3 s0=(gSombraMatriz * vec4(vGPosMundo + nMundo * gSombraNormal,1.0)).xyz;
float b0=gSombraBorda(s0);
if(gSombraCascatas < 1.5){
if(b0 <=0.0)return 1.0;
w=smoothstep(0.0,0.05,b0);
return gSombraPcf(s0,0.0,1.0);
}
vec3 s1=(gSombraMatriz1 * vec4(vGPosMundo + nMundo * gSombraNormal1,1.0)).xyz;
float b1=gSombraBorda(s1);
float w1=b1 > 0.0 ? smoothstep(0.0,0.05,b1): 0.0;
float w0=b0 > 0.0 ? smoothstep(0.0,0.08,b0): 0.0;
float a=w1 *(1.0 - w0);
w=a + w0;
if(w <=0.0)return 1.0;
float v1=a > 0.0 ? gSombraPcf(s1,1.0,2.0): 1.0;
float v0=w0 > 0.0 ? gSombraPcf(s0,0.0,2.0): 1.0;
return(v1 * a + v0 * w0)/ w;
}
float gNuvemSombra(){
if(gNuvemParams.y <=0.0)return 1.0;
vec2 xz=vGPosMundo.xz +(1500.0 - vGPosMundo.y)* gNuvemDesloc.zw;
float n=texture(gNuvemMapa,xz * gNuvemParams.x + gNuvemDesloc.xy).r;
return 1.0 - gNuvemParams.y * smoothstep(gNuvemParams.z,gNuvemParams.z + 0.12,n);
}
`,v=`
{
vec3 gSN=inverseTransformDirection(geometryNormal,viewMatrix);
float gSW=0.0;
float gSL=gSombraPerto(gSN,gSW);
#ifdef G_SOMBRALONGE
gSL=mix(gSombraLonge(gSN),gSL,gSW);
#endif
directLight.color *=mix(1.0,gSL,gSombraForca)* gNuvemSombra();
}
`,m=Object.freeze({potencia:3,chao:[1,4]}),u=`
#ifndef G_CAMPO_MISTURA
#define G_CAMPO_MISTURA
float gCampoMistura(vec4 c,float t){
float u=1.0 - t;
float curva=c.g > c.r ? t * t * t : 1.0 - u * u * u;
float w=1.0 - smoothstep(${m.chao[0].toFixed(1)},${m.chao[1].toFixed(1)},min(c.r,c.g)- c.a);
return mix(c.r,c.g,mix(t,curva,w));
}
#endif
`,l=`
${i}
${u}
uniform float gCampoT;
uniform vec2 gCampoVies;
float gSombraLonge(vec3 nW){
if(gCampoLigado < 0.5)return 1.0;
vec2 uv=(vGPosMundo.xz + nW.xz *(0.75 * gCampoParams.w)- gCampoParams.xy)* gCampoParams.z;
if(uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0)return 1.0;
vec4 c=texture(gCampoMapa,uv);
float s=gCampoMistura(c,gCampoT)- gCampoVies.x;
return smoothstep(s - gCampoVies.y,s + gCampoVies.y,vGPosMundo.y + nW.y * 0.4);
}
`,g=`
${i}
uniform vec4 gHaoParams;
float gHao(vec3 nW){
if(gHaoParams.w < 0.5 || gCampoLigado < 0.5)return 1.0;
vec4 c=gCampo(vGPosMundo.xz + nW.xz *(0.6 * gCampoParams.w));
float z=max(0.0,vGPosMundo.y - c.a);
float v=max(c.b,gHaoParams.y);
float cima=smoothstep(0.5,0.8,nW.y);
float alt=mix(mix(6.0,30.0,1.0 - v),2.2,cima);
float ao=mix(v,1.0,smoothstep(0.6 * cima,alt,z));
ao *=mix(1.0,mix(0.8,1.0,smoothstep(0.0,2.5,z)),(1.0 - cima)* step(abs(nW.y),0.5));
return mix(1.0,ao,gHaoParams.x);
}
`,x=`
{
float gAo=gHao(G_NORMAL_MUNDO);
reflectedLight.indirectDiffuse *=gAo;
reflectedLight.indirectSpecular *=mix(1.0,gAo,0.6);
reflectedLight.directDiffuse *=mix(1.0,gAo,gHaoParams.z);
}
`,o=Object.freeze({passos:48,primeiro:4,ultimo:48});function d(s){let r=0;for(let a=0;a<s;a++){let t=a/(o.passos-1);r+=o.primeiro+(o.ultimo-o.primeiro)*t*t}return r}var c=2,e=Object.freeze({fim:3500,celulas:2,refino:8,passosMax:48});var p=`
uniform sampler2D uAlturas;
uniform sampler2D uAnterior;
uniform float uN;
uniform float uPassoM;
uniform float uTam;
uniform vec4 uDirA;
uniform vec4 uDirB;
uniform float uModo;
uniform float uHMax;
uniform highp sampler2D uAltos;
uniform highp sampler2D uSaltos;
uniform vec4 uLonge;
float gH(vec2 uv){return textureLod(uAlturas,uv,0.0).r;}
float gH1(vec2 uv){
ivec2 n=textureSize(uAlturas,1);
return texelFetch(uAlturas,clamp(ivec2(uv * vec2(n)),ivec2(0),n - 1),1).r;
}
float marchar(vec2 uv,vec4 d){
if(d.w < 0.5)return -1.0e4;
float s=-1.0e4;
float t=0.0;
vec2 duv=d.xy / uTam;
for(int k=0;k < ${o.passos};k ++){
float f=float(k)/ ${o.passos-1}.0;
float p=${o.primeiro}.0 + ${o.ultimo-o.primeiro}.0 * f * f;
t +=p;
vec2 q=uv + duv * t;
if(q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0)break;
float tm=t - 0.5 * p;
vec2 m=uv + duv * tm;
float hq=gH(q);
float hm=gH(m);
if(p > ${c}.0 * uPassoM){
hq=max(hq,gH1(q));
hm=max(hm,gH1(m));
}
s=max(s,max(hq - t * d.z,hm - tm * d.z));
if(uHMax - t * d.z <=s)break;
}
return s;
}
float marcharLonge(vec2 uv,vec4 d,float s){
if(d.w < 0.5 || uLonge.w - uLonge.x * d.z <=s)return s;
vec2 duv=d.xy / uTam;
ivec2 nA=textureSize(uAltos,0);
ivec2 nS=textureSize(uSaltos,0);
float pf=uLonge.z / ${e.refino}.0;
for(int k=0;k < ${e.passosMax};k ++){
float t0=uLonge.x + float(k)* uLonge.z;
if(t0 + uLonge.z > uLonge.y || uLonge.w - t0 * d.z <=s)break;
vec2 m=uv + duv *(t0 + 0.5 * uLonge.z);
if(m.x < 0.0 || m.y < 0.0 || m.x > 1.0 || m.y > 1.0)break;
if(texelFetch(uSaltos,clamp(ivec2(m * vec2(nS)),ivec2(0),nS - 1),0).r - t0 * d.z <=s)continue;
for(int r=0;r < ${e.refino};r ++){
float t=t0 +(float(r)+ 0.5)* pf;
ivec2 c=clamp(ivec2((uv + duv * t)* vec2(nA)),ivec2(0),nA - 1);
s=max(s,texelFetch(uAltos,c,0).r - t * d.z);
}
}
return s;
}
float sombraEm(vec2 uv,vec4 d){return marcharLonge(uv,d,marchar(uv,d));}
void main(){
vec2 uv=gl_FragCoord.xy / uN;
if(uModo > 0.5){
vec4 a=texelFetch(uAnterior,ivec2(gl_FragCoord.xy),0);
gl_FragColor=vec4(a.g,sombraEm(uv,uDirB),a.b,a.a);
return;
}
float tx=1.0 / uN;
float h0=gH(uv);
float hs[ 8 ];
float chao=h0;
for(int i=0;i < 8;i ++){
float a=float(i)* 0.7853981633974483;
hs[ i ]=gH(uv + vec2(cos(a),sin(a))* tx);
chao=min(chao,hs[ i ]);
}
float soma=0.0;
for(int i=0;i < 8;i ++){
float a=float(i)* 0.7853981633974483;
vec2 dd=vec2(cos(a),sin(a))* tx;
float m=max(0.0,(hs[ i ] - chao)/ uPassoM);
m=max(m,(gH(uv + dd * 2.0)- chao)/(2.0 * uPassoM));
m=max(m,(gH(uv + dd * 4.0)- chao)/(4.0 * uPassoM));
m=max(m,(gH(uv + dd * 8.0)- chao)/(8.0 * uPassoM));
soma +=m * inversesqrt(1.0 + m * m);
}
gl_FragColor=vec4(sombraEm(uv,uDirA),sombraEm(uv,uDirB),1.0 - soma / 8.0,chao);
}
`;export{i as a,n as b,v as c,m as d,u as e,l as f,g,x as h,o as i,d as j,c as k,e as l,p as m};
