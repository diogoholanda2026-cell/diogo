import{b as oe,c as re}from"./parte.20261008091606.GD74T5CQ.js";import{a as T}from"./parte.20261008091606.E33SWFW3.js";import{a as y}from"./parte.20261008091606.4LUIVNTS.js";import{a as pe,b as ve,c as he,f as Ee,g as be,h as Re}from"./parte.20261008091606.UALP746T.js";import{$ as ue,B as le,Ea as ce,Ha as B,Ia as me,Ja as $,Xa as D,Za as ge,cb as V,e as ne,ea as P,eb as fe,ga as b,gb as de,ka as E,la as w,o as se,pa as G,q as M,t as C,ua as N,va as I,w as ie,ya as F}from"./parte.20261008091606.QU2MMYSS.js";import{a as te}from"./parte.20261008091606.7ULJH7AE.js";var la={};te(la,{ALBEDOS:()=>Oe,ALBEDO_MAXIMO:()=>oa,GANCHOS_COMUNS:()=>Y,criarMaterial:()=>ra,luminanciaAlbedo:()=>sa,prepararMaterial:()=>na,registrar:()=>ia});var ye=`
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
`,xe=`
uniform vec3 gNeblinaBeta;
uniform float gNeblinaQueda;
uniform float gNeblinaLigada;
uniform vec3 gNeblinaSolCor;
uniform vec3 gNeblinaAmb;
uniform float gNeblinaG;
${ye}
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
`,Ne="gl_FragColor.rgb = gNeblina( gl_FragColor.rgb );";var je={};te(je,{GANHO_RUA:()=>A,LUZES:()=>j,NOITE_INDIRETA:()=>W,NOITE_LUZ:()=>R,NOITE_PARS:()=>q,POSTES:()=>U,SUAVE:()=>p,brilhoDosPostes:()=>k,forcaJanelas:()=>ze,forcaNoite:()=>Pe,pesosSuaves:()=>we,postesDasVias:()=>Ae,registrar:()=>Ve});var q=`
${pe}
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
`,W=`
#ifdef G_ILUMINADO
#ifdef EDIFICIO
reflectedLight.indirectDiffuse +=gNoiteLuz(G_NORMAL_MUNDO,1.0)* BRDF_Lambert(material.diffuseColor);
#else
reflectedLight.indirectDiffuse +=gNoiteLuz(G_NORMAL_MUNDO,0.0)* BRDF_Lambert(material.diffuseColor);
#endif
#endif
`,j=Object.freeze({sodio:[1,.48,.14],led:[1,.84,.64]}),U=Object.freeze({rua:{passo:28,lados:1,forca:1.1,raio:6,led:.3},ruaMao:{passo:28,lados:1,forca:1.1,raio:6,led:.3},avenida:{passo:32,lados:2,forca:1.3,raio:7,led:.5},avenidaG:{passo:32,lados:2,forca:1.45,raio:8,led:.6},rodovia:{passo:60,lados:1,forca:.8,raio:8,led:1},terra:{passo:44,lados:1,forca:.7,raio:6,led:0}}),Ge=3.5,Te=(e,t)=>{let a=Math.imul(e^2654435769,2246822507)^Math.imul(t+1663821227,3266489909);return a^=a>>>15,a=Math.imul(a,739982445),((a^a>>>12)>>>0)/4294967296};function Ae(e){let t=[];if(!e)return new Float32Array(0);let a=[0,0],n=[0,0];for(let o=0;o<e.n;o++){if(!e.viva[o])continue;let r=re[e.tipo[o]]??"rua",u=U[r]??U.rua,i=Math.max(1,(oe[r]?.largura??16)/2-Ge),m=e.comp[o]||1,l=Math.max(1,Math.round(m/u.passo)),g=e.corte?e.corte[2*o]:0,c=e.corte?e.corte[2*o+1]:1,s=Te(o,7)<u.led?j.led:j.sodio;for(let v=0;v<l;v++){let d=g+(c-g)*(v+.5)/l;y(e.p,d,a,8*o);let x=d+.001<=1?d+.001:d-.001;y(e.p,x,n,8*o);let _=(n[0]-a[0])*(x>d?1:-1),O=(n[1]-a[1])*(x>d?1:-1),ee=Math.hypot(_,O)||1;_/=ee,O/=ee;let Le=u.lados===2?[1,-1]:[v%2?1:-1],L=u.forca*(.85+.3*Te(o,v));for(let ae of Le)t.push(a[0]-O*i*ae,a[1]+_*i*ae,u.raio,s[0]*L,s[1]*L,s[2]*L)}}return Float32Array.from(t)}var k=e=>Math.min(1,Math.max(.04,Math.sqrt(e/3e3)));function ze(e){let t=(e%24+24)%24;return t>=17&&t<20?.3+.7*((t-17)/3):t>=20&&t<23?1-.3*((t-20)/3):t>=23||t<5?.45:t<7?.45+.1*((t-5)/2):.3}var Ie=`
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
`,Fe=`
uniform float uGanho;
varying vec2 vQ;
varying vec3 vCor;
void main(){
gl_FragColor=vec4(vCor *(exp(- 0.5 * dot(vQ,vQ))/ uGanho),1.0);
}
`,A=2.2,S=class{constructor(t){this.ctx=t;let a=t.sim?.espelho?.mapa?.tam??8192;this.origem=t.sim?.espelho?.mapa?.origem??[-a/2,-a/2],this.tam=a,this.N=1024,this.alvo=new w(this.N,this.N,{type:C,depthBuffer:!1,generateMipmaps:!1,minFilter:M,magFilter:M}),this.alvo.texture.name="noite:luzRua";let n=new fe;n.setAttribute("position",new F(new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]),3)),n.setIndex([0,1,2,0,2,3]),this.geo=n,this.mat=new D({name:"noite-postes",uniforms:{uMapa:{value:new E(this.origem[0],this.origem[1],1/a,0)},uGanho:{value:A}},vertexShader:Ie,fragmentShader:Fe,blending:ne,transparent:!0,depthTest:!1,depthWrite:!1}),this.malha=new B(n,this.mat),this.malha.frustumCulled=!1,this.cena=new I,this.cena.add(this.malha),this.cam=new V(-1,1,1,-1,0,1),this.postes=0,this.sujo=!0,this.vezes=0}desenhar(t,a){let n=this.ctx.sim?.espelho?.vias?.arestas,o=Ae(n),r=o.length/6;this.postes=r;let u=new Float32Array(r*3),i=new Float32Array(r*3);for(let s=0;s<r;s++)u.set([o[6*s],o[6*s+1],o[6*s+2]],3*s),i.set([o[6*s+3],o[6*s+4],o[6*s+5]],3*s);this.geo.getAttribute("aPoste")&&this.geo.dispose(),this.geo.setAttribute("aPoste",new $(u,3)),this.geo.setAttribute("aCor",new $(i,3)),this.geo.instanceCount=r;let m=t.getRenderTarget(),l=t.autoClear,g=t.getClearColor(new N),c=t.getClearAlpha();t.setRenderTarget(this.alvo),t.setClearColor(0,0),t.clear(!0,!1,!1),t.autoClear=!1;let f=()=>r&&t.render(this.cena,this.cam);a?a.passe(f):f(),t.autoClear=l,t.setClearColor(g,c),t.setRenderTarget(m),this.sujo=!1,this.vezes++}descartar(){this.alvo.dispose(),this.geo.dispose(),this.mat.dispose()}},Be=(e,t,a)=>{let n=Math.min(1,Math.max(0,(a-e)/(t-e)));return n*n*(3-2*n)},Pe=e=>1-Be(-.06,.05,e),R=Object.freeze({alturaRua:9,alturaJanelas:9,janelas:[1,.7,.42],forcaJanelas:.35,rua:.5}),p=Object.freeze({lado:1024,amostras:11,passo:4,desvio:7,ganho:2});function we(e=p){let t=(e.amostras-1)/2,a=Array.from({length:e.amostras},(o,r)=>Math.exp(-.5*((r-t)*e.passo/e.desvio)**2)),n=a.reduce((o,r)=>o+r,0);return a.map(o=>o/n)}var $e=`
uniform sampler2D uFonte;
uniform vec2 uPasso;
uniform float uGanho;
const float PESOS[ ${p.amostras} ]=float[](${we().map(e=>e.toFixed(6)).join(", ")});
void main(){
vec2 uv=gl_FragCoord.xy / ${p.lado}.0;
vec3 s=vec3(0.0);
for(int k=0;k < ${p.amostras};k ++)s +=texture(uFonte,uv + uPasso * float(k - ${(p.amostras-1)/2})).rgb * PESOS[ k ];
gl_FragColor=vec4(s * uGanho,1.0);
}
`,H=class{constructor(){let t={type:C,depthBuffer:!1,generateMipmaps:!1,minFilter:M,magFilter:M};this.a=new w(p.lado,p.lado,t),this.b=new w(p.lado,p.lado,t),this.a.texture.name="noite:luzChaoMeia",this.b.texture.name="noite:luzChao",this.mat=new D({name:"noite-suave",uniforms:{uFonte:{value:null},uPasso:{value:new P},uGanho:{value:1}},vertexShader:"void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }",fragmentShader:$e,depthTest:!1,depthWrite:!1}),this.geo=new ce,this.geo.setAttribute("position",new F(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3));let a=new B(this.geo,this.mat);a.frustumCulled=!1,this.cena=new I,this.cena.add(a),this.cam=new V(-1,1,1,-1,0,1),this.versao=null,this.vezes=0}get textura(){return this.b.texture}refazer(t,a,n){let o=this.mat.uniforms,r=p.passo/n.tam,u=(l,g,c,f,s)=>{o.uFonte.value=g,o.uPasso.value.set(c,f),o.uGanho.value=s,t.setRenderTarget(l);let v=()=>t.render(this.cena,this.cam);a?a.passe(v):v()},i=t.getRenderTarget(),m=t.autoClear;t.autoClear=!1,u(this.a,n.textura,r,0,n.ganho/p.ganho),u(this.b,this.a.texture,0,r,1),t.autoClear=m,t.setRenderTarget(i),this.versao=n.versao,this.vezes++}descartar(){this.a.dispose(),this.b.dispose(),this.mat.dispose(),this.geo.dispose()}},Me=e=>({textura:e.textura,origem:e.origem??[-4096,-4096],tam:e.tam??8192,ganho:e.ganho??A,versao:`r${e.versao??0}`});function De(e){let t=e.ganchos.uniformes,a=null,n=null,o=null,r=-1/0,u=-1/0,i=null,m=0,l=(c,f,s)=>{m<=0||(a?.sujo&&o?.textura===a.alvo.texture&&s-r>=2e3&&(r=s,a.desenhar(c,f),i=k(a.postes),o.versao=`s${a.vezes}`),o&&n&&n.versao!==o.versao&&s-u>=1e3&&(u=s,n.refazer(c,f,o)))};e.quadro?.antes?.add(l);let g=()=>n?.cena;return e.quadro?.aquecer?.add(g),{nome:"luzNoite",aplicar(c){a&&(c.tudo?.vias||c.arestas?.length)&&(a.sujo=!0)},quadro(c,f){let s=f.ambiente;m=Pe(s?.ast?.sol?.elevacao??1),t.gNoiteParams.value.set(m,R.alturaRua,R.alturaJanelas,0);let v=ze(s?.hora??12)*R.forcaJanelas;t.gNoiteJanelas.value.set(R.janelas[0]*v,R.janelas[1]*v,R.janelas[2]*v);let d=f.luzRua;if(d?.textura)(o?.textura!==d.textura||o.versao!==`r${d.versao??0}`)&&(o=Me(d)),Number.isFinite(d.brilho)&&(i=d.brilho),a&&(a.descartar(),a=null);else if(f.dominio?.("luzRua"))o=null;else{a??=new S(f);let x=`s${a.vezes}`;(o?.textura!==a.alvo.texture||o.versao!==x)&&(o={textura:a.alvo.texture,origem:a.origem,tam:a.tam,ganho:A,versao:x})}n??=new H,t.gLuzRuaMapa.value=n.textura,o?t.gLuzRuaParams.value.set(o.origem[0],o.origem[1],1/o.tam,p.ganho*R.rua):t.gLuzRuaParams.value.w=0,s&&Number.isFinite(i)&&Math.abs(s.brilhoCidade-i)>.02&&(s.brilhoCidade=i)},preparar(){let c=e.luzRua;return c?.textura?o=Me(c):e.dominio?.("luzRua")||(a??=new S(e),a.desenhar(e.renderer,null),i=k(a.postes),e.ambiente&&(e.ambiente.brilhoCidade=i),o={textura:a.alvo.texture,origem:a.origem,tam:a.tam,ganho:A,versao:`s${a.vezes}`}),n??=new H,o&&n.refazer(e.renderer,null,o),{postes:a?.postes??null,brilho:i}},get postes(){return a?.postes??0},get estado(){return{fonte:o?o.textura===a?.alvo.texture?"substituto":"R3a":null,versao:o?.versao??null,suavizacoes:n?.vezes??0}},descartar(){e.quadro?.antes?.delete(l),e.quadro?.aquecer?.delete(g),a?.descartar(),a=null,n?.descartar(),n=null}}}function Ve(e){e.registrarDominio("luzNoite",De)}var Ue=["camada","selecao","noite","neblina","mascara"],Se=()=>({uniformes:{},vertice:{pars:"",main:""},fragmento:{pars:"",sol:"",indireta:"",fim:""}}),ke={uniformes:{gSombraMapa:{value:null},gSombraMatriz:{value:new G},gSombraMatriz1:{value:new G},gSombraLigada:{value:0},gSombraCascatas:{value:1},gSombraTexel:{value:1/1024},gSombraVies:{value:6e-4},gSombraNormal:{value:.8},gSombraNormal1:{value:1.6},gSombraRaioPcf:{value:1.2},gSombraAmostras:{value:5},gSombraForca:{value:1},gNuvemMapa:{value:null},gNuvemParams:{value:new E(1/5200,0,.7,0)},gNuvemDesloc:{value:new E}},vertice:{pars:"",main:""},fragmento:{pars:ve,sol:he,indireta:"",fim:""}},qe={uniformes:{gNeblinaBeta:{value:new b(15e-5,172e-6,22e-5)},gNeblinaQueda:{value:1/1200},gNeblinaLigada:{value:1},gNeblinaAnel:{value:Array.from({length:12},()=>new b(.62,.7,.8))},gNeblinaZenite:{value:new b(.3,.45,.7)},gNeblinaSolDir:{value:new b(0,1,0)},gNeblinaSolCor:{value:new b(0,0,0)},gNeblinaAmb:{value:new b(.1,.12,.15)},gNeblinaG:{value:.6},gNeblinaCor:{value:new N(.62,.7,.8)}},vertice:{pars:"",main:""},fragmento:{pars:xe,sol:"",indireta:"",fim:Ne}};function He(e,t){let a=new me(e,1,1,le,t);return a.minFilter=a.magFilter=se,a.needsUpdate=!0,a}var We=He(new Float32Array([-1e4,-1e4,1,-1e4]),ie),Je=He(new Uint8Array([0,0,0,0]),C),Q={gCampoMapa:{value:We},gCampoParams:{value:new E(-4096,-4096,1/8192,8)},gCampoLigado:{value:0}},Qe={uniformes:{...Q,gCampoT:{value:0},gCampoVies:{value:new P(.8,1.2)}},vertice:{pars:"",main:""},fragmento:{pars:Ee,sol:"",indireta:"",fim:""}},Ze={uniformes:{...Q,gHaoParams:{value:new E(.85,.3,.2,1)}},vertice:{pars:"",main:""},fragmento:{pars:be,sol:"",indireta:Re,fim:""}},Ke={uniformes:{...Q,gLuzRuaMapa:{value:Je},gLuzRuaParams:{value:new E(-4096,-4096,1/8192,2)},gNoiteParams:{value:new E(0,9,9,0)},gNoiteJanelas:{value:new b}},vertice:{pars:"",main:""},fragmento:{pars:q,sol:"",indireta:W,fim:""}},h=new Map(T.map(e=>[e,Se()]));h.set("sombra",ke);h.set("neblina",qe);h.set("sombraLonge",Qe);h.set("hao",Ze);h.set("noite",Ke);var Z={};for(let e of h.values())Object.assign(Z,e.uniformes);var J=new Set,K=1;function Xe(e={}){let t=Se();return{uniformes:{...e.uniformes||{}},vertice:{...t.vertice,...e.vertice||{}},fragmento:{...t.fragmento,...e.fragmento||{}}}}function _e(e){let t=T.filter(r=>e.includes(r)),a=r=>h.get(r),n=r=>t.map(u=>`#ifdef G_${u.toUpperCase()}
${r(a(u))}
#endif`).join(`
`),o=Ue.filter(r=>t.includes(r)).map(r=>`#ifdef G_${r.toUpperCase()}
${a(r).fragmento.fim}
#endif`).join(`
`);return{defines:Object.fromEntries(t.map(r=>[`G_${r.toUpperCase()}`,""])),verticePars:`varying vec3 vGPosMundo;
`+n(r=>r.vertice.pars),verticeMain:`
vec4 gPosM=vec4(transformed,1.0);
#ifdef USE_BATCHING
gPosM=batchingMatrix * gPosM;
#endif
#ifdef USE_INSTANCING
gPosM=instanceMatrix * gPosM;
#endif
vGPosMundo=(modelMatrix * gPosM).xyz;
`+n(r=>r.vertice.main),fragmentoPars:`varying vec3 vGPosMundo;
`+n(r=>r.fragmento.pars),sol:n(r=>r.fragmento.sol),indireta:n(r=>r.fragmento.indireta),fim:o}}function z(e,t,a,n){if(!e.includes(t))throw new Error(`ganchos: ${n} sem '${t}' (o three mudou?)`);return e.replace(t,a)}function Ye(e,t=["sombra","neblina"]){let a=T.filter(r=>t.includes(r)),n=e.onBeforeCompile;e.onBeforeCompile=(r,u)=>{n?.call(e,r,u);let i=_e(a);for(let g of a)Object.assign(r.uniforms,h.get(g).uniformes);r.defines={...r.defines||{},...i.defines};let m=r.vertexShader;m=z(m,"#include <common>",`#include <common>
${i.verticePars}`,"vértice"),m=z(m,"#include <fog_vertex>",`#include <fog_vertex>
${i.verticeMain}`,"vértice");let l=r.fragmentShader;if(l=z(l,"#include <common>",`#include <common>
${i.fragmentoPars}`,"fragmento"),l.includes("#include <lights_fragment_begin>")){let g=de.lights_fragment_begin,c="getDirectionalLightInfo( directionalLight, directLight );";l=l.replace("#include <lights_fragment_begin>",z(g,c,`${c}
${i.sol}`,"luz"))}l.includes("#include <aomap_fragment>")&&(l=l.replace("#include <aomap_fragment>",`#include <aomap_fragment>
${i.indireta}`)),l=z(l,"#include <tonemapping_fragment>",`${i.fim}
#include <tonemapping_fragment>`,"fragmento"),r.vertexShader=m,r.fragmentShader=l};let o=e.customProgramCacheKey?.bind(e);return e.customProgramCacheKey=()=>`${o?o():""}|g${K}:${a.join(",")}`,e.userData.ganchos=a,J.add(e),e.addEventListener("dispose",()=>J.delete(e)),e.needsUpdate=!0,e}function ea(e,t){if(!h.has(e))throw new Error(`gancho fora do contrato: ${e} (${T.join(", ")})`);let a=Xe(t);h.set(e,a),Object.assign(Z,a.uniformes),K++;for(let n of J)n.needsUpdate=!0}var aa=e=>h.get(e)??null,ta=()=>[...T],X={definir:ea,obter:aa,aplicar:Ye,trechos:_e,uniformes:Z,nomes:ta,get versao(){return K}};var Y=Object.freeze(["sombra","sombraLonge","hao","camada","noite","selecao","mascara","neblina"]),Oe=Object.freeze({asfaltoNovo:{cor:[.05,.05,.052],rug:.85},asfaltoGasto:{cor:[.12,.118,.112],rug:.72},concreto:{cor:[.35,.34,.32],rug:.8},pinturaClara:{cor:[.64,.62,.57],rug:.7},grama:{cor:[.1,.12,.06],rug:.9},capimSeco:{cor:[.3,.27,.18],rug:.9},terraRoxa:{cor:[.2,.11,.08],rug:.95},terraClara:{cor:[.26,.22,.17],rug:.95},areia:{cor:[.44,.4,.32],rug:.9},granito:{cor:[.28,.27,.26],rug:.7},telha:{cor:[.36,.2,.13],rug:.75},folhagem:{cor:[.06,.09,.04],rug:.6},vidro:{cor:[.03,.035,.04],rug:.08,metal:0},bronze:{cor:[.4,.28,.18],rug:.35,metal:1},aluminio:{cor:[.9,.9,.91],rug:.3,metal:1}}),oa=.8;function ra({superficie:e=null,...t}={},{ganchos:a=Y}={}){let n=e?Oe[e]:null;if(e&&!n)throw new Error(`superfície desconhecida: ${e}`);let o=new ge({...n?{color:new N().setRGB(...n.cor,ue),roughness:n.rug,metalness:n.metal??0}:{},...t});return X.aplicar(o,a)}function na(e,t=Y){return X.aplicar(e,t)}var sa=e=>.2126*e[0]+.7152*e[1]+.0722*e[2];function ia(){}export{ye as a,k as b,je as c,X as d,Y as e,ra as f,la as g};
