import{b as R}from"./parte.20261008140106.ZY3BZVKB.js";import{i as G}from"./parte.20261008140106.QMZ5NMX3.js";import"./parte.20261008140106.7RD5DISE.js";import"./parte.20261008140106.U5D3A6X2.js";import"./parte.20261008140106.3O2LZXCC.js";import"./parte.20261008140106.R27MHOPN.js";import{Ha as F,Ja as q,Sa as Y,Wa as J,Xa as K,Z as B,ca as C,ea as L,eb as Q,ga as I,i as k,ka as W,q as _,s as N,ua as $}from"./parte.20261008140106.DZEF4CB6.js";import"./parte.20261008140106.RI4SDEP4.js";var c=Object.freeze({teto:Object.freeze({ultra:200,alta:200,media:60,leve:30}),longe:Object.freeze({ultra:1600,alta:1400,media:1e3,leve:800}),setor:256,tamPx:30,tamGrupoPx:34,acima:5,toquePx:22,refazerMs:200,topoMs:3e3,perto:.985,grade:8}),X=Object.freeze({grave:0,atencao:1,info:2,holding:3}),E=Object.freeze([4,3,1,2]),ie=["info","atencao","grave"],Z=Object.freeze({aro:["#ff7b6e","#f2b14c","#5ab0ff","#d9bd84"],fundo:"#10151c"});function se(r){let m=typeof r=="number"?ie[r]??"info":r;return X[m]??X.info}function le(r,{cam:m,teto:z,longe:p,setor:x=c.setor,visivel:v=()=>!0}){let b=[],u=new Map;for(let e of r){let y=Math.hypot(e.x-m[0],e.y-m[1],e.z-m[2]);if(y<=p){b.push({...e,n:1,dist:y});continue}let f=`${Math.floor(e.x/x)},${Math.floor(e.z/x)}`,s=u.get(f);s||(s={idx:e.idx,x:0,y:0,z:0,celula:-1,forma:e.forma,n:0,prioridade:e.prioridade,dist:0,melhor:e},u.set(f,s)),s.x+=e.x,s.y+=e.y,s.z+=e.z,s.n++,E[e.forma]>E[s.forma]&&(s.forma=e.forma),(e.prioridade>s.melhor.prioridade||e.prioridade===s.melhor.prioridade&&E[e.forma]>E[s.melhor.forma])&&(s.melhor=e),s.prioridade=Math.max(s.prioridade,e.prioridade)}let h=b.filter(e=>v(e.x,e.y,e.z));for(let e of u.values())e.x/=e.n,e.y/=e.n,e.z/=e.n,e.idx=e.melhor.idx,e.n===1&&(e.x=e.melhor.x,e.y=e.melhor.y,e.z=e.melhor.z,e.celula=e.melhor.celula),delete e.melhor,e.dist=Math.hypot(e.x-m[0],e.y-m[1],e.z-m[2]),v(e.x,e.y,e.z)&&h.push(e);return h.sort((e,y)=>y.prioridade-e.prioridade||E[y.forma]-E[e.forma]||e.dist-y.dist),h.slice(0,Math.max(0,z))}var ce=`
attribute vec3 aPos;
attribute vec4 aDados;
uniform vec2 gMarcTela;
uniform float gMarcPerto;
varying vec2 vUV;
flat varying vec4 vDados;
void main(){
vec4 v=viewMatrix * vec4(aPos,1.0);
v.xyz *=gMarcPerto;
vec4 c=projectionMatrix * v;
vec2 px=position.xy * aDados.w + vec2(0.0,0.5 * aDados.w + 2.0);
c.xy +=px * 2.0 / gMarcTela * c.w;
gl_Position=c;
vUV=position.xy + 0.5;
vDados=aDados;
}
`,de=`
uniform sampler2D gMarcAtlas;
uniform vec4 gMarcAtlasInfo;
uniform vec3 gMarcAro[ 4 ];
uniform vec3 gMarcFundo;
uniform float gMarcExpo;
varying vec2 vUV;
flat varying vec4 vDados;
float marcTriangulo(vec2 p,float r){
const float k=1.7320508;
p.x=abs(p.x)- r;
p.y=p.y + r / k;
if(p.x + k * p.y > 0.0)p=vec2(p.x - k * p.y,- k * p.x - p.y)/ 2.0;
p.x -=clamp(p.x,-2.0 * r,0.0);
return - length(p)* sign(p.y);
}
float marcForma(vec2 p,float f){
if(f < 0.5)return(abs(p.x)+ abs(p.y)- 0.94)* 0.7071;
if(f < 1.5)return marcTriangulo(p + vec2(0.0,0.24),0.9);
return length(p)- 0.86;
}
float marcCelula(vec2 q,float c){
if(q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0)return 0.0;
float n=gMarcAtlasInfo.z;
vec2 cel=vec2(mod(c,n),floor(c / n));
return texture(gMarcAtlas,(cel + vec2(q.x,1.0 - q.y))/ n).a;
}
void main(){
vec2 p=vUV * 2.0 - 1.0;
float f=vDados.y;
float d=marcForma(p,f);
float w=max(fwidth(d),1e-4);
float dentro=1.0 - smoothstep(-w,w,d);
float aro=1.0 - smoothstep(-w,w,abs(d + 0.1)- 0.075);
if(f > 2.5)aro=max(aro,1.0 - smoothstep(-w,w,abs(d + 0.3)- 0.045));
float g=0.0;
if(gMarcAtlasInfo.x > 0.5){
float s=f > 0.5 && f < 1.5 ? 0.44 : 0.56;
vec2 m=(p - vec2(0.0,f > 0.5 && f < 1.5 ? -0.14 : 0.0))/ s * 0.5 + 0.5;
if(vDados.z > 1.5){
float n=min(vDados.z,99.0);
float dez=floor(n / 10.0);
float um=n - 10.0 * dez;
if(dez > 0.5){
vec2 q=(m - 0.5)* 1.3 + 0.5;
g=max(marcCelula(q + vec2(0.24,0.0),gMarcAtlasInfo.y + dez),marcCelula(q - vec2(0.24,0.0),gMarcAtlasInfo.y + um));
}else g=marcCelula(m,gMarcAtlasInfo.y + um);
}else if(vDados.x > -0.5)g=marcCelula(m,vDados.x);
}
vec3 cor=mix(gMarcFundo,vec3(0.93,0.95,0.97),g);
cor=mix(cor,gMarcAro[ int(f + 0.5)],aro);
float a=max(dentro * 0.94,aro);
if(a < 0.01)discard;
gl_FragColor=vec4(cor * gMarcExpo,a);
}
`;function ue(r){let m=Math.max(...Object.values(c.teto)),z=new J(1,1),p=new Q;p.index=z.index,p.setAttribute("position",z.getAttribute("position"));let x=new q(new Float32Array(m*3),3),v=new q(new Float32Array(m*4),4);x.setUsage(C),v.setUsage(C),p.setAttribute("aPos",x),p.setAttribute("aDados",v),p.instanceCount=0;let b=o=>new $(o),u={gMarcTela:{value:new L(1,1)},gMarcPerto:{value:c.perto},gMarcAtlas:{value:null},gMarcAtlasInfo:{value:new W(0,0,c.grade,0)},gMarcAro:{value:Z.aro.map(b)},gMarcFundo:{value:b(Z.fundo)},gMarcExpo:{value:1}},h=new K({uniforms:u,vertexShader:ce,fragmentShader:de,transparent:!0,depthWrite:!1,depthTest:!0});h.name="marcador";let e=r.medidas.familia(new F(p,h),"resto");e.name="marcadores",e.frustumCulled=!1,e.renderOrder=40,e.visible=!1,e.userData.faixa="perto",r.cena.add(e);let y=new F(p,h),f=null,s=[],M=[],T=!0,D=-1/0,U=new I(1/0,0,0),w=new Map,g=new I;function j(o){if(f?.tex.dispose(),f=null,u.gMarcAtlasInfo.value.x=0,!o?.canvas)return;let a=new Y(o.canvas);a.flipY=!1,a.premultiplyAlpha=!1,a.colorSpace=B,a.generateMipmaps=!0,a.minFilter=N,a.magFilter=_,a.needsUpdate=!0,f={tex:a,mapa:o.mapa??{}},u.gMarcAtlas.value=a,u.gMarcAtlasInfo.value.set(1,f.mapa[0]??0,c.grade,0),T=!0}function O(o){s=(Array.isArray(o)?o:[]).filter(a=>Number.isInteger(a?.idx)&&a.idx>=0).map(a=>({idx:a.idx,glifo:a.glifo??null,forma:se(a.gravidade),prioridade:Number.isFinite(a.prioridade)?a.prioridade:0})),T=!0}function ee(o,a,l){let d=w.get(a);if(d&&l-d.t<c.topoMs)return d.y;let t=r.dominio("predios")?.caixaDoPredio?.(a)??r.dominio("colocaveis")?.caixa?.(a)??null,n=o.y[a]+(t?Math.max(4,t[5]):6+4*(o.nivel?.[a]??1));return w.set(a,{y:n,t:l}),n}function ae(o,a,l){return g.set(o,a,l).project(r.camera),g.z>-1&&g.z<1&&Math.abs(g.x)<1.08&&Math.abs(g.y)<1.08}function oe(o){let a=r.sim.espelho.predios;w.size>8192&&w.clear();let l=r.camera.position,d=[];if(a)for(let n of s){if(n.idx>=a.n||!a.viva[n.idx])continue;let i=f&&n.glifo!=null&&f.mapa[n.glifo]!==void 0?f.mapa[n.glifo]:-1;d.push({idx:n.idx,x:a.x[n.idx],y:a.y[n.idx],z:a.z[n.idx],celula:i,forma:n.forma,prioridade:n.prioridade})}let t=le(d,{cam:[l.x,l.y,l.z],teto:R(c.teto,r.perfil),longe:R(c.longe,r.perfil),visivel:ae});for(let n=0;n<t.length;n++){let i=t[n];i.y=i.n===1&&a?ee(a,i.idx,o)+c.acima:i.y+40,i.ref=a?G(i.idx,a.ger?.[i.idx]??0):null,x.array.set([i.x,i.y,i.z],3*n),v.array.set([i.celula,i.forma,i.n,i.n>1?c.tamGrupoPx:c.tamPx],4*n)}x.clearUpdateRanges(),v.clearUpdateRanges(),x.needsUpdate=!0,v.needsUpdate=!0,p.instanceCount=t.length,e.visible=t.length>0,M=t,r.stats.instancias.marcadores=t.length,U.copy(l),D=o,T=!1}let re=[r.ouvir("marcadores.atlas",j),r.ouvir("marcadores",O)];return r.sobre["marcadores.atlas"]&&j(r.sobre["marcadores.atlas"]),r.sobre.marcadores&&O(r.sobre.marcadores),{nome:"marcadores",quadro(o,a){let l=a.canvas;u.gMarcTela.value.set(Math.max(1,l?.clientWidth||l?.width||1),Math.max(1,l?.clientHeight||l?.height||1));let d=a.ambiente?.composicao;if(u.gMarcExpo.value=d&&a.renderer.toneMapping===k?1/Math.max(.05,d.exposicao):1,!s.length&&!M.length||a.sobre?.estado==="foto"){e.visible=!1;return}!e.visible&&M.length&&(e.visible=!0);let t=a.camera.position,n=t.distanceTo(U)>Math.max(2,.01*Math.abs(t.y));(T||n&&o-D>=c.refazerMs||o-D>=4*c.refazerMs)&&oe(o)},aquecimento:()=>[y],mostrados:()=>M.map(({idx:o,ref:a,x:l,y:d,z:t,forma:n,n:i,celula:V})=>({idx:o,ref:a,x:l,y:d,z:t,forma:n,n:i,celula:V})),medidas:()=>({pedidos:s.length,mostrados:M.length,atlas:!!f,teto:R(c.teto,r.perfil)}),selecionar(o){if(!M.length||!Number.isFinite(o.xTela))return null;let a=r.canvas,l=a?.clientWidth||1,d=a?.clientHeight||1,t=null,n=1/0;for(let A of M){if(g.set(A.x,A.y,A.z).project(r.camera),g.z<=-1||g.z>=1)continue;let S=A.n>1?c.tamGrupoPx:c.tamPx,te=(g.x+1)/2*l,ne=(1-g.y)/2*d-(.5*S+2),H=Math.hypot(te-o.xTela,ne-o.yTela);H<=Math.max(c.toquePx,S/2+4)&&H<n&&(n=H,t=A)}if(!t)return null;let i=Math.hypot(t.x-o.origem[0],t.y-o.origem[1],t.z-o.origem[2]),P=r.sim.espelho.predios?r.dominio("predios")?.selecionar?.(o,r.sim.espelho):null;return P&&P.idx!==t.idx&&P.dist<i-15?null:{tipo:"marcador",ref:t.ref,idx:t.idx,ponto:[t.x,t.y,t.z],dist:i,n:t.n}},descartar(){for(let o of re)o();r.cena.remove(e),p.dispose(),z.dispose(),h.dispose(),f?.tex.dispose()}}}export{Z as CORES_MARC,X as FORMA,de as FRAG_MARC,c as MARC,ce as VERT_MARC,ue as criarMarcadores,le as escolherMarcadores,se as formaDe};
