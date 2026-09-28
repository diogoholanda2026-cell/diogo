import{b as se,c as ie}from"./parte.20260928202955.5OZNUAOP.js";import{a as M}from"./parte.20260928202955.IBTJYPFY.js";import{a as D}from"./parte.20260928202955.OUH4QGCQ.js";import{$ as ce,B as ue,Ea as fe,Ha as $,Ia as ge,Ja as V,Xa as U,Za as ve,cb as j,e as ne,ea as z,eb as de,ga as E,gb as pe,ka as x,la as w,o as le,pa as F,q as P,t as A,ua as S,va as I,w as me,ya as B}from"./parte.20260928202955.NRVGTEV3.js";import{a as re}from"./parte.20260928202955.MWP5KBI4.js";var ca={};re(ca,{ALBEDOS:()=>Le,ALBEDO_MAXIMO:()=>ia,GANCHOS_COMUNS:()=>ae,criarMaterial:()=>na,luminanciaAlbedo:()=>ma,prepararMaterial:()=>la,registrar:()=>ua});var Ge=`
#ifndef G_NORMAL_MUNDO
#if defined( STANDARD ) || defined( PHYSICAL ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON )
#define G_NORMAL_MUNDO inverseTransformDirection( geometryNormal, viewMatrix )
#define G_ILUMINADO
#else
#define G_NORMAL_MUNDO normalize( cross( dFdx( vGPosMundo ), dFdy( vGPosMundo ) ) )
#endif
#endif
`,_=`
${Ge}
#ifndef G_CAMPO_PARS
#define G_CAMPO_PARS
uniform sampler2D gCampoMapa;
uniform vec4 gCampoParams;
uniform float gCampoLigado;
vec4 gCampo(vec2 xz){return texture(gCampoMapa,(xz - gCampoParams.xy)* gCampoParams.z);}
#endif
`,he=`
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
float gSombraPcf(vec3 s,float c,float n){
float z=s.z - gSombraVies;
vec2 texel=vec2(gSombraTexel / n,gSombraTexel);
vec2 lim0=vec2(c / n,0.0)+ 0.5 * texel;
vec2 lim1=vec2((c + 1.0)/ n,1.0)- 0.5 * texel;
vec2 uv=vec2((s.x + c)/ n,s.y);
vec2 cel=floor(s.xy / gSombraTexel);
float fase=fract(52.9829189 * fract(dot(cel,vec2(0.06711056,0.00583715))))* 6.2831853;
vec2 raio=texel * gSombraRaioPcf;
float soma=0.0;
float k=0.0;
for(int i=0;i < 8;i ++){
if(float(i)>=gSombraAmostras)break;
float r=sqrt((float(i)+ 0.5)/ gSombraAmostras);
float a=float(i)* 2.39996323 + fase;
vec2 o=vec2(cos(a),sin(a))* r * raio;
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
`,xe=`
{
vec3 gSN=inverseTransformDirection(geometryNormal,viewMatrix);
float gSW=0.0;
float gSL=gSombraPerto(gSN,gSW);
#ifdef G_SOMBRALONGE
gSL=mix(gSombraLonge(gSN),gSL,gSW);
#endif
directLight.color *=mix(1.0,gSL,gSombraForca)* gNuvemSombra();
}
`,be=`
${_}
uniform float gCampoT;
uniform vec2 gCampoVies;
float gSombraLonge(vec3 nW){
if(gCampoLigado < 0.5)return 1.0;
vec2 uv=(vGPosMundo.xz + nW.xz *(0.75 * gCampoParams.w)- gCampoParams.xy)* gCampoParams.z;
if(uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0)return 1.0;
vec4 c=texture(gCampoMapa,uv);
float s=mix(c.r,c.g,gCampoT)- gCampoVies.x;
return smoothstep(s - gCampoVies.y,s + gCampoVies.y,vGPosMundo.y + nW.y * 0.4);
}
`,Ee=`
${_}
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
`,Ne=`
{
float gAo=gHao(G_NORMAL_MUNDO);
reflectedLight.indirectDiffuse *=gAo;
reflectedLight.indirectSpecular *=mix(1.0,gAo,0.6);
reflectedLight.directDiffuse *=mix(1.0,gAo,gHaoParams.z);
}
`,b=Object.freeze({passos:48,primeiro:4,ultimo:48});function fa(e){let o=0;for(let a=0;a<e;a++){let r=a/(b.passos-1);o+=b.primeiro+(b.ultimo-b.primeiro)*r*r}return o}var De=2,ga=`
uniform sampler2D uAlturas;
uniform sampler2D uAnterior;
uniform float uN;
uniform float uPassoM;
uniform float uTam;
uniform vec4 uDirA;
uniform vec4 uDirB;
uniform float uModo;
uniform float uHMax;
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
for(int k=0;k < ${b.passos};k ++){
float f=float(k)/ ${b.passos-1}.0;
float p=${b.primeiro}.0 + ${b.ultimo-b.primeiro}.0 * f * f;
t +=p;
vec2 q=uv + duv * t;
if(q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0)break;
float tm=t - 0.5 * p;
vec2 m=uv + duv * tm;
float hq=gH(q);
float hm=gH(m);
if(p > ${De}.0 * uPassoM){
hq=max(hq,gH1(q));
hm=max(hm,gH1(m));
}
s=max(s,max(hq - t * d.z,hm - tm * d.z));
if(uHMax - t * d.z <=s)break;
}
return s;
}
void main(){
vec2 uv=gl_FragCoord.xy / uN;
if(uModo > 0.5){
vec4 a=texelFetch(uAnterior,ivec2(gl_FragCoord.xy),0);
gl_FragColor=vec4(a.g,marchar(uv,uDirB),a.b,a.a);
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
gl_FragColor=vec4(marchar(uv,uDirA),marchar(uv,uDirB),1.0 - soma / 8.0,chao);
}
`;var Fe=`
uniform vec3 gNeblinaAnel[ 12 ];
uniform vec3 gNeblinaZenite;
uniform vec3 gNeblinaSolDir;
vec3 gNeblinaCorVista(vec3 d){
vec2 s=normalize(gNeblinaSolDir.xz + vec2(1e-6,0.0));
vec2 h=normalize(d.xz + vec2(1e-6,0.0));
float phi=acos(clamp(dot(h,s),-1.0,1.0));
float t=sqrt(phi / 3.141592653589793)* 11.0;
int i=int(min(floor(t),10.0));
vec3 cor=mix(gNeblinaAnel[ i ],gNeblinaAnel[ i + 1 ],t - float(i));
return mix(cor,gNeblinaZenite,0.55 * smoothstep(0.12,1.0,d.y));
}
`,Re=`
uniform vec3 gNeblinaBeta;
uniform float gNeblinaQueda;
uniform float gNeblinaLigada;
uniform vec3 gNeblinaSolCor;
uniform vec3 gNeblinaAmb;
uniform float gNeblinaG;
${Fe}
vec3 gNeblinaLuz(vec3 dir,vec3 w){
float g=gNeblinaG;
float c=dot(dir,gNeblinaSolDir);
float hg=(1.0 - g * g)/(12.566370614359172 * pow(max(1.0 + g * g - 2.0 * g * c,1e-4),1.5));
vec3 perto=gNeblinaSolCor * hg + gNeblinaAmb;
return mix(perto,gNeblinaCorVista(dir),w * w);
}
vec3 gNeblina(vec3 cor){
if(gNeblinaLigada < 0.5)return cor;
vec3 d=vGPosMundo - cameraPosition;
float dist=length(d);
float k=gNeblinaQueda;
float h0=cameraPosition.y;
float fator=abs(d.y)> 0.5 ?(exp(- k * h0)- exp(- k *(h0 + d.y)))/(k * d.y): exp(- k * h0);
vec3 T=exp(- gNeblinaBeta *(dist * fator));
vec3 w=1.0 - T;
return cor * T + gNeblinaLuz(d / max(dist,1e-3),w)* w;
}
`,Se="gl_FragColor.rgb = gNeblina( gl_FragColor.rgb );";var ke={};re(ke,{GANHO_RUA:()=>C,LUZES:()=>q,NOITE_INDIRETA:()=>Q,NOITE_LUZ:()=>N,NOITE_PARS:()=>J,POSTES:()=>k,SUAVE:()=>d,brilhoDosPostes:()=>W,forcaJanelas:()=>Te,forcaNoite:()=>ze,pesosSuaves:()=>we,postesDasVias:()=>Ce,registrar:()=>qe});var J=`
${_}
uniform sampler2D gLuzRuaMapa;
uniform vec4 gLuzRuaParams;
uniform vec4 gNoiteParams;
uniform vec3 gNoiteJanelas;
vec3 gNoiteLuz(vec3 nW,float predio){
if(gNoiteParams.x <=0.0)return vec3(0.0);
vec4 c=gCampoLigado > 0.5 ? gCampo(vGPosMundo.xz + nW.xz *(0.6 * gCampoParams.w))
: vec4(0.0,0.0,1.0,vGPosMundo.y - predio * step(0.5,nW.y)* 1.0e4);
float z=max(0.0,vGPosMundo.y - c.a);
vec3 rua=texture(gLuzRuaMapa,(vGPosMundo.xz + nW.xz * 1.5 - gLuzRuaParams.xy)* gLuzRuaParams.z).rgb * gLuzRuaParams.w;
float cima=clamp(nW.y,0.0,1.0);
float teto=mix(gNoiteParams.y,mix(1.0e4,3.0,predio),smoothstep(0.5,0.8,cima));
vec3 luz=rua * mix(0.5,1.0,cima)*(1.0 - smoothstep(0.3 * teto,teto,z));
float perto=1.0 - c.b;
luz +=gNoiteJanelas *(perto * perto)* exp(- z / gNoiteParams.z)* mix(0.7,1.0,cima);
return luz * gNoiteParams.x;
}
`,Q=`
#ifdef G_ILUMINADO
#ifdef EDIFICIO
reflectedLight.indirectDiffuse +=gNoiteLuz(G_NORMAL_MUNDO,1.0)* BRDF_Lambert(material.diffuseColor);
#else
reflectedLight.indirectDiffuse +=gNoiteLuz(G_NORMAL_MUNDO,0.0)* BRDF_Lambert(material.diffuseColor);
#endif
#endif
`,q=Object.freeze({sodio:[1,.48,.14],led:[1,.84,.64]}),k=Object.freeze({rua:{passo:28,lados:1,forca:1.1,raio:6,led:.3},ruaMao:{passo:28,lados:1,forca:1.1,raio:6,led:.3},avenida:{passo:32,lados:2,forca:1.3,raio:7,led:.5},avenidaG:{passo:32,lados:2,forca:1.45,raio:8,led:.6},rodovia:{passo:60,lados:1,forca:.8,raio:8,led:1},terra:{passo:44,lados:1,forca:.7,raio:6,led:0}}),Ie=3.5,Me=(e,o)=>{let a=Math.imul(e^2654435769,2246822507)^Math.imul(o+1663821227,3266489909);return a^=a>>>15,a=Math.imul(a,739982445),((a^a>>>12)>>>0)/4294967296};function Ce(e){let o=[];if(!e)return new Float32Array(0);let a=[0,0],r=[0,0];for(let t=0;t<e.n;t++){if(!e.viva[t])continue;let s=ie[e.tipo[t]]??"rua",m=k[s]??k.rua,n=Math.max(1,(se[s]?.largura??16)/2-Ie),c=e.comp[t]||1,l=Math.max(1,Math.round(c/m.passo)),f=e.corte?e.corte[2*t]:0,u=e.corte?e.corte[2*t+1]:1,i=Me(t,7)<m.led?q.led:q.sodio;for(let p=0;p<l;p++){let v=f+(u-f)*(p+.5)/l;D(e.p,v,a,8*t);let R=v+.001<=1?v+.001:v-.001;D(e.p,R,r,8*t);let L=(r[0]-a[0])*(R>v?1:-1),y=(r[1]-a[1])*(R>v?1:-1),oe=Math.hypot(L,y)||1;L/=oe,y/=oe;let ye=m.lados===2?[1,-1]:[p%2?1:-1],G=m.forca*(.85+.3*Me(t,p));for(let te of ye)o.push(a[0]-y*n*te,a[1]+L*n*te,m.raio,i[0]*G,i[1]*G,i[2]*G)}}return Float32Array.from(o)}var W=e=>Math.min(1,Math.max(.04,Math.sqrt(e/3e3)));function Te(e){let o=(e%24+24)%24;return o>=17&&o<20?.3+.7*((o-17)/3):o>=20&&o<23?1-.3*((o-20)/3):o>=23||o<5?.45:o<7?.45+.1*((o-5)/2):.3}var Be=`
attribute vec3 aPoste;
attribute vec3 aCor;
uniform vec4 uMapa;
varying vec2 vQ;
varying vec3 vCor;
void main(){
vQ=position.xy * 3.0;
vCor=aCor;
vec2 xz=aPoste.xy + position.xy * aPoste.z * 3.0;
vec2 uv=(xz - uMapa.xy)* uMapa.z;
gl_Position=vec4(uv * 2.0 - 1.0,0.0,1.0);
}
`,$e=`
uniform float uGanho;
varying vec2 vQ;
varying vec3 vCor;
void main(){
gl_FragColor=vec4(vCor *(exp(- 0.5 * dot(vQ,vQ))/ uGanho),1.0);
}
`,C=2.2,H=class{constructor(o){this.ctx=o;let a=o.sim?.espelho?.mapa?.tam??8192;this.origem=o.sim?.espelho?.mapa?.origem??[-a/2,-a/2],this.tam=a,this.N=1024,this.alvo=new w(this.N,this.N,{type:A,depthBuffer:!1,generateMipmaps:!1,minFilter:P,magFilter:P}),this.alvo.texture.name="noite:luzRua";let r=new de;r.setAttribute("position",new B(new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]),3)),r.setIndex([0,1,2,0,2,3]),this.geo=r,this.mat=new U({name:"noite-postes",uniforms:{uMapa:{value:new x(this.origem[0],this.origem[1],1/a,0)},uGanho:{value:C}},vertexShader:Be,fragmentShader:$e,blending:ne,transparent:!0,depthTest:!1,depthWrite:!1}),this.malha=new $(r,this.mat),this.malha.frustumCulled=!1,this.cena=new I,this.cena.add(this.malha),this.cam=new j(-1,1,1,-1,0,1),this.postes=0,this.sujo=!0,this.vezes=0}desenhar(o,a){let r=this.ctx.sim?.espelho?.vias?.arestas,t=Ce(r),s=t.length/6;this.postes=s;let m=new Float32Array(s*3),n=new Float32Array(s*3);for(let i=0;i<s;i++)m.set([t[6*i],t[6*i+1],t[6*i+2]],3*i),n.set([t[6*i+3],t[6*i+4],t[6*i+5]],3*i);this.geo.getAttribute("aPoste")&&this.geo.dispose(),this.geo.setAttribute("aPoste",new V(m,3)),this.geo.setAttribute("aCor",new V(n,3)),this.geo.instanceCount=s;let c=o.getRenderTarget(),l=o.autoClear,f=o.getClearColor(new S),u=o.getClearAlpha();o.setRenderTarget(this.alvo),o.setClearColor(0,0),o.clear(!0,!1,!1),o.autoClear=!1;let g=()=>s&&o.render(this.cena,this.cam);a?a.passe(g):g(),o.autoClear=l,o.setClearColor(f,u),o.setRenderTarget(c),this.sujo=!1,this.vezes++}descartar(){this.alvo.dispose(),this.geo.dispose(),this.mat.dispose()}},Ve=(e,o,a)=>{let r=Math.min(1,Math.max(0,(a-e)/(o-e)));return r*r*(3-2*r)},ze=e=>1-Ve(-.06,.05,e),N=Object.freeze({alturaRua:9,alturaJanelas:9,janelas:[1,.7,.42],forcaJanelas:.35,rua:.5}),d=Object.freeze({lado:1024,amostras:11,passo:4,desvio:7,ganho:2});function we(e=d){let o=(e.amostras-1)/2,a=Array.from({length:e.amostras},(t,s)=>Math.exp(-.5*((s-o)*e.passo/e.desvio)**2)),r=a.reduce((t,s)=>t+s,0);return a.map(t=>t/r)}var Ue=`
uniform sampler2D uFonte;
uniform vec2 uPasso;
uniform float uGanho;
const float PESOS[ ${d.amostras} ]=float[](${we().map(e=>e.toFixed(6)).join(", ")});
void main(){
vec2 uv=gl_FragCoord.xy / ${d.lado}.0;
vec3 s=vec3(0.0);
for(int k=0;k < ${d.amostras};k ++)s +=texture(uFonte,uv + uPasso * float(k - ${(d.amostras-1)/2})).rgb * PESOS[ k ];
gl_FragColor=vec4(s * uGanho,1.0);
}
`,O=class{constructor(){let o={type:A,depthBuffer:!1,generateMipmaps:!1,minFilter:P,magFilter:P};this.a=new w(d.lado,d.lado,o),this.b=new w(d.lado,d.lado,o),this.a.texture.name="noite:luzChaoMeia",this.b.texture.name="noite:luzChao",this.mat=new U({name:"noite-suave",uniforms:{uFonte:{value:null},uPasso:{value:new z},uGanho:{value:1}},vertexShader:"void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }",fragmentShader:Ue,depthTest:!1,depthWrite:!1}),this.geo=new fe,this.geo.setAttribute("position",new B(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3));let a=new $(this.geo,this.mat);a.frustumCulled=!1,this.cena=new I,this.cena.add(a),this.cam=new j(-1,1,1,-1,0,1),this.versao=null,this.vezes=0}get textura(){return this.b.texture}refazer(o,a,r){let t=this.mat.uniforms,s=d.passo/r.tam,m=(l,f,u,g,i)=>{t.uFonte.value=f,t.uPasso.value.set(u,g),t.uGanho.value=i,o.setRenderTarget(l);let p=()=>o.render(this.cena,this.cam);a?a.passe(p):p()},n=o.getRenderTarget(),c=o.autoClear;o.autoClear=!1,m(this.a,r.textura,s,0,r.ganho/d.ganho),m(this.b,this.a.texture,0,s,1),o.autoClear=c,o.setRenderTarget(n),this.versao=r.versao,this.vezes++}descartar(){this.a.dispose(),this.b.dispose(),this.mat.dispose(),this.geo.dispose()}},Pe=e=>({textura:e.textura,origem:e.origem??[-4096,-4096],tam:e.tam??8192,ganho:e.ganho??C,versao:`r${e.versao??0}`});function je(e){let o=e.ganchos.uniformes,a=null,r=null,t=null,s=-1/0,m=-1/0,n=null,c=0,l=(u,g,i)=>{c<=0||(a?.sujo&&t?.textura===a.alvo.texture&&i-s>=2e3&&(s=i,a.desenhar(u,g),n=W(a.postes),t.versao=`s${a.vezes}`),t&&r&&r.versao!==t.versao&&i-m>=1e3&&(m=i,r.refazer(u,g,t)))};e.quadro?.antes?.add(l);let f=()=>r?.cena;return e.quadro?.aquecer?.add(f),{nome:"luzNoite",aplicar(u){a&&(u.tudo?.vias||u.arestas?.length)&&(a.sujo=!0)},quadro(u,g){let i=g.ambiente;c=ze(i?.ast?.sol?.elevacao??1),o.gNoiteParams.value.set(c,N.alturaRua,N.alturaJanelas,0);let p=Te(i?.hora??12)*N.forcaJanelas;o.gNoiteJanelas.value.set(N.janelas[0]*p,N.janelas[1]*p,N.janelas[2]*p);let v=g.luzRua;if(v?.textura)(t?.textura!==v.textura||t.versao!==`r${v.versao??0}`)&&(t=Pe(v)),Number.isFinite(v.brilho)&&(n=v.brilho),a&&(a.descartar(),a=null);else if(g.dominio?.("luzRua"))t=null;else{a??=new H(g);let R=`s${a.vezes}`;(t?.textura!==a.alvo.texture||t.versao!==R)&&(t={textura:a.alvo.texture,origem:a.origem,tam:a.tam,ganho:C,versao:R})}r??=new O,o.gLuzRuaMapa.value=r.textura,t?o.gLuzRuaParams.value.set(t.origem[0],t.origem[1],1/t.tam,d.ganho*N.rua):o.gLuzRuaParams.value.w=0,i&&Number.isFinite(n)&&Math.abs(i.brilhoCidade-n)>.02&&(i.brilhoCidade=n)},preparar(){let u=e.luzRua;return u?.textura?t=Pe(u):e.dominio?.("luzRua")||(a??=new H(e),a.desenhar(e.renderer,null),n=W(a.postes),e.ambiente&&(e.ambiente.brilhoCidade=n),t={textura:a.alvo.texture,origem:a.origem,tam:a.tam,ganho:C,versao:`s${a.vezes}`}),r??=new O,t&&r.refazer(e.renderer,null,t),{postes:a?.postes??null,brilho:n}},get postes(){return a?.postes??0},get estado(){return{fonte:t?t.textura===a?.alvo.texture?"substituto":"R3a":null,versao:t?.versao??null,suavizacoes:r?.vezes??0}},descartar(){e.quadro?.antes?.delete(l),e.quadro?.aquecer?.delete(f),a?.descartar(),a=null,r?.descartar(),r=null}}}function qe(e){e.registrarDominio("luzNoite",je)}var We=["camada","selecao","noite","neblina","mascara"],_e=()=>({uniformes:{},vertice:{pars:"",main:""},fragmento:{pars:"",sol:"",indireta:"",fim:""}}),Je={uniformes:{gSombraMapa:{value:null},gSombraMatriz:{value:new F},gSombraMatriz1:{value:new F},gSombraLigada:{value:0},gSombraCascatas:{value:1},gSombraTexel:{value:1/1024},gSombraVies:{value:6e-4},gSombraNormal:{value:.8},gSombraNormal1:{value:1.6},gSombraRaioPcf:{value:1.2},gSombraAmostras:{value:5},gSombraForca:{value:1},gNuvemMapa:{value:null},gNuvemParams:{value:new x(1/5200,0,.7,0)},gNuvemDesloc:{value:new x}},vertice:{pars:"",main:""},fragmento:{pars:he,sol:xe,indireta:"",fim:""}},Qe={uniformes:{gNeblinaBeta:{value:new E(15e-5,172e-6,22e-5)},gNeblinaQueda:{value:1/1200},gNeblinaLigada:{value:1},gNeblinaAnel:{value:Array.from({length:12},()=>new E(.62,.7,.8))},gNeblinaZenite:{value:new E(.3,.45,.7)},gNeblinaSolDir:{value:new E(0,1,0)},gNeblinaSolCor:{value:new E(0,0,0)},gNeblinaAmb:{value:new E(.1,.12,.15)},gNeblinaG:{value:.6},gNeblinaCor:{value:new S(.62,.7,.8)}},vertice:{pars:"",main:""},fragmento:{pars:Re,sol:"",indireta:"",fim:Se}};function He(e,o){let a=new ge(e,1,1,ue,o);return a.minFilter=a.magFilter=le,a.needsUpdate=!0,a}var Ze=He(new Float32Array([-1e4,-1e4,1,-1e4]),me),Ke=He(new Uint8Array([0,0,0,0]),A),K={gCampoMapa:{value:Ze},gCampoParams:{value:new x(-4096,-4096,1/8192,8)},gCampoLigado:{value:0}},Xe={uniformes:{...K,gCampoT:{value:0},gCampoVies:{value:new z(.8,1.2)}},vertice:{pars:"",main:""},fragmento:{pars:be,sol:"",indireta:"",fim:""}},Ye={uniformes:{...K,gHaoParams:{value:new x(.85,.3,.2,1)}},vertice:{pars:"",main:""},fragmento:{pars:Ee,sol:"",indireta:Ne,fim:""}},ea={uniformes:{...K,gLuzRuaMapa:{value:Ke},gLuzRuaParams:{value:new x(-4096,-4096,1/8192,2)},gNoiteParams:{value:new x(0,9,9,0)},gNoiteJanelas:{value:new E}},vertice:{pars:"",main:""},fragmento:{pars:J,sol:"",indireta:Q,fim:""}},h=new Map(M.map(e=>[e,_e()]));h.set("sombra",Je);h.set("neblina",Qe);h.set("sombraLonge",Xe);h.set("hao",Ye);h.set("noite",ea);var X={};for(let e of h.values())Object.assign(X,e.uniformes);var Z=new Set,Y=1;function aa(e={}){let o=_e();return{uniformes:{...e.uniformes||{}},vertice:{...o.vertice,...e.vertice||{}},fragmento:{...o.fragmento,...e.fragmento||{}}}}function Oe(e){let o=M.filter(s=>e.includes(s)),a=s=>h.get(s),r=s=>o.map(m=>`#ifdef G_${m.toUpperCase()}
${s(a(m))}
#endif`).join(`
`),t=We.filter(s=>o.includes(s)).map(s=>`#ifdef G_${s.toUpperCase()}
${a(s).fragmento.fim}
#endif`).join(`
`);return{defines:Object.fromEntries(o.map(s=>[`G_${s.toUpperCase()}`,""])),verticePars:`varying vec3 vGPosMundo;
`+r(s=>s.vertice.pars),verticeMain:`
vec4 gPosM=vec4(transformed,1.0);
#ifdef USE_BATCHING
gPosM=batchingMatrix * gPosM;
#endif
#ifdef USE_INSTANCING
gPosM=instanceMatrix * gPosM;
#endif
vGPosMundo=(modelMatrix * gPosM).xyz;
`+r(s=>s.vertice.main),fragmentoPars:`varying vec3 vGPosMundo;
`+r(s=>s.fragmento.pars),sol:r(s=>s.fragmento.sol),indireta:r(s=>s.fragmento.indireta),fim:t}}function T(e,o,a,r){if(!e.includes(o))throw new Error(`ganchos: ${r} sem '${o}' (o three mudou?)`);return e.replace(o,a)}function oa(e,o=["sombra","neblina"]){let a=M.filter(s=>o.includes(s)),r=e.onBeforeCompile;e.onBeforeCompile=(s,m)=>{r?.call(e,s,m);let n=Oe(a);for(let f of a)Object.assign(s.uniforms,h.get(f).uniformes);s.defines={...s.defines||{},...n.defines};let c=s.vertexShader;c=T(c,"#include <common>",`#include <common>
${n.verticePars}`,"vértice"),c=T(c,"#include <fog_vertex>",`#include <fog_vertex>
${n.verticeMain}`,"vértice");let l=s.fragmentShader;if(l=T(l,"#include <common>",`#include <common>
${n.fragmentoPars}`,"fragmento"),l.includes("#include <lights_fragment_begin>")){let f=pe.lights_fragment_begin,u="getDirectionalLightInfo( directionalLight, directLight );";l=l.replace("#include <lights_fragment_begin>",T(f,u,`${u}
${n.sol}`,"luz"))}l.includes("#include <aomap_fragment>")&&(l=l.replace("#include <aomap_fragment>",`#include <aomap_fragment>
${n.indireta}`)),l=T(l,"#include <tonemapping_fragment>",`${n.fim}
#include <tonemapping_fragment>`,"fragmento"),s.vertexShader=c,s.fragmentShader=l};let t=e.customProgramCacheKey?.bind(e);return e.customProgramCacheKey=()=>`${t?t():""}|g${Y}:${a.join(",")}`,e.userData.ganchos=a,Z.add(e),e.addEventListener("dispose",()=>Z.delete(e)),e.needsUpdate=!0,e}function ta(e,o){if(!h.has(e))throw new Error(`gancho fora do contrato: ${e} (${M.join(", ")})`);let a=aa(o);h.set(e,a),Object.assign(X,a.uniformes),Y++;for(let r of Z)r.needsUpdate=!0}var ra=e=>h.get(e)??null,sa=()=>[...M],ee={definir:ta,obter:ra,aplicar:oa,trechos:Oe,uniformes:X,nomes:sa,get versao(){return Y}};var ae=Object.freeze(["sombra","sombraLonge","hao","camada","noite","selecao","mascara","neblina"]),Le=Object.freeze({asfaltoNovo:{cor:[.05,.05,.052],rug:.85},asfaltoGasto:{cor:[.12,.118,.112],rug:.72},concreto:{cor:[.35,.34,.32],rug:.8},pinturaClara:{cor:[.64,.62,.57],rug:.7},grama:{cor:[.1,.12,.06],rug:.9},capimSeco:{cor:[.3,.27,.18],rug:.9},terraRoxa:{cor:[.2,.11,.08],rug:.95},terraClara:{cor:[.26,.22,.17],rug:.95},areia:{cor:[.44,.4,.32],rug:.9},granito:{cor:[.28,.27,.26],rug:.7},telha:{cor:[.36,.2,.13],rug:.75},folhagem:{cor:[.06,.09,.04],rug:.6},vidro:{cor:[.03,.035,.04],rug:.08,metal:0},bronze:{cor:[.4,.28,.18],rug:.35,metal:1},aluminio:{cor:[.9,.9,.91],rug:.3,metal:1}}),ia=.8;function na({superficie:e=null,...o}={},{ganchos:a=ae}={}){let r=e?Le[e]:null;if(e&&!r)throw new Error(`superfície desconhecida: ${e}`);let t=new ve({...r?{color:new S().setRGB(...r.cor,ce),roughness:r.rug,metalness:r.metal??0}:{},...o});return ee.aplicar(t,a)}function la(e,o=ae){return ee.aplicar(e,o)}var ma=e=>.2126*e[0]+.7152*e[1]+.0722*e[2];function ua(){}export{b as a,fa as b,De as c,ga as d,Fe as e,W as f,ke as g,ee as h,ae as i,na as j,ca as k};
