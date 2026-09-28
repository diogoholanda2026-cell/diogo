import{b as ia,c as na}from"./parte.20260928135559.BZEIYXD4.js";import{a as I}from"./parte.20260928135559.GKPSFE4K.js";import{h as p}from"./parte.20260928135559.EZFLCZJ3.js";import{$a as va,C as ua,Fa as ga,Ia as V,Ja as da,Ka as U,Za as j,aa as fa,eb as q,f as la,fa as z,gb as pa,ha as R,ib as ha,la as b,ma as O,p as ma,qa as F,r as P,u as A,va as S,wa as B,x as ca,za as $}from"./parte.20260928135559.THY55TK2.js";import{a as sa}from"./parte.20260928135559.3MU2RXFU.js";var ge={};sa(ge,{ALBEDOS:()=>La,ALBEDO_MAXIMO:()=>le,GANCHOS_COMUNS:()=>oa,criarMaterial:()=>me,luminanciaAlbedo:()=>ue,prepararMaterial:()=>ce,registrar:()=>fe});var ve=p({quadro:"(tMs) lê o diário e desenha","camera.irPara":"(EstadoCamera parcial, ms) → Promise","camera.estado":"() → EstadoCamera","camera.definir":"(EstadoCamera)","entrada.modo":"('camera' | 'ferramenta')","entrada.aoFerramenta":"(fn({ fase: 'inicio' | 'move' | 'fim', x, y, ponto, dedos }))","entrada.opcoes":"({ deslocY: 56, bordaPx: 48 })",selecionar:"(xTela, yTela) → Selecao | null",projetar:"([x, y, z]) → { x, y, visivel, dist }",raio:"(xTela, yTela) → [x, y, z] | null (sobre alturaEm)",ancoras:"(lista) → posições de tela","camadas.mostrar":"({ fonte, dados, grade, cores, min, max, categorico })","camadas.ocultar":"()","ferramenta.via.previa":"(plano, 'normal' | 'invalido' | 'sugestao')","ferramenta.zona.mostrar":"(bool)","ferramenta.zona.celulas":"(Int32Array, zona)","ferramenta.pincel":"({ x, z, raio })","ferramenta.ladrilhos":"(bool)","ferramenta.fantasma":"({ tipo, x, z, rot, alcance, ok })","ferramenta.demolir":"(refs)","ferramenta.limpar":"()","marcadores.atlas":"(canvas, mapa)","marcadores.definir":"([{ idx, glifo, gravidade, prioridade }])",selecionado:"({ tipo: 'predio' | 'colocavel' | 'aresta' | 'arcologia', ref } | ref | null) (só a ref vale como prédio)","tempo.forcar":"({ fase } | null)",sempreDia:"(bool)",estado:"('livre' | 'coberto' | 'foto' | 'teste')",qualidade:"(id)",perfil:"() → { id, sugerido, capac }",stats:"StatsRender (propriedade)",bancada:"() → Promise<{ perfil, sugerido, msMedio, p95, qps, calls, tris, pior, gpuMs, familias, programas: [{ nome, amostradores: { v, f }, varyings, uniformesF, atributos, msCompilar }], capac }>",capa:"(640, 288) → Promise<Blob>",foto:"({ w, h }) → Promise<Blob>",voo:"(alvo) → Promise"}),pe=p(["registrarTextura(nome, gerador)","registrarGeradorOficina(tipo, modulo)","registrarSelecionavel(dominio, fn)","registrarDominio(nome, modulo)","registrarCena(nome, modulo)","ganchos.definir(nome, glsl)"]),M=p(["neblina","sombra","sombraLonge","hao","camada","noite","selecao","mascara"]),he=p(["setor","anexo","vias","arvores","fora","colocavel","alturasCidade"]),xe=p({pedido:"{ id, tipo, chave, dados }",resposta:"{ id, chave, malhas: [{ material, atributos /* quantizados: posição Int16, normal 2 x Int8, uv Half, aId Uint32, AO Uint8 */, indices }] } | { id, chave, grade: Float32Array } (alturasCidade)"}),be=p(["ultra","alta","media","leve"]),Da=p(["terreno","predios","colocaveis","arvores","vias","vida","arcologia","sombra","resto"]),Ee=p({ultra:{calls:1500,tris:5e6},alta:{calls:1500,tris:5e6},media:{calls:300,tris:9e5,alvoTris:62e4,geometriaMB:64,familias:{terreno:{calls:[1,2],alvo:1e5,teto:12e4},predios:{calls:[16,28],alvo:21e4,teto:24e4},colocaveis:{calls:[4,8],alvo:25e3,teto:4e4},arvores:{calls:[10,13],alvo:8e4,teto:11e4},vias:{calls:[15,25],alvo:7e4,teto:9e4},vida:{calls:[8,10],alvo:25e3,teto:4e4},arcologia:{calls:[10,15],alvo:25e3,teto:6e4,nota:"40 mil em LOD1 e até 20 mil do LOD0 da Torre de perto"},sombra:{calls:[8,15],alvo:4e4,teto:6e4,nota:"callsSombra e trisSombra"},resto:{calls:[23,28],alvo:39e3,teto:85e3,nota:"água 20 mil, props 30 mil, obras 15 mil, marcadores 20 mil; chamadas com céu e pós"}}},leve:{calls:200,tris:5e5}}),Re=p({amostradoresPorEstagio:12,varyings:12,uniformesF:200,atributos:14}),Ne=p({aberta:"R1a",horizonte:"R1a",noite:"R1a",estresse:"R1a","prova-sombra":"F0 (R1a herda)",costa:"R2a",materiais:"R2a",rua:"R3a",bairro:"R4a",obra:"R4b",servicos:"R5",torre:"X1a",planos:"X1a",ferramentas:"X2",camadas:"X3a"});function Se(){return{calls:0,tris:0,callsSombra:0,trisSombra:0,passes:0,ms:0,qps:0,p95:0,gpuMs:0,pr:1,msaa:0,perfil:"media",familias:Object.fromEntries(Da.map(a=>[a,0])),pxPorTri:0,pior:{calls:0,tris:0,ms:0},setores:{lod0:0,anexos:0,fila:0,msEnvio:0},instancias:{predios:0,arvores:0,carros:0,pessoas:0,marcadores:0},memoria:{geometriaMB:0,texturasMB:0,programas:0},capac:{clipControl:!1,multiDraw:!1,timer:!1,limites:{}}}}var Ia=`
#ifndef G_NORMAL_MUNDO
#if defined( STANDARD ) || defined( PHYSICAL ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON )
#define G_NORMAL_MUNDO inverseTransformDirection( geometryNormal, viewMatrix )
#define G_ILUMINADO
#else
#define G_NORMAL_MUNDO normalize( cross( dFdx( vGPosMundo ), dFdy( vGPosMundo ) ) )
#endif
#endif
`,_=`
${Ia}
#ifndef G_CAMPO_PARS
#define G_CAMPO_PARS
uniform sampler2D gCampoMapa;
uniform vec4 gCampoParams;
uniform float gCampoLigado;
vec4 gCampo(vec2 xz){return texture(gCampoMapa,(xz - gCampoParams.xy)* gCampoParams.z);}
#endif
`,xa=`
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
`,ba=`
{
vec3 gSN=inverseTransformDirection(geometryNormal,viewMatrix);
float gSW=0.0;
float gSL=gSombraPerto(gSN,gSW);
#ifdef G_SOMBRALONGE
gSL=mix(gSombraLonge(gSN),gSL,gSW);
#endif
directLight.color *=mix(1.0,gSL,gSombraForca)* gNuvemSombra();
}
`,Ea=`
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
`,Ra=`
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
`,Na=`
{
float gAo=gHao(G_NORMAL_MUNDO);
reflectedLight.indirectDiffuse *=gAo;
reflectedLight.indirectSpecular *=mix(1.0,gAo,0.6);
reflectedLight.directDiffuse *=mix(1.0,gAo,gHaoParams.z);
}
`,E=Object.freeze({passos:48,primeiro:4,ultimo:48});function Pe(a){let o=0;for(let e=0;e<a;e++){let r=e/(E.passos-1);o+=E.primeiro+(E.ultimo-E.primeiro)*r*r}return o}var Fa=2,Ae=`
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
for(int k=0;k < ${E.passos};k ++){
float f=float(k)/ ${E.passos-1}.0;
float p=${E.primeiro}.0 + ${E.ultimo-E.primeiro}.0 * f * f;
t +=p;
vec2 q=uv + duv * t;
if(q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0)break;
float tm=t - 0.5 * p;
vec2 m=uv + duv * tm;
float hq=gH(q);
float hm=gH(m);
if(p > ${Fa}.0 * uPassoM){
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
`;var Ba=`
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
`,Sa=`
uniform vec3 gNeblinaBeta;
uniform float gNeblinaQueda;
uniform float gNeblinaLigada;
uniform vec3 gNeblinaSolCor;
uniform vec3 gNeblinaAmb;
uniform float gNeblinaG;
${Ba}
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
`,Ma="gl_FragColor.rgb = gNeblina( gl_FragColor.rgb );";var Ja={};sa(Ja,{GANHO_RUA:()=>C,LUZES:()=>k,NOITE_INDIRETA:()=>Z,NOITE_LUZ:()=>N,NOITE_PARS:()=>Q,POSTES:()=>W,SUAVE:()=>v,brilhoDosPostes:()=>J,forcaJanelas:()=>za,forcaNoite:()=>Oa,pesosSuaves:()=>_a,postesDasVias:()=>Ta,registrar:()=>Wa});var Q=`
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
`,Z=`
#ifdef G_ILUMINADO
#ifdef EDIFICIO
reflectedLight.indirectDiffuse +=gNoiteLuz(G_NORMAL_MUNDO,1.0)* BRDF_Lambert(material.diffuseColor);
#else
reflectedLight.indirectDiffuse +=gNoiteLuz(G_NORMAL_MUNDO,0.0)* BRDF_Lambert(material.diffuseColor);
#endif
#endif
`,k=Object.freeze({sodio:[1,.48,.14],led:[1,.84,.64]}),W=Object.freeze({rua:{passo:28,lados:1,forca:1.1,raio:6,led:.3},ruaMao:{passo:28,lados:1,forca:1.1,raio:6,led:.3},avenida:{passo:32,lados:2,forca:1.3,raio:7,led:.5},avenidaG:{passo:32,lados:2,forca:1.45,raio:8,led:.6},rodovia:{passo:60,lados:1,forca:.8,raio:8,led:1},terra:{passo:44,lados:1,forca:.7,raio:6,led:0}}),$a=3.5,Pa=(a,o)=>{let e=Math.imul(a^2654435769,2246822507)^Math.imul(o+1663821227,3266489909);return e^=e>>>15,e=Math.imul(e,739982445),((e^e>>>12)>>>0)/4294967296};function Ta(a){let o=[];if(!a)return new Float32Array(0);let e=[0,0],r=[0,0];for(let t=0;t<a.n;t++){if(!a.viva[t])continue;let s=na[a.tipo[t]]??"rua",c=W[s]??W.rua,i=Math.max(1,(ia[s]?.largura??16)/2-$a),g=a.comp[t]||1,n=Math.max(1,Math.round(g/c.passo)),l=a.corte?a.corte[2*t]:0,u=a.corte?a.corte[2*t+1]:1,m=Pa(t,7)<c.led?k.led:k.sodio;for(let d=0;d<n;d++){let x=l+(u-l)*(d+.5)/n;I(a.p,x,e,8*t);let H=x+.001<=1?x+.001:x-.001;I(a.p,H,r,8*t);let L=(r[0]-e[0])*(H>x?1:-1),G=(r[1]-e[1])*(H>x?1:-1),ta=Math.hypot(L,G)||1;L/=ta,G/=ta;let Ga=c.lados===2?[1,-1]:[d%2?1:-1],D=c.forca*(.85+.3*Pa(t,d));for(let ra of Ga)o.push(e[0]-G*i*ra,e[1]+L*i*ra,c.raio,m[0]*D,m[1]*D,m[2]*D)}}return Float32Array.from(o)}var J=a=>Math.min(1,Math.max(.04,Math.sqrt(a/3e3)));function za(a){let o=(a%24+24)%24;return o>=17&&o<20?.3+.7*((o-17)/3):o>=20&&o<23?1-.3*((o-20)/3):o>=23||o<5?.45:o<7?.45+.1*((o-5)/2):.3}var Va=`
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
`,Ua=`
uniform float uGanho;
varying vec2 vQ;
varying vec3 vCor;
void main(){
gl_FragColor=vec4(vCor *(exp(- 0.5 * dot(vQ,vQ))/ uGanho),1.0);
}
`,C=2.2,w=class{constructor(o){this.ctx=o;let e=o.sim?.espelho?.mapa?.tam??8192;this.origem=o.sim?.espelho?.mapa?.origem??[-e/2,-e/2],this.tam=e,this.N=1024,this.alvo=new O(this.N,this.N,{type:A,depthBuffer:!1,generateMipmaps:!1,minFilter:P,magFilter:P}),this.alvo.texture.name="noite:luzRua";let r=new pa;r.setAttribute("position",new $(new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]),3)),r.setIndex([0,1,2,0,2,3]),this.geo=r,this.mat=new j({name:"noite-postes",uniforms:{uMapa:{value:new b(this.origem[0],this.origem[1],1/e,0)},uGanho:{value:C}},vertexShader:Va,fragmentShader:Ua,blending:la,transparent:!0,depthTest:!1,depthWrite:!1}),this.malha=new V(r,this.mat),this.malha.frustumCulled=!1,this.cena=new B,this.cena.add(this.malha),this.cam=new q(-1,1,1,-1,0,1),this.postes=0,this.sujo=!0,this.vezes=0}desenhar(o,e){let r=this.ctx.sim?.espelho?.vias?.arestas,t=Ta(r),s=t.length/6;this.postes=s;let c=new Float32Array(s*3),i=new Float32Array(s*3);for(let m=0;m<s;m++)c.set([t[6*m],t[6*m+1],t[6*m+2]],3*m),i.set([t[6*m+3],t[6*m+4],t[6*m+5]],3*m);this.geo.getAttribute("aPoste")&&this.geo.dispose(),this.geo.setAttribute("aPoste",new U(c,3)),this.geo.setAttribute("aCor",new U(i,3)),this.geo.instanceCount=s;let g=o.getRenderTarget(),n=o.autoClear,l=o.getClearColor(new S),u=o.getClearAlpha();o.setRenderTarget(this.alvo),o.setClearColor(0,0),o.clear(!0,!1,!1),o.autoClear=!1;let f=()=>s&&o.render(this.cena,this.cam);e?e.passe(f):f(),o.autoClear=n,o.setClearColor(l,u),o.setRenderTarget(g),this.sujo=!1,this.vezes++}descartar(){this.alvo.dispose(),this.geo.dispose(),this.mat.dispose()}},ja=(a,o,e)=>{let r=Math.min(1,Math.max(0,(e-a)/(o-a)));return r*r*(3-2*r)},Oa=a=>1-ja(-.06,.05,a),N=Object.freeze({alturaRua:9,alturaJanelas:9,janelas:[1,.7,.42],forcaJanelas:.35,rua:.5}),v=Object.freeze({lado:1024,amostras:11,passo:4,desvio:7,ganho:2});function _a(a=v){let o=(a.amostras-1)/2,e=Array.from({length:a.amostras},(t,s)=>Math.exp(-.5*((s-o)*a.passo/a.desvio)**2)),r=e.reduce((t,s)=>t+s,0);return e.map(t=>t/r)}var qa=`
uniform sampler2D uFonte;
uniform vec2 uPasso;
uniform float uGanho;
const float PESOS[ ${v.amostras} ]=float[](${_a().map(a=>a.toFixed(6)).join(", ")});
void main(){
vec2 uv=gl_FragCoord.xy / ${v.lado}.0;
vec3 s=vec3(0.0);
for(int k=0;k < ${v.amostras};k ++)s +=texture(uFonte,uv + uPasso * float(k - ${(v.amostras-1)/2})).rgb * PESOS[ k ];
gl_FragColor=vec4(s * uGanho,1.0);
}
`,y=class{constructor(){let o={type:A,depthBuffer:!1,generateMipmaps:!1,minFilter:P,magFilter:P};this.a=new O(v.lado,v.lado,o),this.b=new O(v.lado,v.lado,o),this.a.texture.name="noite:luzChaoMeia",this.b.texture.name="noite:luzChao",this.mat=new j({name:"noite-suave",uniforms:{uFonte:{value:null},uPasso:{value:new z},uGanho:{value:1}},vertexShader:"void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }",fragmentShader:qa,depthTest:!1,depthWrite:!1}),this.geo=new ga,this.geo.setAttribute("position",new $(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3));let e=new V(this.geo,this.mat);e.frustumCulled=!1,this.cena=new B,this.cena.add(e),this.cam=new q(-1,1,1,-1,0,1),this.versao=null,this.vezes=0}get textura(){return this.b.texture}refazer(o,e,r){let t=this.mat.uniforms,s=v.passo/r.tam,c=(n,l,u,f,m)=>{t.uFonte.value=l,t.uPasso.value.set(u,f),t.uGanho.value=m,o.setRenderTarget(n);let d=()=>o.render(this.cena,this.cam);e?e.passe(d):d()},i=o.getRenderTarget(),g=o.autoClear;o.autoClear=!1,c(this.a,r.textura,s,0,r.ganho/v.ganho),c(this.b,this.a.texture,0,s,1),o.autoClear=g,o.setRenderTarget(i),this.versao=r.versao,this.vezes++}descartar(){this.a.dispose(),this.b.dispose(),this.mat.dispose(),this.geo.dispose()}},Aa=a=>({textura:a.textura,origem:a.origem??[-4096,-4096],tam:a.tam??8192,ganho:a.ganho??C,versao:`r${a.versao??0}`});function ka(a){let o=a.ganchos.uniformes,e=null,r=null,t=null,s=-1/0,c=-1/0,i=null,g=0,n=(l,u,f)=>{g<=0||(e?.sujo&&t?.textura===e.alvo.texture&&f-s>=2e3&&(s=f,e.desenhar(l,u),i=J(e.postes),t.versao=`s${e.vezes}`),t&&r&&r.versao!==t.versao&&f-c>=1e3&&(c=f,r.refazer(l,u,t)))};return a.quadro?.antes?.add(n),{nome:"luzNoite",aplicar(l){e&&(l.tudo?.vias||l.arestas?.length)&&(e.sujo=!0)},quadro(l,u){let f=u.ambiente;g=Oa(f?.ast?.sol?.elevacao??1),o.gNoiteParams.value.set(g,N.alturaRua,N.alturaJanelas,0);let m=za(f?.hora??12)*N.forcaJanelas;o.gNoiteJanelas.value.set(N.janelas[0]*m,N.janelas[1]*m,N.janelas[2]*m);let d=u.luzRua;if(d?.textura)(t?.textura!==d.textura||t.versao!==`r${d.versao??0}`)&&(t=Aa(d)),Number.isFinite(d.brilho)&&(i=d.brilho),e&&(e.descartar(),e=null);else if(u.dominio?.("luzRua"))t=null;else{e??=new w(u);let x=`s${e.vezes}`;(t?.textura!==e.alvo.texture||t.versao!==x)&&(t={textura:e.alvo.texture,origem:e.origem,tam:e.tam,ganho:C,versao:x})}r??=new y,o.gLuzRuaMapa.value=r.textura,t?o.gLuzRuaParams.value.set(t.origem[0],t.origem[1],1/t.tam,v.ganho*N.rua):o.gLuzRuaParams.value.w=0,f&&Number.isFinite(i)&&Math.abs(f.brilhoCidade-i)>.02&&(f.brilhoCidade=i)},preparar(){let l=a.luzRua;return l?.textura?t=Aa(l):a.dominio?.("luzRua")||(e??=new w(a),e.desenhar(a.renderer,null),i=J(e.postes),a.ambiente&&(a.ambiente.brilhoCidade=i),t={textura:e.alvo.texture,origem:e.origem,tam:e.tam,ganho:C,versao:`s${e.vezes}`}),r??=new y,t&&r.refazer(a.renderer,null,t),{postes:e?.postes??null,brilho:i}},get postes(){return e?.postes??0},get estado(){return{fonte:t?t.textura===e?.alvo.texture?"substituto":"R3a":null,versao:t?.versao??null,suavizacoes:r?.vezes??0}},descartar(){a.quadro?.antes?.delete(n),e?.descartar(),e=null,r?.descartar(),r=null}}}function Wa(a){a.registrarDominio("luzNoite",ka)}var Qa=["camada","selecao","noite","neblina","mascara"],wa=()=>({uniformes:{},vertice:{pars:"",main:""},fragmento:{pars:"",sol:"",indireta:"",fim:""}}),Za={uniformes:{gSombraMapa:{value:null},gSombraMatriz:{value:new F},gSombraMatriz1:{value:new F},gSombraLigada:{value:0},gSombraCascatas:{value:1},gSombraTexel:{value:1/1024},gSombraVies:{value:6e-4},gSombraNormal:{value:.8},gSombraNormal1:{value:1.6},gSombraRaioPcf:{value:1.2},gSombraAmostras:{value:5},gSombraForca:{value:1},gNuvemMapa:{value:null},gNuvemParams:{value:new b(1/5200,0,.7,0)},gNuvemDesloc:{value:new b}},vertice:{pars:"",main:""},fragmento:{pars:xa,sol:ba,indireta:"",fim:""}},Xa={uniformes:{gNeblinaBeta:{value:new R(15e-5,172e-6,22e-5)},gNeblinaQueda:{value:1/1200},gNeblinaLigada:{value:1},gNeblinaAnel:{value:Array.from({length:12},()=>new R(.62,.7,.8))},gNeblinaZenite:{value:new R(.3,.45,.7)},gNeblinaSolDir:{value:new R(0,1,0)},gNeblinaSolCor:{value:new R(0,0,0)},gNeblinaAmb:{value:new R(.1,.12,.15)},gNeblinaG:{value:.6},gNeblinaCor:{value:new S(.62,.7,.8)}},vertice:{pars:"",main:""},fragmento:{pars:Sa,sol:"",indireta:"",fim:Ma}};function ya(a,o){let e=new da(a,1,1,ua,o);return e.minFilter=e.magFilter=ma,e.needsUpdate=!0,e}var Ka=ya(new Float32Array([-1e4,-1e4,1,-1e4]),ca),Ya=ya(new Uint8Array([0,0,0,0]),A),K={gCampoMapa:{value:Ka},gCampoParams:{value:new b(-4096,-4096,1/8192,8)},gCampoLigado:{value:0}},ae={uniformes:{...K,gCampoT:{value:0},gCampoVies:{value:new z(.8,1.2)}},vertice:{pars:"",main:""},fragmento:{pars:Ea,sol:"",indireta:"",fim:""}},ee={uniformes:{...K,gHaoParams:{value:new b(.85,.3,.2,1)}},vertice:{pars:"",main:""},fragmento:{pars:Ra,sol:"",indireta:Na,fim:""}},oe={uniformes:{...K,gLuzRuaMapa:{value:Ya},gLuzRuaParams:{value:new b(-4096,-4096,1/8192,2)},gNoiteParams:{value:new b(0,9,9,0)},gNoiteJanelas:{value:new R}},vertice:{pars:"",main:""},fragmento:{pars:Q,sol:"",indireta:Z,fim:""}},h=new Map(M.map(a=>[a,wa()]));h.set("sombra",Za);h.set("neblina",Xa);h.set("sombraLonge",ae);h.set("hao",ee);h.set("noite",oe);var Y={};for(let a of h.values())Object.assign(Y,a.uniformes);var X=new Set,aa=1;function te(a={}){let o=wa();return{uniformes:{...a.uniformes||{}},vertice:{...o.vertice,...a.vertice||{}},fragmento:{...o.fragmento,...a.fragmento||{}}}}function Ha(a){let o=M.filter(s=>a.includes(s)),e=s=>h.get(s),r=s=>o.map(c=>`#ifdef G_${c.toUpperCase()}
${s(e(c))}
#endif`).join(`
`),t=Qa.filter(s=>o.includes(s)).map(s=>`#ifdef G_${s.toUpperCase()}
${e(s).fragmento.fim}
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
`+r(s=>s.fragmento.pars),sol:r(s=>s.fragmento.sol),indireta:r(s=>s.fragmento.indireta),fim:t}}function T(a,o,e,r){if(!a.includes(o))throw new Error(`ganchos: ${r} sem '${o}' (o three mudou?)`);return a.replace(o,e)}function re(a,o=["sombra","neblina"]){let e=M.filter(s=>o.includes(s)),r=a.onBeforeCompile;a.onBeforeCompile=(s,c)=>{r?.call(a,s,c);let i=Ha(e);for(let l of e)Object.assign(s.uniforms,h.get(l).uniformes);s.defines={...s.defines||{},...i.defines};let g=s.vertexShader;g=T(g,"#include <common>",`#include <common>
${i.verticePars}`,"vértice"),g=T(g,"#include <fog_vertex>",`#include <fog_vertex>
${i.verticeMain}`,"vértice");let n=s.fragmentShader;if(n=T(n,"#include <common>",`#include <common>
${i.fragmentoPars}`,"fragmento"),n.includes("#include <lights_fragment_begin>")){let l=ha.lights_fragment_begin,u="getDirectionalLightInfo( directionalLight, directLight );";n=n.replace("#include <lights_fragment_begin>",T(l,u,`${u}
${i.sol}`,"luz"))}n.includes("#include <aomap_fragment>")&&(n=n.replace("#include <aomap_fragment>",`#include <aomap_fragment>
${i.indireta}`)),n=T(n,"#include <tonemapping_fragment>",`${i.fim}
#include <tonemapping_fragment>`,"fragmento"),s.vertexShader=g,s.fragmentShader=n};let t=a.customProgramCacheKey?.bind(a);return a.customProgramCacheKey=()=>`${t?t():""}|g${aa}:${e.join(",")}`,a.userData.ganchos=e,X.add(a),a.addEventListener("dispose",()=>X.delete(a)),a.needsUpdate=!0,a}function se(a,o){if(!h.has(a))throw new Error(`gancho fora do contrato: ${a} (${M.join(", ")})`);let e=te(o);h.set(a,e),Object.assign(Y,e.uniformes),aa++;for(let r of X)r.needsUpdate=!0}var ie=a=>h.get(a)??null,ne=()=>[...M],ea={definir:se,obter:ie,aplicar:re,trechos:Ha,uniformes:Y,nomes:ne,get versao(){return aa}};var oa=Object.freeze(["sombra","sombraLonge","hao","camada","noite","selecao","mascara","neblina"]),La=Object.freeze({asfaltoNovo:{cor:[.05,.05,.052],rug:.85},asfaltoGasto:{cor:[.12,.118,.112],rug:.72},concreto:{cor:[.35,.34,.32],rug:.8},pinturaClara:{cor:[.64,.62,.57],rug:.7},grama:{cor:[.1,.12,.06],rug:.9},capimSeco:{cor:[.3,.27,.18],rug:.9},terraRoxa:{cor:[.2,.11,.08],rug:.95},terraClara:{cor:[.26,.22,.17],rug:.95},areia:{cor:[.44,.4,.32],rug:.9},granito:{cor:[.28,.27,.26],rug:.7},telha:{cor:[.36,.2,.13],rug:.75},folhagem:{cor:[.06,.09,.04],rug:.6},vidro:{cor:[.03,.035,.04],rug:.08,metal:0},bronze:{cor:[.4,.28,.18],rug:.35,metal:1},aluminio:{cor:[.9,.9,.91],rug:.3,metal:1}}),le=.8;function me({superficie:a=null,...o}={},{ganchos:e=oa}={}){let r=a?La[a]:null;if(a&&!r)throw new Error(`superfície desconhecida: ${a}`);let t=new va({...r?{color:new S().setRGB(...r.cor,fa),roughness:r.rug,metalness:r.metal??0}:{},...o});return ea.aplicar(t,e)}function ce(a,o=oa){return ea.aplicar(a,o)}var ue=a=>.2126*a[0]+.7152*a[1]+.0722*a[2];function fe(){}export{he as a,Da as b,Re as c,Se as d,E as e,Pe as f,Fa as g,Ae as h,Ba as i,J as j,Ja as k,ea as l,oa as m,me as n,ge as o};
