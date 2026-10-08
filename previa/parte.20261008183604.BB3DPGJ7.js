import{f as co,h as K,i as Yo,j as Vt}from"./parte.20261008183604.CKHJTBGC.js";import{b as Zo,c as Wt}from"./parte.20261008183604.2F3GY6OJ.js";import{c as jt,e as Dt}from"./parte.20261008183604.IPHPCIN4.js";import{c as ct,d as ft}from"./parte.20261008183604.JGCAH6T7.js";import{f as It,g as Nt,i as St}from"./parte.20261008183604.NTO2TBFV.js";import{a as it,c as jo,e as Do}from"./parte.20261008183604.MCHI3VZI.js";import{e as mt}from"./parte.20261008183604.OWGGVB4F.js";import{b as Vo,c as Ft}from"./parte.20261008183604.C6X3HJFF.js";import{a as _t,b as Fo}from"./parte.20261008183604.OYGPJWDA.js";import{Aa as et,Ca as go,Da as ut,Ea as Lo,Ha as xo,Ja as Bo,Ka as Go,Ua as Zt,Wa as kt,Za as ao,ab as $t,b as lt,ca as qt,da as Ao,db as Jt,fa as Ut,ga as k,ka as ot,pa as qo,qa as Bt,ta as Uo,ua as bo,wa as Gt,ya as Ro,za as tt}from"./parte.20261008183604.OHQ55C2B.js";import{a as Pt}from"./parte.20261008183604.2RPJNNMJ.js";var Oa={};Pt(Oa,{cavarPlanoNaCena:()=>Aa,cavarTerreno:()=>Te,descavar:()=>Oe,materialAgua:()=>Ra,quadroAgua:()=>wa,registrar:()=>Ta});var za={};Pt(za,{CASCATA:()=>ra,CHAVES:()=>Qo,DIST_EFEITOS:()=>Re,DIST_LOD0:()=>Ae,FONTES:()=>yo,LUZ:()=>fo,LUZ_NOITE:()=>_o,MEIO_VAO_CORTE:()=>ve,Malha:()=>Y,NIVEL:()=>zt,PADRAO:()=>G,PONTOS_TORRE:()=>na,SEM_ANEL:()=>Io,SETORES:()=>bt,UNIFORMES:()=>Oo,VIDRO:()=>lo,acab:()=>_,andaresLed:()=>Xe,anelPlano:()=>Et,anelRet:()=>wt,areaPoli:()=>ae,arvore:()=>To,atualizarArcologia:()=>Ea,barra:()=>me,bloco:()=>R,caixa:()=>Eo,cascaEfeito:()=>sa,cilindro:()=>B,contornoHeliponto:()=>mo,contornoPodio:()=>Q,contornoTrecho:()=>Xo,corLinear:()=>yt,criarAquecimento:()=>xa,criarJatos:()=>ha,criarPar:()=>Ma,criarTorre:()=>ba,descartarMateriais:()=>ga,esplanada:()=>Tt,estadoDoCeu:()=>ze,extrasCorte:()=>Ht,geometriaDe:()=>No,hashF:()=>J,malhaJato:()=>Me,malhaSombraPar:()=>xe,malhaSombraTorre:()=>Ct,malhasPar:()=>xt,malhasTorre:()=>nt,malhasTorreLod1:()=>Ot,materiais:()=>Ee,materialCascata:()=>ye,materialJato:()=>be,materialOpaco:()=>vt,materialVidro:()=>Ko,medidasDoPar:()=>ge,medidasTorre:()=>Co,orientar:()=>ho,parede:()=>ne,pontosTorre:()=>he,prisma:()=>I,semAnel:()=>ee,tampa:()=>po,torno:()=>Ye,trechosCorpo:()=>At,triangular:()=>Mt,tufo:()=>re,vid:()=>vo,vidAnel:()=>Qe});var $o=Math.PI/180,F=o=>new bo(o);function ht(o,e,r=-23.5,t=new k){let n=23.44*$o*Math.sin(2*Math.PI*(284+e)/365),a=(o-12)*15*$o,s=r*$o,f=Math.sin(s)*Math.sin(n)+Math.cos(s)*Math.cos(n)*Math.cos(a),l=Math.asin(Math.max(-1,Math.min(1,f))),c=Math.atan2(-Math.sin(a)*Math.cos(n),Math.cos(s)*Math.sin(n)-Math.sin(s)*Math.cos(n)*Math.cos(a));return t.set(Math.cos(l)*Math.sin(c),Math.sin(l),-Math.cos(l)*Math.cos(c)).normalize()}var Kt=F("#8fb3d6"),Xt=F("#d9a577"),Le=F("#0c1422"),Pe=F("#b9c7d4"),_e=F("#1a2332"),Fa=Object.freeze({manha:9,tarde:14,fimDeTarde:17.5,noite:21.5});function Ie(o){let{cena:e}=o,r=new Jt(16777215,3);r.castShadow=!1;let t=new $t(12374246,6050886,1);e.add(r,r.target,t),e.background=Kt.clone();let n=new k(0,1,0),a=new bo;return{nome:"ceu",substituto:!0,quadro(s,f){let l=f.horaDoCeu(),c=f.sim.espelho.tempo;ht(l,c?.diaDoAno??0,f.sim.espelho.mapa?.latitude??-23.5,n);let p=Ao.smoothstep(n.y,-.08,.12),h=1-Ao.smoothstep(n.y,.05,.35),m=p>.02?n:Ne.copy(n).negate().setY(Math.max(.35,-n.y));f.sol.dir.copy(m).normalize(),r.position.copy(f.sol.dir).multiplyScalar(1e3).add(f.camera.position),r.target.position.copy(f.camera.position),r.color.setRGB(1,.97-.3*h,.92-.5*h),r.intensity=3.2*p+.12*(1-p),p<=.02&&r.color.setRGB(.55,.65,.9),t.intensity=.08+.9*p,a.copy(Kt).lerp(Xt,h*p).lerp(Le,1-p),e.background.copy(a),f.ganchos.uniformes.gNeblinaCor.value.copy(Pe).lerp(Xt,.5*h*p).lerp(_e,1-p),f.sol.dia=p},descartar(){e.remove(r,r.target,t)}}}var Ne=new k,ko=4,ro={grama:F("#7b7a5c"),mata:F("#465238"),rocha:F("#8a857d"),areia:F("#b3a68a"),agua:F("#34505e"),plano:F("#8a8672")},dt=new WeakMap;function Se(o,e,r){let t=(o.n-1)/ko+1,n=dt.get(o);if(!n){n=new Float32Array(t*t);for(let a=0;a<t;a++)for(let s=0;s<t;s++)n[a*t+s]=o.altura[a*ko*o.n+s*ko];dt.set(o,n)}return _t(n,t,o.passo*ko,o.origem[0],o.origem[1],e,r)}function Fe(o){let e=o.ganchos.aplicar(new ao({vertexColors:!0,roughness:.95,metalness:0}),["sombra","neblina"]),r=o.ganchos.aplicar(new ao({color:ro.agua,roughness:.25,metalness:0}),["sombra","neblina"]),t=null,n=null,a=null,s=null,f=!1,l=-1e9;function c(p){let h=p.terreno;if(!h)return;dt.delete(h);let i=h.altura.every(T=>T===h.altura[0])&&(!h.agua||h.agua.every(T=>T===Do.TERRA))?h.n-1:ko,g=(h.n-1)/i+1,d=new Float32Array(g*g*3),x=new Float32Array(g*g*3),v=new Uint8Array(g*g),b=p.floresta,A=!1,u=!0,y=h.altura[0],E=new bo;for(let T=0;T<g;T++)for(let H=0;H<g;H++){let P=T*i*h.n+H*i,eo=h.origem[0]+H*i*h.passo,U=h.origem[1]+T*i*h.passo,S=h.altura[P];S!==y&&(u=!1);let D=T*g+H;d[3*D]=eo,d[3*D+1]=S,d[3*D+2]=U;let to=h.agua?h.agua[P]:0;if(to===Do.MAR&&(A=!0,v[D]=S<=(p.mapa?.nivelMar??0)?1:0),to!==Do.TERRA)E.copy(ro.agua);else{E.copy(ro.grama),S<2.5&&De(h,P)&&E.copy(ro.areia);let io=Ao.smoothstep(S,90,220);if(b){let Ho=Math.min(b.n-1,Math.round((eo-(b.origem?.[0]??-4096))/b.passo)),Lt=Math.min(b.n-1,Math.round((U-(b.origem?.[1]??-4096))/b.passo)),He=Ho>=0&&Lt>=0?b.dens[Lt*b.n+Ho]/255:0;E.lerp(ro.mata,He*.9)}E.lerp(ro.rocha,io*.6)}x[3*D]=E.r,x[3*D+1]=E.g,x[3*D+2]=E.b}if(u)for(let T=0;T<g*g;T++)x[3*T]=ro.plano.r,x[3*T+1]=ro.plano.g,x[3*T+2]=ro.plano.b;let z=new Uint32Array((g-1)*(g-1)*6),O=0;for(let T=0;T<g-1;T++)for(let H=0;H<g-1;H++){let P=T*g+H;v[P]&&v[P+1]&&v[P+g]&&v[P+g+1]||(z[O++]=P,z[O++]=P+g,z[O++]=P+1,z[O++]=P+1,z[O++]=P+g,z[O++]=P+g+1)}let w=new Lo;if(w.setAttribute("position",new Ro(d,3)),w.setAttribute("color",new Ro(x,3)),w.setIndex(new Ro(z.slice(0,O),1)),w.computeVertexNormals(),t?(t.geometry.dispose(),t.geometry=w):(t=o.medidas.familia(new xo(w,e),"terreno"),t.name="depuracao:chao",t.frustumCulled=!1,o.cena.add(t)),A&&!n){let T=new kt(4e4,4e4).rotateX(-Math.PI/2);n=o.medidas.familia(new xo(T,r),"resto"),n.name="depuracao:mar",n.position.y=p.mapa?.nivelMar??0,n.frustumCulled=!1,o.cena.add(n)}else!A&&n&&(o.cena.remove(n),n=null);if(a&&(o.cena.remove(a),a.geometry.dispose(),a=null),!A){let T=h.origem[0],H=h.origem[1],P=(h.n-1)*h.passo,eo=0;for(let S=0;S<g;S++)eo+=d[3*S+1]+d[3*((g-1)*g+S)+1]+d[3*(S*g)+1]+d[3*(S*g+g-1)+1];let U=u?ro.plano:ro.grama;a=o.medidas.familia(new xo(je(T,H,T+P,H+P,2e4,eo/(4*g),U),e),"terreno"),a.name="depuracao:moldura",a.frustumCulled=!1,o.cena.add(a)}o.sombra.marcar()}return{nome:"terreno",substituto:!0,aplicar(p,h,m){if(!h.terreno)return;(h.terreno!==s||Zo(p,"terreno"))&&(f=!0),(p.terreno?.length||p.floresta?.length||p.tudo?.floresta)&&(f=!0);let i=performance.now();f&&(!t||i-l>500)&&(c(h),s=h.terreno,f=!1,l=i)},descartar(){t&&o.cena.remove(t),n&&o.cena.remove(n),a&&o.cena.remove(a)}}}function je(o,e,r,t,n,a,s){let f=[[-n,-n],[n,-n],[n,n],[-n,n]],l=[[o,e],[r,e],[r,t],[o,t]],c=new Float32Array(24),p=new Float32Array(24),h=new Float32Array(24);[...f,...l].forEach(([g,d],x)=>{c.set([g,a,d],3*x),p.set([s.r,s.g,s.b],3*x),h.set([0,1,0],3*x)});let m=[];for(let g=0;g<4;g++){let d=(g+1)%4;m.push(g,4+g,d,d,4+g,4+d)}let i=new Lo;return i.setAttribute("position",new Ro(c,3)),i.setAttribute("color",new Ro(p,3)),i.setAttribute("normal",new Ro(h,3)),i.setIndex(m),i}function De(o,e){let r=o.n;for(let t of[-8,8,-8*r,8*r])if(o.agua[e+t]===Do.MAR)return!0;return!1}var Ve={res:F("#c4b9a6"),com:F("#a9b0b6"),esc:F("#93a0ad"),ind:F("#9d978a")},Qt=F("#d2cec6"),qe=F("#b09f7e"),Ue=F("#5f5b55");function Yt(o,e){if(o.tipo[e]!==jo.ZONA)return 14;let r=jt(o.modelo[e]),t=ct[r?.zona??ft[o.zona[e]]];if(!r||!t)return 8;let[n,a]=r.niveis[Math.max(1,Math.min(5,o.nivel[e]))-1].andares,s=n+o.semente[e]%(a-n+1),f=t.familia;return s*(Dt[f]??3.2)+(f==="ind"?2:1.2)}function Be(o,e,r,t){let n=o.flags[e];if(n&it.ABANDONADO)return r.copy(Ue);if(n&it.OBRA)return r.copy(qe);if(o.tipo[e]===jo.HOLDING)return r.copy(t);if(o.tipo[e]===jo.SERVICO)return r.copy(Qt);let a=ct[ft[o.zona[e]]];r.copy(Ve[a?.familia]??Qt);let s=.9+(o.semente[e]>>>8)%21/100;return r.multiplyScalar(s)}function Ge(o){let e=new Zt(1,1,1).translate(0,.5,0),r=o.ganchos.aplicar(new ao({color:16777215,roughness:.82,metalness:0}),["sombra","neblina"]),t=null,n=null,a=new qo,s=new Ut,f=new Bt,l=new k,c=new k,p=new bo,h=new qo().makeScale(0,0,0),m=new bo;function i(d){if(t&&t.instanceMatrix.count>=d)return!1;let x=Math.max(1024,2**Math.ceil(Math.log2(Math.max(1,d))));return t&&(o.cena.remove(t),o.sombra.soltar(t),t.dispose()),t=o.medidas.familia(new Go(e,r,x),"predios"),t.name="depuracao:predios",t.instanceMatrix.setUsage(qt),t.instanceColor=new Bo(new Float32Array(x*3),3),t.frustumCulled=!1,t.count=0,o.cena.add(t),n=o.medidas.familia(o.sombra.projetor(t),"sombra"),!0}function g(d,x){if(!d.viva[x]){t.setMatrixAt(x,h);return}let v=Yt(d,x),b=d.y[x]-2;f.set(0,d.rot[x],0),s.setFromEuler(f),l.set(d.x[x],b,d.z[x]),c.set(Math.max(1,d.w[x]-1),v+2,Math.max(1,d.d[x]-1)),a.compose(l,s,c),t.setMatrixAt(x,a),t.setColorAt(x,Be(d,x,p,m))}return{nome:"predios",substituto:!0,aplicar(d,x){let v=x.predios;if(!v)return;m.set(x.holding?.cor??"#c9a86a");let A=i(v.n)||Zo(d,"predios")||d.holding;if(A)for(let u=0;u<v.n;u++)g(v,u);else for(let u of d.predios)u<t.instanceMatrix.count&&g(v,u);(A||d.predios.length)&&(t.count=v.n,n.count=v.n,t.instanceMatrix.needsUpdate=!0,t.instanceColor.needsUpdate=!0,o.sombra.marcar(),o.stats.instancias.predios=v.n)},selecionar(d,x){let v=x.predios;if(!v)return null;let b=null,A=d.origem,u=d.dir;for(let y=0;y<v.n;y++){if(!v.viva[y])continue;let E=Yt(v,y),z=Ze(A,u,v.x[y],v.y[y]-2,v.z[y],v.rot[y],v.w[y]/2,E+2,v.d[y]/2);z!==null&&(!b||z<b.dist)&&(b={tipo:v.tipo[y]===jo.ZONA?"predio":"colocavel",idx:y,ref:St(y,v.ger[y]),dist:z,ponto:[A[0]+u[0]*z,A[1]+u[1]*z,A[2]+u[2]*z]})}return b},descartar(){t&&(o.cena.remove(t),o.sombra.soltar(t))}}}function Ze(o,e,r,t,n,a,s,f,l){let c=Math.cos(a),p=Math.sin(a),h=o[0]-r,m=o[2]-n,i=h*c-m*p,g=h*p+m*c,d=e[0]*c-e[2]*p,x=e[0]*p+e[2]*c,v=0,b=1/0,A=(u,y,E,z)=>{if(Math.abs(y)<1e-9)return u>=E&&u<=z;let O=(E-u)/y,w=(z-u)/y;return O>w&&([O,w]=[w,O]),v=Math.max(v,O),b=Math.min(b,w),v<=b};return!A(i,d,-s,s)||!A(o[1],e[1],t,t+f)||!A(g,x,-l,l)?null:v}var pt={asfalto:F("#3b3d40"),terra:F("#7d6a52"),rodovia:F("#333538")};function ke(o){let e=o.ganchos.aplicar(new ao({vertexColors:!0,roughness:.9,metalness:0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),["sombra","neblina"]),r=null,t=!0,n=-1e9,a=[0,0],s=[0,0];function f(l){let c=l.vias?.arestas,p=l.terreno;if(!c||!p)return;let h=[],m=[],i=[];for(let d=0;d<c.n;d++){if(!c.viva[d])continue;let x=Vo[Ft[c.tipo[d]]]??Vo.rua,v=x.largura/2,b=x===Vo.terra?pt.terra:x===Vo.rodovia?pt.rodovia:pt.asfalto,A=Math.max(2,Math.ceil((c.comp[d]||50)/12)),u=8*d,y=h.length/3;for(let E=0;E<=A;E++){let z=E/A;$e(c.p,u,z,a,s);let O=Math.hypot(s[0],s[1])||1,w=-s[1]/O,T=s[0]/O;for(let H of[-1,1]){let P=a[0]+w*v*H,eo=a[1]+T*v*H;h.push(P,Se(p,P,eo)+.35,eo),m.push(b.r,b.g,b.b)}if(E<A){let H=y+2*E;i.push(H,H+1,H+2,H+1,H+3,H+2)}}}let g=new Lo;g.setAttribute("position",new go(h,3)),g.setAttribute("color",new go(m,3)),g.setAttribute("normal",new go(new Float32Array(h.length).map((d,x)=>x%3===1?1:0),3)),g.setIndex(h.length/3>65535?new et(i,1):new tt(i,1)),r?(r.geometry.dispose(),r.geometry=g):(r=o.medidas.familia(new xo(g,e),"vias"),r.name="depuracao:vias",r.frustumCulled=!1,r.renderOrder=1,o.cena.add(r))}return{nome:"vias",substituto:!0,aplicar(l,c){(Zo(l,"vias")||Zo(l,"arestas")||l.arestas?.length||l.tudo?.terreno)&&(t=!0);let p=performance.now();t&&p-n>250&&(f(c),t=!1,n=p)},descartar(){r&&o.cena.remove(r)}}}function $e(o,e,r,t,n){let a=1-r,s=a*a*a,f=3*a*a*r,l=3*a*r*r,c=r*r*r;t[0]=s*o[e]+f*o[e+2]+l*o[e+4]+c*o[e+6],t[1]=s*o[e+1]+f*o[e+3]+l*o[e+5]+c*o[e+7];let p=3*a*a,h=6*a*r,m=3*r*r;n[0]=p*(o[e+2]-o[e])+h*(o[e+4]-o[e+2])+m*(o[e+6]-o[e+4]),n[1]=p*(o[e+3]-o[e+1])+h*(o[e+5]-o[e+3])+m*(o[e+7]-o[e+5])}var Je=Object.freeze({distMin:10,distMax:9e3,incMin:3,incMax:88}),We=o=>o<.5?4*o*o*o:1-(-2*o+2)**3/2;function ja(o,e={}){let r=Je,t={x:0,z:0,dist:1200,guinada:20,inclinacao:38,...e},n=null,a=o.camera,s=()=>{t.dist=Math.min(r.distMax,Math.max(r.distMin,t.dist)),t.inclinacao=Math.min(r.incMax,Math.max(r.incMin,t.inclinacao)),t.guinada=(t.guinada%360+360)%360;let c=(o.sim?.espelho?.mapa?.tam??8192)/2;t.x=Math.min(c,Math.max(-c,t.x)),t.z=Math.min(c,Math.max(-c,t.z))},f=()=>{if(!n)return;let{ok:c}=n;n=null,c()},l={estado:()=>({x:t.x,z:t.z,dist:t.dist,guinada:t.guinada,inclinacao:t.inclinacao}),definir(c={}){f();for(let p of["x","z","dist","guinada","inclinacao"])Number.isFinite(c[p])&&(t[p]=c[p]);s()},irPara(c={},p=800){f();let h=l.estado(),m={...h};for(let g of["x","z","dist","guinada","inclinacao"])Number.isFinite(c[g])&&(m[g]=c[g]);let i=(m.guinada-h.guinada+540)%360-180;return m.guinada=h.guinada+i,p>0?new Promise(g=>{n={t0:performance.now(),ms:p,de:h,para:m,ok:g}}):(l.definir(m),Promise.resolve())},alvo(c=new k){let p=o.sim.espelho.terreno;return c.set(t.x,p?Fo(p,t.x,t.z):0,t.z)},atualizar(c){if(n){let d=Math.min(1,(c-n.t0)/n.ms),x=We(d);for(let v of["x","z","dist","guinada","inclinacao"])t[v]=n.de[v]+(n.para[v]-n.de[v])*x;d>=1&&f()}s();let p=l.alvo(Ke),h=t.guinada*$o,m=t.inclinacao*$o;a.position.set(p.x-t.dist*Math.cos(m)*Math.sin(h),p.y+t.dist*Math.sin(m),p.z+t.dist*Math.cos(m)*Math.cos(h));let i=o.sim.espelho.terreno;if(i){let d=Fo(i,a.position.x,a.position.z)+2;a.position.y<d&&(a.position.y=d)}a.lookAt(p);let g=Math.max(1,a.position.y-(i?Fo(i,a.position.x,a.position.z):0));a.near=Math.min(30,Math.max(.2,g*.02)),a.far=Math.min(6e4,Math.max(4e3,t.dist*12)),a.updateProjectionMatrix(),a.updateMatrixWorld()},get voando(){return!!n}};return s(),l}var Ke=new k;function Da(o,e,r,t,n){let a=new k(t/e*2-1,-(n/r)*2+1,.5).unproject(o),s=o.position,f=a.sub(s).normalize();return{origem:[s.x,s.y,s.z],dir:[f.x,f.y,f.z]}}function Va(o,e,r=3e4){let[t,n,a]=e.origem,[s,f,l]=e.dir,c=m=>n+f*m-(o?Fo(o,t+s*m,a+l*m):0);if(c(0)<0)return null;let p=0,h=1;for(;h<r;){if(c(h)<=0){let m=p,i=h;for(let d=0;d<24;d++){let x=(m+i)/2;c(x)>0?m=x:i=x}let g=(m+i)/2;return[t+s*g,n+f*g,a+l*g]}p=h,h+=Math.max(1,h*.02)}return null}function qa(o,e){let r=o.canvas,t=new Map,n={modo:"camera",aoFerramenta:null,aoToque:[],opcoes:{deslocY:56,bordaPx:48}},a=null,s=m=>{let i=r.getBoundingClientRect();return{x:m.clientX-i.left,y:m.clientY-i.top}},f=(m,i)=>o.raio(m,i),l=(m,i,g,d)=>{let x=i.y-(d==="touch"?n.opcoes.deslocY:0);n.aoFerramenta?.({fase:m,x:i.x,y:x,ponto:f(i.x,x),dedos:g})};function c(m){try{r.setPointerCapture?.(m.pointerId)}catch{}let i=s(m);t.set(m.pointerId,{...i,x0:i.x,y0:i.y,botao:m.button});let g=t.size;if(g===1){if(n.modo==="ferramenta"&&m.button===0){a={tipo:"ferramenta",t0:performance.now()},l("inicio",i,1,m.pointerType);return}a={tipo:m.button===2||m.ctrlKey?"girar":"arrastar",t0:performance.now(),ancora:f(i.x,i.y),px:i.x,py:i.y,moveu:!1,e0:e.estado()}}else if(g===2){a?.tipo==="ferramenta"&&l("fim",i,1,m.pointerType);let[d,x]=[...t.values()];a={tipo:"dois",d0:Math.hypot(d.x-x.x,d.y-x.y),ang0:Math.atan2(x.y-d.y,x.x-d.x),my0:(d.y+x.y)/2,e0:e.estado()}}}function p(m){let i=t.get(m.pointerId);if(!i)return;let g=s(m);if(i.x=g.x,i.y=g.y,!!a){if(a.tipo==="ferramenta"){l("move",g,1,m.pointerType);return}if(a.tipo==="arrastar"||a.tipo==="girar"){if(Math.hypot(g.x-i.x0,g.y-i.y0)>6&&(a.moveu=!0),!a.moveu)return;if(a.tipo==="girar"){e.definir({...a.e0,guinada:a.e0.guinada+(g.x-i.x0)*.3,inclinacao:a.e0.inclinacao+(g.y-i.y0)*.2});return}let d=f(g.x,g.y);if(a.ancora&&d){let x=e.estado();e.definir({...x,x:x.x+a.ancora[0]-d[0],z:x.z+a.ancora[2]-d[2]}),e.atualizar(performance.now())}return}if(a.tipo==="dois"&&t.size>=2){let[d,x]=[...t.values()],v=Math.hypot(d.x-x.x,d.y-x.y),b=Math.atan2(x.y-d.y,x.x-d.x),A=(d.y+x.y)/2,u=a.e0,y={...e.estado(),dist:u.dist*(a.d0/Math.max(1,v)),guinada:u.guinada-(b-a.ang0)*180/Math.PI};n.modo!=="ferramenta"&&(y.inclinacao=u.inclinacao+(A-a.my0)*.25),e.definir(y)}}}function h(m){let i=t.get(m.pointerId);if(t.delete(m.pointerId),!i||!a)return;let g=s(m);if(a.tipo==="ferramenta"){l("fim",g,1,m.pointerType),a=null;return}if(m.type!=="pointercancel"&&(a.tipo==="arrastar"||a.tipo==="girar")&&!a.moveu&&t.size===0){let d=performance.now()-a.t0>500;for(let x of n.aoToque)x({x:g.x,y:g.y,longo:d,botao:i.botao})}t.size===0&&(a=null)}return r.addEventListener("pointerdown",c),r.addEventListener("pointermove",p),r.addEventListener("pointerup",h),r.addEventListener("pointercancel",h),r.addEventListener("contextmenu",m=>m.preventDefault()),r.addEventListener("wheel",m=>{m.preventDefault();let i=e.estado();e.definir({...i,dist:i.dist*Math.exp(m.deltaY*.0012)})},{passive:!1}),{modo(m){n.modo=m==="ferramenta"?"ferramenta":"camera"},aoFerramenta(m){n.aoFerramenta=m},aoToque(m){return n.aoToque.push(m),()=>{n.aoToque=n.aoToque.filter(i=>i!==m)}},opcoes(m={}){Object.assign(n.opcoes,m)},get estado(){return n.modo}}}function Ua(o){o.registrarDominio("ceu",Ie,{substituto:!0}),o.registrarDominio("terreno",Fe,{substituto:!0}),o.registrarDominio("vias",ke,{substituto:!0}),o.registrarDominio("predios",Ge,{substituto:!0}),o.registrarSelecionavel("predios",(e,r)=>r.dominio("predios")?.selecionar?.(e,r.sim.espelho)??null,{prioridade:Wt.mundo})}function yt(o){let e=parseInt(o.slice(1),16),r=t=>{let n=t/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4};return[r(e>>16&255),r(e>>8&255),r(e&255)]}var G=Object.freeze({nenhum:0,pedra:1,piso:2,grama:3,agua:4,portuguesa:5,solar:6,folha:7,metal:8,pista:9,quadra:10,livros:11,marquise:12,malha:13,troncoVivo:14}),fo=Object.freeze({nenhuma:0,aro:1,obstaculo:2,forro:3,piscina:4,coroa:5,janela:6,esfera:7,arvoreLuz:8,reflexo:9,led:10,livros:11,marquise:12}),Xe=Vt;function _(o,{rugo:e=.8,metal:r=0,luz:t=0,padrao:n=0}={}){let[a,s,f]=yt(o),l=c=>Math.max(0,Math.min(15,Math.round(c*15)));return[a,s,f,((l(e)*16+l(r))*16+t)*16+n]}var lo=Object.freeze({cortina:0,costura:1,vento:2,saguao:3,lanterna:4,parapeito:5,anel:6,oval:7,codex:8,escada:9,torreLod1:10,anelDentro:11}),vo=(o,e=0,r=0,t=0)=>[o,e,r,t],Io=64,ee=o=>(Math.min(Io-1,Math.max(0,Math.floor(o*Io)))+.5)/Io,Qe=(o,e,r,t,n,a=0)=>[o,Math.floor(r)+ee(e),t,n+32*a],bt=20,Y=class{constructor(e="opaco"){this.tipo=e,this.p=[],this.n=[],this.uv=[],this.c=[],this.i=[]}get vertices(){return this.p.length/3}get triangulos(){return this.i.length/3}v(e,r,t,n,a,s,f,l,c){return this.p.push(e,r,t),this.n.push(n,a,s),this.uv.push(f,l),this.c.push(c[0],c[1],c[2],c[3]),this.p.length/3-1}tri(e,r,t){let n=this.p,a=n[3*e],s=n[3*e+1],f=n[3*e+2],l=n[3*r]-a,c=n[3*r+1]-s,p=n[3*r+2]-f,h=n[3*t]-a,m=n[3*t+1]-s,i=n[3*t+2]-f,g=c*i-p*m,d=p*h-l*i,x=l*m-c*h;if(g*g+d*d+x*x<1e-12)return;g*this.n[3*e]+d*this.n[3*e+1]+x*this.n[3*e+2]>=0?this.i.push(e,r,t):this.i.push(e,t,r)}quad(e,r,t,n,a,s,f,l,c,p){let h=this.v(e[0],e[1],e[2],a[0],a[1],a[2],s[0],s[1],p),m=this.v(r[0],r[1],r[2],a[0],a[1],a[2],f[0],f[1],p),i=this.v(t[0],t[1],t[2],a[0],a[1],a[2],l[0],l[1],p),g=this.v(n[0],n[1],n[2],a[0],a[1],a[2],c[0],c[1],p);this.tri(h,m,i),this.tri(h,i,g)}juntar(e){let r=this.vertices;for(let t=0;t<e.p.length;t++)this.p.push(e.p[t]);for(let t=0;t<e.n.length;t++)this.n.push(e.n[t]);for(let t=0;t<e.uv.length;t++)this.uv.push(e.uv[t]);for(let t=0;t<e.c.length;t++)this.c.push(e.c[t]);for(let t=0;t<e.i.length;t++)this.i.push(e.i[t]+r);return this}caixa(){if(!this.p.length)return null;let e=[1/0,1/0,1/0,-1/0,-1/0,-1/0];for(let r=0;r<this.p.length;r+=3)for(let t=0;t<3;t++){let n=this.p[r+t];n<e[t]&&(e[t]=n),n>e[t+3]&&(e[t+3]=n)}return e}transformar(e,r,t,n=0){let a=Math.cos(n),s=Math.sin(n);for(let f=0;f<this.p.length;f+=3){let l=this.p[f],c=this.p[f+2];this.p[f]=a*l+s*c+e,this.p[f+1]+=r,this.p[f+2]=-s*l+a*c+t;let p=this.n[f],h=this.n[f+2];this.n[f]=a*p+s*h,this.n[f+2]=-s*p+a*h}return this}};function ae(o){let e=0,r=o.length/2;for(let t=0,n=r-1;t<r;n=t++)e+=o[2*n]*o[2*t+1]-o[2*t]*o[2*n+1];return e/2}function ho(o){let e=[],r=o.length/2;for(let n=0;n<r;n++){let a=o[2*n],s=o[2*n+1],f=e.length;f&&Math.abs(e[f-2]-a)<1e-6&&Math.abs(e[f-1]-s)<1e-6||e.push(a,s)}if(e.length>4&&Math.abs(e[0]-e[e.length-2])<1e-6&&Math.abs(e[1]-e[e.length-1])<1e-6&&(e.length-=2),ae(e)>=0)return e;let t=[];for(let n=e.length/2-1;n>=0;n--)t.push(e[2*n],e[2*n+1]);return t}function Mt(o){let e=ho(o),r=e.length/2,t=[...Array(r).keys()],n=[],a=p=>e[2*p],s=p=>e[2*p+1],f=(p,h,m)=>(a(h)-a(p))*(s(m)-s(p))-(s(h)-s(p))*(a(m)-a(p)),l=(p,h,m,i)=>f(h,m,p)>=-1e-9&&f(m,i,p)>=-1e-9&&f(i,h,p)>=-1e-9,c=0;for(;t.length>3&&c++<1e4;){let p=!1;for(let h=0;h<t.length;h++){let m=t[(h+t.length-1)%t.length],i=t[h],g=t[(h+1)%t.length];if(f(m,i,g)<=1e-9)continue;let d=!0;for(let x of t)if(!(x===m||x===i||x===g)&&l(x,m,i,g)){d=!1;break}if(d){n.push(m,i,g),t.splice(h,1),p=!0;break}}if(!p)break}for(let p=1;p+1<t.length;p++)n.push(t[0],t[p],t[p+1]);return{pontos:e,indices:n}}function po(o,e,r,t,n=!0){let{pontos:a,indices:s}=Mt(e),f=n?1:-1,l=o.vertices;for(let c=0;c<a.length/2;c++)o.v(a[2*c],r,a[2*c+1],0,f,0,a[2*c],a[2*c+1],t);for(let c=0;c<s.length;c+=3)o.tri(l+s[c],l+s[c+1],l+s[c+2])}function ne(o,e,r,t,n,a,s,f,l=0,c=null,p=0){let h=t-e,m=n-r,i=Math.hypot(h,m);if(i<1e-6||s-a<1e-6)return;let g=[m/i,0,-h/i],d=c??l+i,x=a-p,v=s-p;o.quad([e,a,r],[t,a,n],[t,s,n],[e,s,r],g,[l,x],[d,x],[d,v],[l,v],f)}function I(o,e,r,t,{paredes:n=null,topo:a=null,base:s=null,uFn:f=null,vBase:l=0}={}){let c=ho(e),p=c.length/2,h=0;for(let m=0;m<p;m++){let i=c[2*m],g=c[2*m+1],d=c[2*((m+1)%p)],x=c[2*((m+1)%p)+1],v=Math.hypot(d-i,x-g),b=typeof n=="function"?n(m,i,g,d,x):n;if(b){let[A,u]=f?f(m,i,g,d,x):[h,h+v];ne(o,i,g,d,x,r,t,b,A,u,l)}h+=v}a&&po(o,c,t,a,!0),s&&po(o,c,r,s,!1)}function Eo(o,e,r,t,n,a,s,f,{ux:l=1,uz:c=0,topo:p=!0,base:h=!1,lados:m=null}={}){let i=-c,g=l,d=(v,b)=>[e+l*t*v+i*n*b,r+c*t*v+g*n*b],x=[...d(-1,-1),...d(1,-1),...d(1,1),...d(-1,1)];I(o,x,a,s,{paredes:m??f,topo:p?f:null,base:h?f:null})}function R(o,e,r,t,n,a,s,f,l={}){Eo(o,(e+n)/2,(t+s)/2,(n-e)/2,(s-t)/2,r,a,f,l)}function B(o,e,r,t,n,a,s,f,l,{topo:c=!0,base:p=!1,a0:h=0}={}){let m=[];for(let x=0;x<f;x++){let v=h+x/f*Math.PI*2;m.push(Math.cos(v),Math.sin(v))}let i=(a-s)/Math.max(1e-6,n-t),g=Math.hypot(1,i);for(let x=0;x<f;x++){let v=m[2*x],b=m[2*x+1],A=m[2*((x+1)%f)],u=m[2*((x+1)%f)+1],y=x/f*Math.PI*2*a,E=(x+1)/f*Math.PI*2*a,z=[v/g,i/g,b/g],O=[A/g,i/g,u/g],w=o.v(e+v*a,t,r+b*a,...z,y,t,l),T=o.v(e+A*a,t,r+u*a,...O,E,t,l),H=o.v(e+A*s,n,r+u*s,...O,E,n,l),P=o.v(e+v*s,n,r+b*s,...z,y,n,l);o.tri(w,T,H),o.tri(w,H,P)}let d=x=>m.map((v,b)=>(b%2?r:e)+v*x);c&&s>0&&po(o,d(s),n,l,!0),p&&a>0&&po(o,d(a),t,l,!1)}function Et(o,e,r,t,n,a,s,f,l=!0){let c=l?1:-1;for(let p=0;p<s;p++){let h=p/s*Math.PI*2,m=(p+1)/s*Math.PI*2,i=(b,A)=>[e+Math.cos(A)*b,r,t+Math.sin(A)*b],g=i(n,h),d=i(a,h),x=i(a,m),v=i(n,m);o.quad(g,d,x,v,[0,c,0],[g[0],g[2]],[d[0],d[2]],[x[0],x[2]],[v[0],v[2]],f)}}function Ye(o,e,r,t,n,a,{ex:s=1,ez:f=1,rot:l=0,fecharTopo:c=!1}={}){let p=Math.cos(l),h=Math.sin(l),m=(d,x,v)=>{let b=Math.cos(v)*d*s,A=Math.sin(v)*d*f;return[e+p*b+h*A,x,r-h*b+p*A]},i=t.map((d,x)=>{let[v,b]=t[Math.max(0,x-1)],[A,u]=t[Math.min(t.length-1,x+1)],y=Math.hypot(A-v,u-b)||1;return[(u-b)/y,-(A-v)/y]}),g=(d,x)=>{let v=Math.cos(x)/s,b=Math.sin(x)/f,A=Math.hypot(v,b)||1;return v=v/A*i[d][0],b=b/A*i[d][0],[p*v+h*b,i[d][1],-h*v+p*b]};for(let d=0;d+1<t.length;d++){let[x,v]=t[d],[b,A]=t[d+1];for(let u=0;u<n;u++){let y=u/n*Math.PI*2,E=(u+1)/n*Math.PI*2,z=y*Math.max(x,b),O=E*Math.max(x,b),w=(U,S,D,to,io)=>{let Ho=m(U,S,D);return o.v(Ho[0],Ho[1],Ho[2],...g(to,D),io,S,a)},T=w(x,v,y,d,z),H=w(x,v,E,d,O),P=w(b,A,E,d+1,O),eo=w(b,A,y,d+1,z);o.tri(T,H,P),o.tri(T,P,eo)}}if(c){let[d,x]=t[t.length-1];if(d>0){let v=[];for(let b=0;b<n;b++){let A=m(d,x,b/n*Math.PI*2);v.push(A[0],A[2])}po(o,v,x,a,!0)}}}function J(o,e=0,r=0){let t=Math.imul(o|0,668265261)^Math.imul(e|0,374761393)^Math.imul(r|0,1640531527);return t=Math.imul(t^t>>>15,2246822507),t=Math.imul(t^t>>>13,3266489909),((t^t>>>16)>>>0)/4294967296}var Po=["#3b4a2b","#445233","#34432a","#4b5536","#3f4d33"],oa=_("#4a3f35",{rugo:.9});function To(o,e,r,t,{altura:n=8,raio:a=3,semente:s=0,tipo:f="copa",detalhe:l=1}={}){let c=J(s,7),p=_(Po[Math.floor(c*Po.length)%Po.length],{rugo:.85,padrao:G.folha});if(f==="palmeira"){let i=Math.max(.18,n*.012),g=r+n-2.6;B(o,e,t,r,g,i*1.3,i,l>=2?7:5,_("#9a948a",{rugo:.8}),{topo:!1}),B(o,e,t,g,r+n+.3,i*1.25,i*1.05,l>=2?7:5,_("#5b6a3a",{rugo:.7}),{topo:!0});let d=l>=2?14:l>=1?11:8,x=_(Po[Math.floor(c*Po.length)%Po.length],{rugo:.8,padrao:G.folha}),v=(b,A,u,y,E)=>{o.quad(b,A,u,y,E,[0,0],[1,0],[1,1],[0,1],x),o.quad(b,A,u,y,[-E[0],-E[1],-E[2]],[0,0],[1,0],[1,1],[0,1],x)};for(let b=0;b<d;b++){let A=b/d*Math.PI*2+c*3+.4*J(s,b,2),u=Math.cos(A),y=Math.sin(A),E=a*(.95+.3*J(s,b)),z=.4+.9*J(s,b,3),O=r+n+.2,w=[0,.3,.62,1].map((U,S)=>{let D=E*U,to=O+E*(.55*U-z*U*U)+(S===0?0:.2);return[e+u*D,to,t+y*D]}),T=[.15,.75,.55,0],H=-y,P=u,eo=[u*.2,.96,y*.2];for(let U=0;U<3;U++){let[S,D]=[w[U],w[U+1]],[to,io]=[T[U],T[U+1]];v([S[0]+H*to,S[1]-to*.3,S[2]+P*to],[D[0]+H*io,D[1]-io*.3,D[2]+P*io],[D[0]-H*io,D[1]-io*.3,D[2]-P*io],[S[0]-H*to,S[1]-to*.3,S[2]-P*to],eo)}}return}let h=n*.38;B(o,e,t,r,r+h+a*.3,.22,.16,5,oa,{topo:!1,a0:c*2});let m=l>=2?5:l>=1?4:2;for(let i=0;i<m;i++){let g=c*6.28+i*2.4,d=i?a*(.38+.12*J(s,i,3)):0,x=e+Math.cos(g)*d,v=t+Math.sin(g)*d,b=r+h+a*(i?.5+.35*J(s,i,5):.85),A=a*(i?.62:.8);re(o,x,b,v,A,A*.78,p,s*7+i)}}var te=(()=>{let o=(1+Math.sqrt(5))/2;return{v:[[-1,o,0],[1,o,0],[-1,-o,0],[1,-o,0],[0,-1,o],[0,1,o],[0,-1,-o],[0,1,-o],[o,0,-1],[o,0,1],[-o,0,-1],[-o,0,1]].map(t=>{let n=Math.hypot(...t);return t.map(a=>a/n)}),t:[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]]}})();function re(o,e,r,t,n,a,s,f){let l=o.vertices;te.v.forEach((c,p)=>{let h=.8+.36*J(f,p),m=e+c[0]*n*h,i=r+c[1]*a*h*(c[1]<0?.6:1),g=t+c[2]*n*h,d=.82+.3*J(f,p,9)+(c[1]>0?.1:-.12);o.v(m,i,g,c[0],c[1]*.8+.25,c[2],m,g,[s[0]*d,s[1]*d,s[2]*d,s[3]])});for(let[c,p,h]of te.t)o.tri(l+c,l+p,l+h)}var zt=Object.freeze({leve:0,media:1,alta:2,ultra:3,pc:2}),se="#cbbb9d",M={travertino:_("#c9bda6",{rugo:.72,padrao:G.pedra}),granito:_("#625d57",{rugo:.55,padrao:G.pedra}),piso:_("#b4aa99",{rugo:.8,padrao:G.piso}),pisoEscuro:_("#8d857a",{rugo:.75,padrao:G.piso}),bronze:_(se,{rugo:.45,metal:.8,padrao:G.metal}),champanhe:_("#d8caa9",{rugo:.38,metal:.8,padrao:G.metal}),laje:_("#bfb092",{rugo:.45,metal:.8,padrao:G.metal}),ouro:_("#c9a86a",{rugo:.25,metal:1}),laca:_("#1c1c1e",{rugo:.28}),metalEscuro:_("#34363a",{rugo:.5,metal:.6}),forro:_("#d6cdbd",{rugo:.7,luz:fo.forro}),forroMarquise:_("#cfc5b4",{rugo:.7,luz:fo.forro}),aro:_("#e8dcc4",{rugo:.3,metal:.4,luz:fo.aro}),forroHeli:_("#a39a8a",{rugo:.4,metal:.7,luz:fo.reflexo,padrao:G.metal}),obstaculo:_("#7a1a14",{rugo:.4,luz:fo.obstaculo}),piscina:_("#1f3d45",{rugo:.05,metal:.2,luz:fo.piscina,padrao:G.agua}),jardim:_("#3d4a2c",{rugo:.9,padrao:G.folha}),jardineira:_("#7d766b",{rugo:.8}),grama:_("#4d5a33",{rugo:.95,padrao:G.grama}),portuguesa:_("#8c877c",{rugo:.85,padrao:G.portuguesa}),espelho:_("#1a2a2e",{rugo:.03,metal:.15,padrao:G.agua}),coroa:_("#d0bf9c",{rugo:.4,metal:.8,luz:fo.coroa,padrao:G.metal}),cobertura:_("#3a3b3d",{rugo:.7}),led:_("#e6dfd2",{rugo:.3,metal:.3,luz:fo.led})},j={cortina:vo(lo.cortina,.11),costura:vo(lo.costura,.37),quina:vo(lo.costura,.37,1),vento:vo(lo.vento,.53),saguao:vo(lo.saguao,.71),lanterna:[lo.lanterna,.29,0,1],parapeito:vo(lo.parapeito,.83)},Z=co,C=Z.planta.largura/2,L=-Z.planta.comprimento/2,oo=Z.planta.comprimento/2,W=L+Z.laminas[0].fundo,q=W+Z.laminas[1].fundo,gt=Z.pavimentos.altura,wo=.8,V=1.5,no={meia:Z.faceLisa.costura/2,fundo:Z.faceLisa.recuoCostura},$={meia:1.2,fundo:2.5},uo=Z.aletas.passo,N={fundo:Z.aletas.fundo,meia:Z.aletas.espessura/2},Mo={fundo:Z.montantes.fundo,meia:Z.montantes.espessura/2};function Co(o=co,{gemea:e=!1,base:r=0}={}){let t=o.laminas.map(i=>i.topo),[n,a]=o.andaresDeVento,s=o.podio.altura,f=o.heliponto,l={x:C-V,z0:L,z1:L+o.coroa.fundo,y0:o.coroa.base,yVidro:o.coroa.base+o.coroa.altura-o.coroa.oca,y1:f?f.cota-f.espessura:o.altura},c=f?{x:0,z:L+o.coroa.fundo+f.balanco-f.diametro/2,r:f.diametro/2,y1:f.cota,y0:f.cota-f.espessura}:null,p=o.mastro?{x:0,z:o.mastro.z,r:o.mastro.raio,topo:o.mastro.topo}:null,h=e?{...o.podio,tras:0,marquise:0}:o.podio,m=Math.max(s,r);return{spec:o,gemea:e,TOPO:t,VENTO1:n,VENTO2:a,PODIO:s,COROA:l,HELI:c,MASTRO:p,PD:h,BASE:m,semPodio:r>s,PODIO_X:h.largura/2,PODIO_Z0:L-h.tras,PODIO_Z1:oo+h.frente,LAMINAS_Z:[{z0:L+V,z1:W-$.meia,topo:t[0]},{z0:W+$.meia,z1:q-$.meia,topo:t[1]},{z0:q+$.meia,z1:oo-V,topo:t[2]}],bases:[s,n.base+n.altura,a.base+a.altura],topo:p?p.topo:o.altura}}var So=Co(co),zo=(o,e,r,t,n)=>Math.abs(t-e)>=Math.abs(n-r)?[e+C,t+C]:[r-L,n-L];function Xo({x:o=C,z0:e=L,z1:r=oo,entalhe:t=V,costura:n=!0,fendas:a=[]}){let s=[],f=[],l=(m,i,g)=>{s.push(m,i),f.push(g)},c=t;l(-o+c,e,"face"),n&&(l(-no.meia,e,"costura"),l(-no.meia,e+no.fundo,"costura"),l(no.meia,e+no.fundo,"costura"),l(no.meia,e,"face")),l(o-c,e,"entalhe"),c&&l(o-c,e+c,"entalhe"),l(o,e+c,"face");for(let m of a)l(o,m-$.meia,"fenda"),l(o-$.fundo,m-$.meia,"fenda"),l(o-$.fundo,m+$.meia,"fenda"),l(o,m+$.meia,"face");l(o,r-c,"entalhe"),c&&l(o-c,r-c,"entalhe"),l(o-c,r,"face"),l(-o+c,r,"entalhe"),c&&l(-o+c,r-c,"entalhe"),l(-o,r-c,"face");for(let m of[...a].reverse())l(-o,m+$.meia,"fenda"),l(-o+$.fundo,m+$.meia,"fenda"),l(-o+$.fundo,m-$.meia,"fenda"),l(-o,m-$.meia,"face");l(-o,e+c,"entalhe"),c&&l(-o+c,e+c,"entalhe");let p=[],h=[];for(let m=0;m<s.length/2;m++){let i=p.length;if(i&&Math.abs(p[i-2]-s[2*m])<1e-6&&Math.abs(p[i-1]-s[2*m+1])<1e-6){h[h.length-1]=f[m];continue}p.push(s[2*m],s[2*m+1]),h.push(f[m])}return{poly:p,papel:h}}function At(o=So){let{VENTO1:e,VENTO2:r,PODIO:t,TOPO:n,BASE:a}=o,s=e.recuo,f=r.recuo,l=e.base+e.altura,c=r.base+r.altura;return[{nome:"l123",y0:a,y1:e.base,z1:oo,fendas:[W,q],base:t},{nome:"vento1",y0:e.base,y1:l-wo,x:C-s,z0:L+s,z1:q-s,entalhe:0,costura:!1,vento:!0,base:e.base},{nome:"laje1",y0:l-wo,y1:l,z1:q,fendas:[W],laje:!0},{nome:"l12",y0:l,y1:r.base,z1:q,fendas:[W],base:l},{nome:"vento2",y0:r.base,y1:c-wo,x:C-f,z0:L+f,z1:q-f,entalhe:0,costura:!1,vento:!0,base:r.base},{nome:"laje2",y0:c-wo,y1:c,z1:q,fendas:[W],laje:!0},{nome:"l1",y0:c,y1:n[0],z1:W,fendas:[],base:c}]}function X(o,e,r,t=uo,n=.15){let a=[],s=Math.ceil((o+n-r)/t-1e-9),f=Math.floor((e-n-r)/t+1e-9);for(let l=s;l<=f;l++)a.push(r+l*t);return a}var ie=o=>gt*(2.5-1.6*o);function ce(o,e){let{y0:r}=e.COROA,t=e.HELI?e.HELI.y1:e.spec.altura;for(let n=0;n<o.c.length/4;n++){if((Math.round(o.c[4*n+3])>>4&15)!==fo.coroa)continue;let s=o.p[3*n+1];o.uv[2*n+1]=Math.max(0,Math.min(1,(s-r)/Math.max(1,t-r)))*30}return o}function nt({nivel:o=1,comEsplanada:e=!1,spec:r=co,gemea:t=!1,base:n=0}={}){let a=Co(r,{gemea:t,base:n}),{COROA:s,TOPO:f,BASE:l,VENTO1:c,VENTO2:p,LAMINAS_Z:h}=a,m=new Y("vidro"),i=new Y("opaco");for(let u of At(a)){let{poly:y,papel:E}=Xo({x:u.x??C,z0:u.z0??L,z1:u.z1,entalhe:u.entalhe??V,costura:u.costura??!0,fendas:u.fendas??[]});if(u.laje){I(i,y,u.y0,u.y1,{paredes:M.laje,uFn:zo,base:M.forro,topo:M.piso});continue}if(u.vento){I(m,y,u.y0,u.y1,{paredes:j.vento,uFn:zo,vBase:u.base});continue}I(m,y,u.y0,u.y1,{paredes:z=>E[z]==="face"?j.cortina:E[z]==="costura"?j.costura:j.quina,uFn:zo,vBase:u.base}),po(i,y,u.y1,M.piso,!0)}{let{poly:u,papel:y}=Xo({x:s.x,z0:s.z0,z1:s.z1,entalhe:0,costura:!0,fendas:[]});if(I(m,u,s.y0,s.yVidro,{paredes:E=>y[E]==="costura"?j.costura:j.lanterna,uFn:zo,vBase:s.y0}),po(i,u,s.yVidro,M.cobertura,!0),R(i,-4.5,s.yVidro,s.z0+6,4.5,a.HELI?s.y1:s.yVidro+(s.y1-s.yVidro)*.35,s.z1-5,M.metalEscuro),o>=1){for(let E of X(-s.x,s.x,-C+uo/2))R(i,E-.06,s.y0,s.z1,E+.06,s.yVidro,s.z1+.18,M.bronze,{topo:!1});for(let E of[-1,1])for(let z of X(s.z0,s.z1,L+uo/2))R(i,Math.min(E*s.x,E*(s.x+.18)),s.y0,z-.06,Math.max(E*s.x,E*(s.x+.18)),s.yVidro,z+.06,M.bronze,{topo:!1})}wt(i,-(C+N.fundo),s.z0-Mo.fundo,C+N.fundo,s.z1+N.fundo,s.y1-.5,s.y1,.45,M.coroa),a.HELI||ue(i,s)}let g=(u,y)=>{let E=h[u];if(u===0&&y<=s.z1)return s.y1-.5;let z=u===0?s.z1:E.z0,O=Math.max(0,Math.min(1,(y-z)/Math.max(1,E.z1-z)));return E.topo+ie(O)};for(let u of[-1,1])for(let y=0;y<3;y++){let E=h[y];for(let z of X(E.z0,E.z1,L))ta(i,u,z,l,g(y,z),o,a)}let d=(u,y,E,z,O,w=M.bronze)=>{let T=y+E*Mo.fundo/2;R(i,u-Mo.meia,z,T-Mo.fundo/2,u+Mo.meia,O,T+Mo.fundo/2,w,{topo:!0})},x=X(-C+V,C-V,-C).filter(u=>Math.abs(u)>no.meia+.25);for(let u of x)d(u,L,-1,l,s.yVidro),d(u,L,-1,s.yVidro,s.y1-.5,M.coroa);let v=[{z:oo,y0:l,y1:f[2]+a.spec.parapeito},{z:q,y0:f[2],y1:f[1]+a.spec.parapeito},{z:W,y0:f[1],y1:f[0]+a.spec.parapeito}];for(let u of v)for(let y of X(-C+V,C-V,-C))d(y,u.z,1,u.y0,u.y1);if(o>=1)for(let u of[c,p]){let y=C-u.recuo,E=L+u.recuo,z=q-u.recuo,O=u.base,w=u.base+u.altura-wo;for(let T of X(-y,y,-C,uo*2))R(i,T-.07,O,E-.2,T+.07,w,E,M.bronze,{topo:!1}),R(i,T-.07,O,z,T+.07,w,z+.2,M.bronze,{topo:!1});for(let T of X(E,z,L,uo*2))R(i,-y-.2,O,T-.07,-y,w,T+.07,M.bronze,{topo:!1}),R(i,y,O,T-.07,y+.2,w,T+.07,M.bronze,{topo:!1})}for(let u of X(-s.x,s.x,-C))R(i,u-N.meia,s.y0,s.z1,u+N.meia,s.y1-.5,s.z1+N.fundo,M.coroa);if(o>=1){let u=N.meia*.7,y=N.fundo*.8;for(let E of X(-s.x,s.x,-C+uo/2))R(i,E-u,s.y0,s.z1,E+u,s.y1-.5,s.z1+y,M.coroa,{topo:!1});for(let E of[-1,1])for(let z of X(L+V,s.z1,L+uo/2)){let O=E*C,w=E*(C+y);R(i,Math.min(O,w),s.y0,z-u,Math.max(O,w),s.y1-.5,z+u,M.coroa,{topo:!1})}}let b=a.spec.faceLisa.passoCostura;for(let u of X(-no.meia,no.meia,-no.meia+b/2,b,.05))R(i,u-.12,l,L-.35,u+.12,s.y1-.5,L+no.fundo,o>=1?M.champanhe:M.bronze);if(o>=1){let u=o>=2?12:8;for(let y of[c,p]){let E=y.base,z=y.base+y.altura-wo,O=C-y.recuo/2;for(let w of[-1,1])for(let T of[-19.5,-10.5,-1.5,7.5])B(i,w*O,T,E,z,.55,.55,u,M.travertino,{topo:!1});for(let w of[-12,-6,6,12])B(i,w,L+y.recuo/2,E,z,.55,.55,u,M.travertino,{topo:!1});for(let w of[-12,-6,0,6,12])B(i,w,q-y.recuo/2,E,z,.55,.55,u,M.travertino,{topo:!1})}}return[{y:f[2],z0:q,z1:oo,arvores:[4,7,8,10][o]},{y:f[1],z0:W,z1:q,arvores:[4,10,10,12][o]},{y:f[0],z0:s.z1,z1:W,arvores:[2,5,5,6][o]}].forEach((u,y)=>{let E=C-V-.3;R(m,-E,u.y,u.z1-.35,E,u.y+a.spec.parapeito,u.z1-.3,j.parapeito,{topo:!1});for(let z of[-1,1])R(m,z*(C-.35)-.03,u.y,u.z0+.3,z*(C-.35)+.03,u.y+a.spec.parapeito,u.z1-1.8,j.parapeito,{topo:!1});R(i,-E+.2,u.y,u.z1-1.9,E-.2,u.y+.9,u.z1-.5,M.jardineira,{topo:!1}),R(i,-E+.25,u.y+.88,u.z1-1.85,E-.25,u.y+.92,u.z1-.55,M.jardim);for(let z of[-1,1])R(i,z*(C-2.6),u.y,u.z0+.6,z*(C-1),u.y+.9,u.z1-2,M.jardineira,{topo:!1}),R(i,z*(C-2.55),u.y+.88,u.z0+.65,z*(C-1.05),u.y+.92,u.z1-2.05,M.jardim);R(i,-C+4,u.y,u.z0+1.2,C-4,u.y+.08,u.z1-2.4,M.pisoEscuro);for(let z=0;z<u.arvores;z++){let O=(z+.5)/u.arvores,w=-E+1.5+O*(2*E-3);To(i,w,u.y+.9,u.z1-1.2,{altura:5+1.5*J(y,z),raio:1.6+.4*J(z,y),semente:y*31+z,detalhe:o})}}),a.semPodio?fe(m,i,o,a):ea(m,i,o,a),le(i,a),a.HELI&&aa(i,o,a),e&&Tt(i,o,a),ce(i,a),{vidro:m,opaco:i}}function fe(o,e,r,t){let n=t.BASE,a=s=>[-C-s,L-s,C+s,L-s,C+s,oo+s,-C-s,oo+s];if(I(e,a(2.4),n-.6,n+.15,{paredes:M.granito,topo:M.pisoEscuro}),I(o,a(-1.5),n+.15,n+7,{paredes:j.saguao}),I(e,a(2.2),n+7,n+7.6,{paredes:M.bronze,base:M.forroMarquise,topo:M.cobertura}),r>=1)for(let s of Rt(a(1.1),9))Eo(e,s.x,s.z,.35,.35,n+.15,n+7,M.bronze,{ux:s.ux,uz:s.uz,topo:!1})}function le(o,e){let r=e.spec.led.largura/2,t=(s,f,l,c)=>R(o,s-r,l,f-r,s+r,c,f+r,M.led,{topo:!1}),n=e.LAMINAS_Z,a=C-V+r;for(let s of[-1,1])t(s*a,L+V-r,e.BASE+7.6,e.COROA.y0),t(s*a,oo-V+r,e.BASE+7.6,n[2].topo),t(s*a,q-V+r,n[2].topo,n[1].topo),t(s*a,W-V+r,n[1].topo,n[0].topo)}function ue(o,e){for(let r of[-1,1])for(let t of[e.z0+.6,e.z1-.6]){let n=r*(C-.4);R(o,n-.35,e.y1,t-.35,n+.35,e.y1+.7,t+.35,M.obstaculo)}}function ta(o,e,r,t,n,a,s,f=M.bronze){let l=e*C,c=e*(C+N.fundo),p=l+e*N.fundo*.62,h=(m,i)=>R(o,Math.min(l,p),m,r-N.meia,Math.max(l,p),i,r+N.meia,f,{base:a>=2});if(a>=1){if(R(o,Math.min(p,c),t,r-N.meia*.42,Math.max(p,c),n+.3,r+N.meia*.42,M.champanhe),a>=2){let[m,i,g]=s.bases,d=t;for(;d<n-.2;){let x=d<s.VENTO1.base?m:d<s.VENTO2.base?i:g,v=d<s.VENTO1.base?gt:2*gt,b=Math.min(n,x+Math.floor((d-x)/v+1+1e-6)*v);h(d,Math.max(d+.1,b-.12)),d=b}return}h(t,n);return}R(o,Math.min(l,c),t,r-N.meia,Math.max(l,c),n,r+N.meia,f)}function Q(o=0,e=So){let r=e.PODIO_X+o,t=e.PODIO_Z0-o,n=e.PODIO_Z1+o,a=e.PD.chanfro+o*.41;return[-r+a,t,r-a,t,r,t+a,r,n-a,r-a,n,-r+a,n,-r,n-a,-r,t+a]}function Rt(o,e,r=1.2){let t=ho(o),n=t.length/2,a=[];for(let s=0;s<n;s++){let f=t[2*s],l=t[2*s+1],c=t[2*((s+1)%n)],p=t[2*((s+1)%n)+1],h=Math.hypot(c-f,p-l),m=Math.max(1,Math.round((h-2*r)/e));for(let i=0;i<=m;i++){let g=(r+(h-2*r)*i/m)/h;a.push({x:f+(c-f)*g,z:l+(p-l)*g,ux:(c-f)/h,uz:(p-l)/h})}}return a}function ea(o,e,r,t){let{PD:n,PODIO_X:a,PODIO_Z0:s,PODIO_Z1:f}=t,l=-3,c=n.embasamento,p=n.marquiseCota,h=n.altura;I(e,Q(1,t),l,c,{paredes:M.granito,topo:M.pisoEscuro}),I(o,Q(-1.8,t),c,p,{paredes:j.saguao});for(let g of Rt(Q(-.7,t),n.passoPilares))Eo(e,g.x,g.z,n.pilar/2,n.pilar/2,c,p,M.travertino,{ux:g.ux,uz:g.uz,topo:!1}),r>=1&&(Eo(e,g.x,g.z,n.pilar/2+.12,n.pilar/2+.12,c,c+.6,M.bronze,{ux:g.ux,uz:g.uz}),Eo(e,g.x,g.z,n.pilar/2+.1,n.pilar/2+.1,p-.5,p,M.bronze,{ux:g.ux,uz:g.uz,topo:!1,base:!0}));I(e,Q(0,t),p,h-.4,{paredes:M.travertino,base:M.forroMarquise}),I(e,Q(.25,t),h-.4,h,{paredes:M.bronze,topo:M.piso});let m=ho(Q(-.4,t));for(let g=0;g<m.length/2;g++){let d=(g+1)%(m.length/2),x=m[2*g],v=m[2*g+1],b=m[2*d],A=m[2*d+1],u=Math.hypot(b-x,A-v);Eo(o,(x+b)/2,(v+A)/2,u/2,.03,h,h+1.1,j.parapeito,{ux:(b-x)/u,uz:(A-v)/u,topo:!1})}if(n.marquise>0){let g=s,d=s-n.marquise,x=n.marquiseLargura/2;R(e,-x,p-n.marquiseEspessura,d,x,p,g,M.bronze,{base:!1}),R(e,-x+.3,p-n.marquiseEspessura-.02,d+.3,x-.3,p-n.marquiseEspessura+.01,g,M.forroMarquise,{topo:!1,base:!0,lados:!1});for(let v=0;v<3;v++)R(e,-x+2+v,l,g-1-(3-v)*.8,x-2-v,(v+1)*c/3,g-1,M.granito);if(r>=1){let v=s+1.2;for(let A of[-6,0,6])B(o,A,v,c,c+3.2,1.6,1.6,12,j.saguao,{topo:!1}),B(e,A,v,c+3.2,c+3.6,1.75,1.75,12,M.bronze,{topo:!0,base:!0}),B(e,A,v,c,c+3.2,.09,.09,4,M.bronze,{topo:!1});let b=s-.14;R(e,-1.45,p+1.2,b,-.85,p+4.4,s,M.champanhe,{base:!0}),R(e,.85,p+1.2,b,1.45,p+4.4,s,M.champanhe,{base:!0}),R(e,-.85,p+2.55,b,.85,p+3.05,s,M.champanhe,{base:!0})}}R(e,-15,h-.3,oo+3,15,h+.02,f-1.5,M.piscina,{lados:M.travertino});let i=[6,12,16,22][r];for(let g=0;g<i;g++){let d=g%2?1:-1,x=Math.floor(g/2)/Math.max(1,Math.ceil(i/2)-1),v=s+3+x*(f-s-10),b=d*(a-3.5);R(e,b-1.6,h,v-1.6,b+1.6,h+.8,v+1.6,M.jardineira,{topo:!1}),R(e,b-1.5,h+.78,v-1.5,b+1.5,h+.82,v+1.5,M.jardim),To(e,b,h+.8,v,{altura:6+2*J(g,5),raio:2+.6*J(g,9),semente:700+g,detalhe:r})}}function mo(o=0,e=16,r=So){let{COROA:t}=r,n=t.x+.5+o,a=t.z0+.6-o,s=t.z1,f=t.z1+r.spec.heliponto.balanco+o,l=[-n,a,n,a];for(let c=0;c<=e;c++){let p=c/e*Math.PI;l.push(Math.cos(p)*n,s+Math.sin(p)*(f-s))}return l}function me(o,e,r,t,n,a){let s=[r[0]-e[0],r[1]-e[1],r[2]-e[2]],f=Math.hypot(s[0],s[1],s[2]);if(f<1e-6)return;let l=[s[0]/f,s[1]/f,s[2]/f],c=Math.abs(l[1])<.9?[0,1,0]:[1,0,0],p=[l[1]*c[2]-l[2]*c[1],l[2]*c[0]-l[0]*c[2],l[0]*c[1]-l[1]*c[0]],h=Math.hypot(...p);p=p.map(i=>i/h);let m=[l[1]*p[2]-l[2]*p[1],l[2]*p[0]-l[0]*p[2],l[0]*p[1]-l[1]*p[0]];for(let i=0;i<n;i++){let g=i/n*Math.PI*2,d=(i+1)/n*Math.PI*2,x=(g+d)/2,v=y=>[Math.cos(y)*p[0]+Math.sin(y)*m[0],Math.cos(y)*p[1]+Math.sin(y)*m[1],Math.cos(y)*p[2]+Math.sin(y)*m[2]],b=v(g),A=v(d),u=(y,E)=>[y[0]+E[0]*t,y[1]+E[1]*t,y[2]+E[2]*t];o.quad(u(e,b),u(e,A),u(r,A),u(r,b),v(x),[g*t,0],[d*t,0],[d*t,f],[g*t,f],a)}}function wt(o,e,r,t,n,a,s,f,l){R(o,e,a,r,t,s,r+f,l,{base:!0}),R(o,e,a,n-f,t,s,n,l,{base:!0}),R(o,e,a,r+f,e+f,s,n-f,l,{base:!0}),R(o,t-f,a,r+f,t,s,n-f,l,{base:!0})}function pe(o,e,r,t,n,a){let s=ho(e),f=s.length/2;for(let l=0;l<f;l++){let c=s[2*l],p=s[2*l+1],h=s[2*((l+1)%f)],m=s[2*((l+1)%f)+1],i=Math.hypot(h-c,m-p);if(i<1e-6)continue;let g=(m-p)/i,d=-(h-c)/i,x=(v,b,A)=>[v-g*A,r,b-d*A];o.quad(x(c,p,t),x(h,m,t),x(h,m,t+n),x(c,p,t+n),[0,1,0],[c,p],[h,m],[h,m],[c,p],a)}}function de(o,e,r,t,n,a,s){let f=ho(e),l=f.length/2,c=i=>r-a*Math.max(0,Math.min(1,1-(i-t)/Math.max(1,n-t))),{pontos:p,indices:h}=Mt(f),m=o.vertices;for(let i=0;i<p.length/2;i++){let g=p[2*i],d=p[2*i+1];o.v(g,c(d),d,0,-1,.2,g,d,s)}for(let i=0;i<h.length;i+=3)o.tri(m+h[i],m+h[i+1],m+h[i+2]);for(let i=0;i<l;i++){let g=f[2*i],d=f[2*i+1],x=f[2*((i+1)%l)],v=f[2*((i+1)%l)+1],b=c(d),A=c(v);if(b>r-.001&&A>r-.001)continue;let u=Math.hypot(x-g,v-d)||1,y=[(v-d)/u,0,-(x-g)/u];o.quad([g,b,d],[x,A,v],[x,r,v],[g,r,d],y,[0,b],[u,A],[u,r],[0,r],M.metalEscuro)}}function aa(o,e,r){let{HELI:t,COROA:n,MASTRO:a}=r,s=[8,20,24,28][e],{y0:f,y1:l}=t,c=mo(0,s,r);I(o,c,f,l-.35,{paredes:M.metalEscuro}),I(o,mo(.05,s,r),l-.35,l,{paredes:M.coroa,topo:M.laca}),de(o,c,f,n.z1,n.z1+r.spec.heliponto.balanco,3.2,M.forroHeli);let p=ho(mo(.05,s,r)),h=p.length/2;for(let g=0;g<h;g++){let d=p[2*g],x=p[2*g+1],v=p[2*((g+1)%h)],b=p[2*((g+1)%h)+1],A=Math.hypot(v-d,b-x);if(A<1e-6)continue;let u=(b-x)/A,y=-(v-d)/A,E=(z,O,w,T)=>[z+u*w,T,O+y*w];for(let[z,O]of[[1,0],[-1,-.06]])o.quad(E(d,x,0,l-.3+O),E(v,b,0,l-.3+O),E(v,b,1.6,l-.95+O),E(d,x,1.6,l-.95+O),[0,z,0],[0,0],[1,0],[1,1],[0,1],M.metalEscuro)}pe(o,mo(0,s,r),l+.02,.5,.35,M.aro),Et(o,t.x,l+.02,t.z,t.r*.62,t.r*.62+.45,[24,40,56,64][e],M.ouro);let m=4.5,i=2.6;if(R(o,t.x-i-.5,l,t.z-m,t.x-i+.5,l+.03,t.z+m,M.ouro),R(o,t.x+i-.5,l,t.z-m,t.x+i+.5,l+.03,t.z+m,M.ouro),R(o,t.x-i+.5,l,t.z-.5,t.x+i-.5,l+.03,t.z+.5,M.ouro),e>=1)for(let g=0;g<16;g++){let d=g/16*Math.PI*2,x=t.r*.62-.6;R(o,t.x+Math.cos(d)*x-.2,l,t.z+Math.sin(d)*x-.2,t.x+Math.cos(d)*x+.2,l+.2,t.z+Math.sin(d)*x+.2,M.aro)}a&&(B(o,a.x,a.z,n.yVidro,a.topo-1,a.r,a.r*.45,e>=2?10:6,M.champanhe,{topo:!0}),B(o,a.x,a.z,a.topo-1,a.topo,.5,.35,6,M.obstaculo,{topo:!0}))}function Tt(o,e=1,r=So){let{PD:t,PODIO_X:n,PODIO_Z0:a,PODIO_Z1:s}=r,f=Q(24,r);if(I(o,f,-1.2,.08,{paredes:M.granito,topo:M.piso}),R(o,-34,.08,a-22,34,.1,a-1.5,M.portuguesa,{lados:!1}),R(o,-32,.08,s+3,32,.45,s+21,M.granito,{topo:!1}),R(o,-31.4,.08,s+3.6,31.4,.3,s+20.4,M.espelho,{lados:!1}),e>=1&&t.marquise>0){let c=t.marquiseLargura/2,p=a-t.marquise,h=p-1.2;for(let m=-c+1;m<=c-1+1e-6;m+=2.5)B(o,m,h,0,.95,.28,.24,6,M.granito,{topo:!0});for(let m of[-c-2,c+2])for(let i of[p-4,p-11])B(o,m,i,0,7.5,.12,.09,6,M.bronze,{topo:!1}),R(o,m-.35,7.5,i-.35,m+.35,7.8,i+.35,M.aro,{base:!0});for(let m of[-c-5.5,c+5.5])R(o,m-2.2,0,p-1,m+2.2,.9,p+7,M.granito,{topo:!1}),R(o,m-2.1,.86,p-.9,m+2.1,.9,p+6.9,M.jardim),To(o,m,.9,p+3,{altura:8,raio:3,semente:811+(m>0?1:0),detalhe:e})}let l=[4,8,10,12][e];for(let c of[-1,1]){let p=c*(n+5),h=c*(n+19);R(o,Math.min(p,h),.08,a+2,Math.max(p,h),.14,s-2,M.grama,{lados:!1});for(let i=0;i<l;i++){let g=a+6+i*(s-a-12)/Math.max(1,l-1);To(o,c*(n+16),.14,g,{tipo:"palmeira",altura:17+3*J(i,c),raio:3.6,semente:300+i*2+(c>0?1:0),detalhe:e})}let m=[1,3,4,5][e];for(let i=0;i<m;i++)To(o,c*(n+9+2*J(i,3)),.14,a+10+i*18,{altura:9,raio:3.4,semente:400+i*2+(c>0?1:0),detalhe:e})}}function Ot({comEsplanada:o=!1,spec:e=co,gemea:r=!1,base:t=0}={}){let n=Co(e,{gemea:r,base:t}),{COROA:a,TOPO:s,BASE:f,VENTO1:l,VENTO2:c,LAMINAS_Z:p,PD:h,PODIO_Z0:m,PODIO_Z1:i,HELI:g,MASTRO:d}=n,x=new Y("vidro"),v=new Y("opaco"),b=u=>vo(lo.torreLod1,.11,u),A=(u,y,E,z)=>Math.abs(z-y)>Math.abs(E-u);for(let u of At(n)){let{poly:y,papel:E}=Xo({x:u.x??C,z0:u.z0??L,z1:u.z1,entalhe:u.entalhe??V,costura:u.costura??!0,fendas:u.fendas??[]});if(u.laje){I(v,y,u.y0,u.y1,{paredes:M.laje,uFn:zo,base:M.forro,topo:M.piso});continue}if(u.vento){I(x,y,u.y0,u.y1,{paredes:(z,O,w,T,H)=>vo(lo.vento,.53,A(O,w,T,H)?1:0),uFn:zo,vBase:u.base});continue}I(x,y,u.y0,u.y1,{paredes:(z,O,w,T,H)=>E[z]==="costura"?j.costura:E[z]!=="face"?j.quina:b(A(O,w,T,H)?1:0),uFn:zo,vBase:u.base}),po(v,y,u.y1,M.piso,!0)}for(let u of[-1,1])for(let y=0;y<3;y++){let E=p[y];for(let z of X(E.z0,E.z1,L,uo)){let O=E.topo-1,w;if(y===0&&z<=a.z1)O=a.y0,w=a.y1-.5;else{let T=y===0?a.z1:E.z0;w=E.topo+ie(Math.max(0,Math.min(1,(z-T)/Math.max(1,E.z1-T))))}R(v,Math.min(u*C,u*(C+N.fundo)),O,z-N.meia,Math.max(u*C,u*(C+N.fundo)),w,z+N.meia,M.bronze)}}{let{poly:u,papel:y}=Xo({x:a.x,z0:a.z0,z1:a.z1,entalhe:0,costura:!0,fendas:[]});I(x,u,a.y0,a.yVidro,{paredes:E=>y[E]==="costura"?j.costura:j.lanterna,uFn:zo,vBase:a.y0}),po(v,u,a.yVidro,M.cobertura,!0),R(v,-4.5,a.yVidro,a.z0+6,4.5,g?a.y1:a.yVidro+(a.y1-a.yVidro)*.35,a.z1-5,M.metalEscuro);for(let E of X(-a.x,a.x,-C,uo))R(v,E-N.meia,a.y0,a.z1,E+N.meia,a.y1,a.z1+N.fundo,M.coroa);for(let E of X(-a.x,a.x,-C,uo*2))R(v,E-.3,a.yVidro,L-Mo.fundo,E+.3,a.y1,L,M.coroa);wt(v,-(C+N.fundo),a.z0-Mo.fundo,C+N.fundo,a.z1+N.fundo,a.y1-.5,a.y1,.45,M.coroa),g||ue(v,a)}for(let u of[-2,0,2])R(v,u-.3,f,L-.35,u+.3,a.y1-.5,L+no.fundo,M.champanhe);if(n.semPodio)fe(x,v,0,n);else{I(v,Q(1,n),-3,h.embasamento,{paredes:M.granito,topo:M.pisoEscuro}),I(x,Q(-1.8,n),h.embasamento,h.marquiseCota,{paredes:j.saguao});for(let u of Rt(Q(-.7,n),h.passoPilares))Eo(v,u.x,u.z,h.pilar/2,h.pilar/2,h.embasamento,h.marquiseCota,M.travertino,{ux:u.ux,uz:u.uz,topo:!1});I(v,Q(0,n),h.marquiseCota,h.altura-.4,{paredes:M.travertino,base:M.forroMarquise}),I(v,Q(.25,n),h.altura-.4,h.altura,{paredes:M.bronze,topo:M.piso}),h.marquise>0&&R(v,-h.marquiseLargura/2,h.marquiseCota-h.marquiseEspessura,m-h.marquise,h.marquiseLargura/2,h.marquiseCota,m,M.bronze,{base:!0}),R(v,-15,h.altura-.3,oo+3,15,h.altura+.02,i-1.5,M.piscina,{lados:M.travertino})}le(v,n);for(let u of[{y:s[2],z1:oo},{y:s[1],z1:q},{y:s[0],z1:W}])R(v,-C+V+.5,u.y,u.z1-1.9,C-V-.5,u.y+1.1,u.z1-.5,M.jardim);for(let u of[l,c]){let y=u.base,E=u.base+u.altura-wo,z=C-u.recuo/2,O=(w,T)=>B(v,w,T,y,E,.55,.55,8,M.travertino,{topo:!1});for(let w of[-1,1])for(let T of[-19.5,-10.5,-1.5,7.5])O(w*z,T);for(let w of[-12,-6,6,12])O(w,L+u.recuo/2);for(let w of[-12,-6,0,6,12])O(w,q-u.recuo/2)}for(let u of[{y:s[2],z0:q,z1:oo},{y:s[1],z0:W,z1:q},{y:s[0],z0:a.z1,z1:W}]){let y=C-V-.3;R(x,-y,u.y,u.z1-.35,y,u.y+n.spec.parapeito,u.z1-.3,j.parapeito,{topo:!1});for(let E of[-1,1])R(x,E*(C-.35)-.03,u.y,u.z0+.3,E*(C-.35)+.03,u.y+n.spec.parapeito,u.z1-1.8,j.parapeito,{topo:!1})}return g&&(I(v,mo(0,20,n),g.y0,g.y1-.35,{paredes:M.metalEscuro}),I(v,mo(.05,20,n),g.y1-.35,g.y1,{paredes:M.coroa,topo:M.laca}),de(v,mo(0,20,n),g.y0,a.z1,a.z1+n.spec.heliponto.balanco,3.2,M.forroHeli),pe(v,mo(0,20,n),g.y1+.02,.5,.4,M.aro),Et(v,g.x,g.y1+.02,g.z,g.r*.62,g.r*.62+.5,24,M.ouro)),d&&(B(v,d.x,d.z,a.yVidro,d.topo-1,d.r,d.r*.45,6,M.champanhe),B(v,d.x,d.z,d.topo-1,d.topo,.5,.35,6,M.obstaculo)),o&&Tt(v,0,n),ce(v,n),{vidro:x,opaco:v}}function Ct({spec:o=co,gemea:e=!1,base:r=0}={}){let t=Co(o,{gemea:e,base:r}),{TOPO:n,BASE:a,COROA:s,HELI:f,MASTRO:l,PD:c}=t,p=new Y("opaco"),h=M.cobertura,m=2.5,i=(g,d,x)=>[-g,d,g,d,g,x,-g,x];return I(p,i(C-m,L+m,oo-m),a,n[2],{paredes:h,topo:h}),I(p,i(C-m,L+m,q-m),n[2],n[1],{paredes:h,topo:h}),I(p,i(C-m,L+m,W-m),n[1],n[0],{paredes:h,topo:h}),I(p,i(s.x-m,s.z0+m,s.z1-m),n[0],f?s.y1:s.yVidro,{paredes:h,topo:h}),f&&I(p,mo(-1.5,6,t),f.y0+.2,f.y1-.2,{paredes:h,topo:h,base:h}),t.semPodio||I(p,Q(-1,t),0,c.altura-.5,{paredes:h,topo:h}),l&&B(p,l.x,l.z,n[0],l.topo-2,l.r*.6,.2,4,h),p}function he(o=So){let{COROA:e,HELI:r,PD:t,PODIO:n,PODIO_X:a,PODIO_Z0:s,PODIO_Z1:f}=o;return Object.freeze({centro:[0,(o.spec.altura+n)/2,0],heliponto:r?[r.x,r.y1,r.z]:null,entrada:[0,t.marquiseCota/2,s-t.marquise/2],coroa:[0,(e.y0+e.y1)/2,(e.z0+e.z1)/2],topo:o.topo,podio:{x:a,z0:s,z1:f}})}var na=he(So),so={bronze:M.bronze,granito:M.granito,forro:M.forro,jardim:M.jardim,jardineira:M.jardineira,piscina:M.piscina,led:M.led,deck:_("#8a7158",{rugo:.8}),branco:_("#e3e0d8",{rugo:.5})},ra=Object.freeze({lamina:0,nevoa:1,espuma:2,faixa:3});function sa(o,e,r,t,n,a,s,f,l,c=1,p=0,h=0,m=Math.PI*2){let i=[l,p,0,0],g=o.vertices;for(let x=0;x<=c;x++){let v=x/c,b=t+(n-t)*v,A=a+(s-a)*v;for(let u=0;u<=f;u++){let y=h+(m-h)*u/f;o.v(e+Math.cos(y)*A,b,r+Math.sin(y)*A,Math.cos(y),0,Math.sin(y),y*Math.max(a,s),b-t,i)}}let d=f+1;for(let x=0;x<c;x++)for(let v=0;v<f;v++){let b=g+x*d+v;o.tri(b,b+1,b+d+1),o.tri(b,b+d+1,b+d)}}var ge=o=>Co(o,{gemea:!0,base:K.podio});function ia(o,e,r){let t=K.ponte,n=K.vao/2+t.embute,{cota:a,z0:s,z1:f,espessura:l}=t,c=a-l-t.nivelFechado,p=a-l;R(e,-n,c-.6,s-.4,n,c,f+.4,so.branco,{base:!1}),R(e,-n+.4,c-.62,s,n-.4,c-.6,f,so.forro,{topo:!1,base:!0,lados:!1});for(let d of[s,f])R(o,-n,c,d-.08,n,p,d+.08,j.saguao,{topo:!1});R(e,-n,p,s-.6,n,a,f+.6,so.branco,{topo:!1}),R(e,-n,a-.02,s-.6,n,a,f+.6,so.deck,{lados:!1});for(let d of[s-.62,f+.62])R(e,-n,p+.9,d-.12,n,p+1.3,d+.12,so.led,{topo:!1});for(let d of[s-.4,f+.4])R(o,-n,a,d-.04,n,a+1.2,d+.04,j.parapeito,{topo:!1});let h=(s+f)/2;R(e,-10,a-.4,h-2.2,10,a+.04,h+2.2,so.piscina,{lados:so.granito});let m=[2,4,5,6][r];for(let d of[s+2.2,f-2.2]){R(e,-n+1.5,a,d-1.2,n-1.5,a+.9,d+1.2,so.jardineira,{topo:!1}),R(e,-n+1.6,a+.86,d-1.1,n-1.6,a+.92,d+1.1,so.jardim);for(let x=0;x<m;x++){let v=-n+3+(2*n-6)*(x+.5)/m;To(e,v,a+.9,d,{altura:4.5+1.5*J(x,Math.round(d)),raio:1.6,semente:1200+x+Math.round(d),detalhe:Math.min(r,1)})}}let i=t.pernas.cota,g=r>=2?8:6;for(let d of[-1,1]){for(let x of[s+4,f-4])me(e,[0,c-.6,x],[d*(K.vao/2-.5),i,x],.55,g,so.bronze);R(e,d*(K.vao/2)-(d>0?1.4:0),i-1.2,s+2,d*(K.vao/2)+(d>0?0:1.4),i+1.2,f-2,so.bronze)}}function xt({nivel:o=1,lod:e=0}={}){let r=new Y("vidro"),t=new Y("opaco"),n=new Y("cascata");for(let a of Yo({x:0,z:0,rot:0})){let s={spec:a.spec,gemea:!0,base:K.podio},f=e===0?nt({nivel:o,...s}):Ot(s);f.vidro.transformar(a.x,0,a.z,0),f.opaco.transformar(a.x,0,a.z,0),r.juntar(f.vidro),t.juntar(f.opaco)}return ia(r,t,e===0?o:0),{vidro:r,opaco:t,efeitos:n}}function xe(){let o=new Y("opaco");for(let r of Yo({x:0,z:0,rot:0}))o.juntar(Ct({spec:r.spec,gemea:!0,base:K.podio}).transformar(r.x,0,r.z,0));let e=K.ponte;return R(o,-K.vao/2,e.cota-e.espessura-e.nivelFechado-.6,e.z0,K.vao/2,e.cota,e.z1,M.cobertura),o}function No(o){let e=new Lo;return e.setAttribute("position",new go(o.p,3)),e.setAttribute("normal",new go(o.n,3)),e.setAttribute("aUvM",new go(o.uv,2)),e.setAttribute("aC",new go(o.c,4)),e.setIndex(o.vertices>65535?new et(o.i,1):new tt(o.i,1)),e.computeBoundingBox(),e.computeBoundingSphere(),e}var Oo={uNoite:{value:0},uHora:{value:12},uTempo:{value:0},uLodSetor:{value:Array.from({length:bt/4},()=>new ot)}},_o=Object.freeze({janela:.2,forro:.3,lanterna:.38,aro:1.2,led:.34,exposicaoNoite:8}),rt=`
uniform float uNoite;
uniform float uHora;
uniform float uTempo;
uniform float uCorte;
uniform vec4 uCorteEixo;
uniform vec4 uCorteH;
varying vec4 vC;
varying vec2 vUvM;
#define G_LUZ_JANELA ${_o.janela.toFixed(3)}
#define G_LUZ_FORRO ${_o.forro.toFixed(3)}
#define G_LUZ_LANTERNA ${_o.lanterna.toFixed(3)}
#define G_LUZ_ARO ${_o.aro.toFixed(3)}
#define G_LUZ_LED ${_o.led.toFixed(3)}
float gCorte(vec3 p){
float s=dot(p.xz - uCorteEixo.xy,uCorteEixo.zw);
float lado=s < -uCorteH.w ? uCorteH.x :(s > uCorteH.w ? uCorteH.y : uCorteH.z);
return min(uCorte,lado);
}
float gH1(vec2 p){
vec3 p3=fract(vec3(p.xyx)* 0.1031);
p3 +=dot(p3,p3.yzx + 33.33);
return fract((p3.x + p3.y)* p3.z);
}
float gRuido(vec2 p){
vec2 i=floor(p);
vec2 f=fract(p);
f=f * f *(3.0 - 2.0 * f);
float a=gH1(i);
float b=gH1(i + vec2(1.0,0.0));
float c=gH1(i + vec2(0.0,1.0));
float d=gH1(i + vec2(1.0,1.0));
return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float gRuidoF(vec2 p){
float fw=max(fwidth(p.x),fwidth(p.y));
return mix(gRuido(p),0.5,smoothstep(0.3,0.8,fw));
}
float gLinha(float x,float w){
float fw=max(fwidth(x),1e-4);
float d=abs(fract(x + 0.5)- 0.5);
float a=1.0 - smoothstep(w * 0.5 - fw,w * 0.5 + fw,d);
return mix(a,w,smoothstep(0.25,0.5,fw));
}
`,ca=`
attribute vec2 aUvM;
attribute vec4 aC;
varying vec4 vC;
varying vec2 vUvM;
`,Jo=(()=>{let o=yt(se),e=r=>r.toFixed(3);return{esp:e(Z.aletas.espessura),fundo:e(Z.aletas.fundo),mEsp:e(Z.montantes.espessura),mFundo:e(Z.montantes.fundo),cor:`vec3( ${o.map(e).join(", ")} )`}})(),fa=`
vec3 fAlb;vec3 fTint;float fMet;float fRug;vec3 fEmi;vec2 fInc;vec3 fIncM;
float fCosV=1.0;
uniform float uLinhas;
uniform vec4 uLodSetor[${bt/4}];
float gAcesas(float h){
float f=0.82;
if(h >=18.0)f=0.82 - 0.72 * pow(clamp((h - 18.0)/ 4.0,0.0,1.0),0.6);
else if(h < 6.5)f=mix(0.12,0.82,smoothstep(5.0,6.5,h));
return f;
}
float gLodSetor(float s){
int i=int(s + 0.5);
vec4 v=uLodSetor[ i / 4 ];
int c=i - 4 *(i / 4);
return c==0 ? v.x : c==1 ? v.y : c==2 ? v.z : v.w;
}
void gAletasLod1(float u){
float tg=sqrt(max(0.0,1.0 - fCosV * fCosV))/ max(fCosV,0.05);
float w=vC.z > 0.5 ? min(0.95,(${Jo.esp} + ${Jo.fundo} * tg)/ 1.5): min(0.9,(${Jo.mEsp} + ${Jo.mFundo} * tg)/ 1.5)* uLinhas;
float al=gLinha(u / 1.5,w);
fTint=mix(fTint,${Jo.cor} * mix(1.0,0.12,uNoite),al);
fMet=mix(fMet,0.8,al);
fRug=mix(fRug,0.45,al);
fAlb=mix(fAlb,vec3(0.08,0.07,0.055)* mix(1.0,0.3,uNoite),al);
fEmi *=1.0 - al;
}
void gVidroPainel(float col,float fl,float fv,float sem,float esp){
float longe=smoothstep(0.35,1.1,fwidth(vUvM.x));
float hp=mix(gH1(vec2(col,fl)+ sem * 17.0),0.5,longe);
esp=mix(esp,0.2,longe);
fTint=vec3(0.40,0.43,0.46);
fMet=0.38 + 0.04 * hp;
fRug=0.05 + 0.025 * hp;
fAlb=vec3(0.012,0.013,0.015);
float pers=step(0.84,hp)*(0.2 + 0.5 * gH1(vec2(col * 1.7,fl * 2.3)))*(1.0 - longe);
float emPers=step(0.8 - pers,fv)*(1.0 - esp)*(1.0 - longe);
fAlb=mix(fAlb,vec3(0.1,0.095,0.085),emPers * 0.6);
fTint=mix(fTint,vec3(0.38,0.40,0.42),esp);
fMet=mix(fMet,0.32,esp);
fRug=mix(fRug,0.14,esp);
fAlb=mix(fAlb,vec3(0.045,0.045,0.045),esp);
fInc=(vec2(gH1(vec2(col,fl)* 3.1 + 1.3),gH1(vec2(fl,col)* 2.3 + 7.1))- 0.5)* 0.012 *(1.0 - longe);
float ap=floor(col / 6.0);
float un=floor(col / 2.0);
float fr=gAcesas(uHora);
float ocupado=step(gH1(vec2(ap,fl)+ sem * 31.0),0.6);
float comodo=step(gH1(vec2(un * 1.7,fl * 0.3)+ sem * 13.0),fr / 0.6);
float forca=gH1(vec2(un * 1.3,fl * 0.7)+ 9.1);
float acesa=ocupado * comodo * step(0.06,hp)*(forca < 0.25 ? 0.14 : 0.55 + 0.45 * forca);
float muitoLonge=smoothstep(2.2,4.5,fwidth(vUvM.x));
float hUn=gH1(vec2(fl,ap)+ 3.7);
float unid=step(gH1(vec2(ap * 1.3,fl * 0.7)+ sem * 7.0 + 2.9),fr * 0.62)*(0.45 + 0.35 * hUn);
acesa=mix(acesa,mix(unid,fr * 0.16,muitoLonge),longe)*(1.0 - esp);
float hu=mix(hUn,0.85,muitoLonge);
vec3 corLuz=mix(vec3(1.0,0.4,0.1),vec3(1.0,0.64,0.32),hu);
float fria=mix(gH1(vec2(un * 2.3,fl * 1.1)+ 1.7),gH1(vec2(ap * 2.3,fl * 1.1)+ 1.7),longe);
corLuz=mix(corLuz,vec3(0.72,0.84,1.0),step(0.9,fria)*(1.0 - muitoLonge));
float teto=mix(0.45 + 0.55 * smoothstep(0.15,0.78,fv),0.8,longe);
fEmi=corLuz * acesa * uNoite * G_LUZ_JANELA * teto *(1.0 - emPers * 0.45);
fEmi +=vec3(0.5,0.6,0.8)* ocupado *(1.0 - acesa)* 0.006 * gH1(vec2(un,fl)* 1.9 + 4.3)* uNoite * G_LUZ_JANELA *(1.0 - longe)*(1.0 - esp);
fTint *=mix(vec3(1.0),vec3(0.5,0.58,0.75),uNoite);
}
void gLed(float u,float y,float meio,float pe,float n){
float H=n * pe;
float t=clamp((y -(meio - 0.5 * H))/ H,0.0,1.0);
float longe=smoothstep(0.2,0.6,max(fwidth(u),1e-3));
float pontos=mix(gLinha(u / 0.6,0.4)* gLinha(y / 0.6,0.4),0.16,longe);
float borda=min(t,1.0 - t);
float filete=1.0 - smoothstep(0.0,0.012 + fwidth(t),borda);
fTint=mix(vec3(0.095,0.1,0.11),vec3(0.5,0.5,0.49),filete);
fMet=mix(0.75,0.9,filete);
fRug=mix(0.07,0.25,filete);
fAlb=vec3(0.006,0.006,0.007)+ vec3(0.018,0.017,0.016)* pontos *(1.0 - filete);
fInc=vec2(0.0);
float junta=gLinha(u / 3.2,0.012);
fTint=mix(fTint,vec3(0.3),junta);
float onda=0.5 + 0.5 * sin(u / 55.0 - uTempo * 0.5 + 0.9 * sin(u / 270.0 + uTempo * 0.05)+ t * 2.4);
float veio=0.5 + 0.5 * sin(u / 21.0 + t * 1.6 - uTempo * 1.1);
float clarao=exp(-pow((mod(u - uTempo * 42.0,1150.0)- 575.0)/ 60.0,2.0));
float fria=smoothstep(0.55,1.0,sin(u / 610.0 + uTempo * 0.08));
vec3 cor=mix(vec3(1.0,0.72,0.42),vec3(0.62,0.84,1.0),fria * 0.5);
float moldura=1.0 - smoothstep(0.0,0.08,borda);
float luz=(0.18 + 0.62 * onda * onda + 0.15 * veio)*(0.7 + 0.3 * pontos)+ 0.45 * moldura + 0.8 * clarao;
fEmi=cor * luz * mix(0.004,G_LUZ_LED * 0.62,uNoite)*(1.0 - filete *(1.0 - uNoite));
}
void gVidroAnel(float u,float y,float sem,float pe,float meio,float setorLed,float painel,float dentro){
float nLed=floor(setorLed / 32.0 + 0.001);
float setor=setorLed - 32.0 * nLed;
if(abs(y - meio)< 0.5 * nLed * pe){
gLed(u,y,meio,pe,nLed);
return;
}
float yy=y / pe;
float fl=floor(yy);
float fv=fract(yy);
float col=floor(u / painel);
float fwu=max(fwidth(u),1e-3);
float fwy=max(fwidth(y),1e-3);
float longe=smoothstep(0.12,0.45,fwu / painel);
float hp=gH1(vec2(col,fl)+ sem * 17.0);
float hq=gH1(vec2(fl * 1.3,col * 0.7)+ sem * 5.3);
fTint=vec3(0.27,0.30,0.33)* mix(0.94 + 0.12 * hp,1.0,longe);
fMet=0.45;
fRug=mix(0.03 + 0.03 * hq,0.05,longe);
fAlb=vec3(0.014,0.016,0.018)* mix(0.75 + 0.5 * hq,1.0,longe);
float perto=1.0 - longe;
float onda=gRuido(vec2(u / 47.0 + sem * 11.0,fl * 0.43 + sem * 3.0))- 0.5;
fIncM.y +=(fv - 0.5)* 0.05 * perto + onda * 0.1;
fInc=(vec2(hq,gH1(vec2(col,fl)* 2.3 + 7.1))- 0.5)* 0.01 * perto;
float pers=step(0.8,hq)*(0.15 + 0.45 * gH1(vec2(col * 1.7,fl * 2.3)));
float pertoPers=1.0 - smoothstep(0.04,0.12,fwu / painel);
fAlb=mix(fAlb,vec3(0.12,0.115,0.105),step(1.0 - pers,fv)* 0.7 * pertoPers);
float somb=smoothstep(0.7,0.96,fv);
fTint *=1.0 - 0.45 * somb;
fAlb *=1.0 - 0.6 * somb;
float mont=gLinha(u / painel,0.09 / painel)* 0.6;
fTint=mix(fTint,vec3(0.5,0.5,0.49),mont);
fMet=mix(fMet,0.7,mont);
fRug=mix(fRug,0.35,mont);
fAlb=mix(fAlb,vec3(0.2,0.2,0.19),mont);
float escola=step(setor,7.5);
float fr=gAcesas(uHora);
float sala=floor(col / mix(4.0,3.0,escola));
float dorm=escola * step(0.72,gH1(vec2(fl,floor(u / 300.0))+ sem * 7.0));
float p=mix(fr,mix(fr * 0.85,0.72,dorm),escola);
float trecho=gRuido(vec2(u / 120.0 + sem * 13.0 + fl * 3.17,fl * 1.9));
float limiar=0.5 +(0.5 - p)* 0.6;
float zona=smoothstep(limiar - 0.03,limiar + 0.03,trecho);
float hs=gH1(vec2(sala * 1.31,fl * 0.71)+ sem * 29.0);
float muitoLonge=smoothstep(0.6,1.6,fwu /(painel * 4.0));
float acesa=mix(step(hs,mix(0.04,0.88,zona)),mix(0.04,0.88,zona),muitoLonge);
acesa *=0.7 + 0.3 * gH1(vec2(sala * 0.7,fl * 1.3)+ 4.1);
vec3 corLuz=mix(vec3(1.0,0.8,0.58),vec3(0.92,0.94,1.0),step(0.85,gH1(vec2(sala,fl)* 1.7 + 2.0))*(1.0 - muitoLonge));
corLuz=mix(corLuz,vec3(1.0,0.66,0.38),dorm);
float perfil=mix(0.35 + 0.65 * smoothstep(0.15,0.95,fv),0.7,longe);
fEmi=corLuz * acesa * perfil * uNoite * G_LUZ_JANELA * 0.8;
if(fl < 0.5){
float d=abs(mod(u,48.0)- 24.0);
float porta=step(d,3.2)* step(y,4.4);
float batente=(1.0 - porta)* step(d,3.8)* step(y,5.0);
fAlb=mix(fAlb,vec3(0.09,0.075,0.06),0.8 *(1.0 - somb));
fTint *=0.85;
float mPorta=max(gLinha((u - 24.0)/ 1.6,0.05),gLinha((y - 3.0)/ 10.0,0.012))* porta;
fAlb=mix(fAlb,vec3(0.03,0.025,0.02),porta * 0.6);
fTint=mix(fTint,vec3(0.26,0.17,0.09),mPorta);
fMet=mix(fMet,1.0,mPorta);
fTint=mix(fTint,vec3(0.03),batente);
fMet=mix(fMet,0.0,batente);
fRug=mix(fRug,0.7,batente);
fAlb=mix(fAlb,vec3(0.42,0.4,0.36),batente);
fEmi=vec3(1.0,0.78,0.52)*(0.35 + 0.65 * smoothstep(0.3,0.9,fv))* mix(0.004,G_LUZ_JANELA *(0.8 + 0.6 * porta),uNoite)*(1.0 - batente);
float rodape=1.0 - smoothstep(0.32,0.32 + fwy,y);
fTint=mix(fTint,vec3(0.08),rodape);
fAlb=mix(fAlb,vec3(0.02),rodape);
fMet=mix(fMet,0.6,rodape);
fRug=mix(fRug,0.5,rodape);
}
float oclusao=0.55 + 0.45 * smoothstep(0.0,2.5,y);
fTint *=oclusao;
fAlb *=oclusao;
if(uLinhas > 0.5 && gLodSetor(setor)< 0.5 && y > 0.5 * pe){
vec3 vd=normalize(cameraPosition - vGPosMundo);
float tg=clamp(vd.y / max(0.12,length(vd.xz)),-4.0,4.0)* mix(2.4,1.2,step(painel,2.0));
float dy=y -(fl + step(0.5,fv))* pe;
float testa=1.0 - smoothstep(0.25 - fwy,0.25 + fwy,abs(dy));
float topo=(1.0 - testa)* step(dy,0.0)*(1.0 - smoothstep(0.25 + max(tg,0.0)- fwy,0.25 + max(tg,0.0)+ fwy,-dy));
float forro=(1.0 - testa)* step(0.0,dy)*(1.0 - smoothstep(0.25 + max(-tg,0.0)- fwy,0.25 + max(-tg,0.0)+ fwy,dy));
float m=max(testa,max(topo,forro));
fIncM=mix(fIncM,vec3(0.0,4.0 *(topo - forro),0.0),max(topo,forro));
fTint=mix(fTint,vec3(0.03),m);
fMet=mix(fMet,0.0,m);
fRug=mix(fRug,0.6,m);
vec3 branco=mix(vec3(0.76,0.75,0.72),vec3(0.4,0.39,0.37),topo)* mix(1.0,0.82,forro);
fAlb=mix(fAlb,branco * mix(1.0,0.18,uNoite),m);
fEmi=mix(fEmi,vec3(1.0,0.86,0.66)* uNoite *(0.006 + 0.05 * acesa * forro),m);
}
if(dentro > 0.5 && fl > 0.5){
float d=(1.0 - fv)* pe - 0.3;
float comp=0.9 + 1.7 * gRuidoF(vec2(u / 5.5 + fl * 1.9 + sem * 7.0,fl * 0.7));
float franja=0.35 * gRuidoF(vec2(u / 0.8,fl * 3.1));
float cob=step(0.0,d)*(1.0 - smoothstep(comp - 0.3 + franja,comp + franja,d));
float cert=1.0 - smoothstep(0.12,0.5,fwy / pe);
cob=mix(0.4,cob,cert);
vec3 folha=mix(vec3(0.016,0.04,0.012),vec3(0.06,0.12,0.034),gRuidoF(vec2(u / 1.3,y / 0.6)));
folha=mix(folha,vec3(0.1,0.036,0.085),step(0.94,gH1(floor(vec2(u / 0.45,y / 0.45))+ sem * 5.0))* cert);
fAlb=mix(fAlb,folha,cob);
fTint=mix(fTint,folha * 2.4,cob);
fMet=mix(fMet,0.0,cob);
fRug=mix(fRug,0.92,cob);
fEmi *=1.0 - cob;
}
}
void gFachada(){
float tipo=floor(vC.x + 0.5);
float dentro=step(10.5,tipo);
tipo=mix(tipo,6.0,dentro);
float sem=vC.y;
float u=vUvM.x;
float y=vUvM.y;
fEmi=vec3(0.0);
fInc=vec2(0.0);
fIncM=vec3(0.0);
if(tipo < 0.5 || tipo > 9.5){
float yy=y / 4.2;
float fl=floor(yy);
float fv=fract(yy);
float col=floor(u / 1.5);
gVidroPainel(col,fl,fv,sem,step(0.8,fv));
if(tipo > 9.5)gAletasLod1(u);
}else if(tipo < 1.5){
float yy=y / 4.2;
float col=floor(u / 0.75);
float fv=fract(yy);
gVidroPainel(col,floor(yy),fv,sem,step(0.82,fv));
fTint *=0.72;
fMet=min(1.0,fMet + 0.12);
fEmi=vec3(1.0,0.78,0.52)* uNoite * G_LUZ_JANELA *(0.75 + 0.25 * fv)* mix(1.0,0.12,vC.z);
}else if(tipo < 2.5){
float fv=clamp(y / 4.8,0.0,1.0);
fTint=vec3(0.30);
fMet=0.08;
fRug=0.05;
fAlb=mix(vec3(0.14,0.13,0.12),vec3(0.34,0.32,0.28),smoothstep(0.45,0.95,fv));
fEmi=vec3(1.0,0.82,0.6)*(0.35 + 0.65 * smoothstep(0.2,1.0,fv))* mix(0.01,G_LUZ_FORRO,uNoite);
float m=gLinha(u / 1.5,0.06);
fAlb=mix(fAlb,vec3(0.3,0.24,0.16),m);
if(uLinhas > 0.5)gAletasLod1(u);
}else if(tipo < 3.5){
float fv=clamp(y / 9.2,0.0,1.0);
fTint=vec3(0.32,0.30,0.27);
fMet=0.1;
fRug=0.05;
fAlb=mix(vec3(0.16,0.14,0.11),vec3(0.34,0.30,0.24),fv);
fEmi=vec3(1.0,0.7,0.42)*(0.25 + 0.75 * fv)* mix(0.03,0.14,uNoite);
float m=max(gLinha(u / 3.0,0.05),gLinha((y - 1.2)/ 4.6,0.03));
fTint=mix(fTint,vec3(0.26,0.17,0.09),m);
fMet=mix(fMet,1.0,m);
fAlb=mix(fAlb,vec3(0.0),m);
fEmi *=1.0 - m;
}else if(tipo < 4.5){
float t=clamp(y / 17.0,0.0,1.0)* vC.w;
fTint=vec3(0.5,0.46,0.39);
fMet=0.34;
fRug=0.08;
fAlb=vec3(0.15,0.13,0.1);
fEmi=mix(vec3(1.0,0.52,0.18),vec3(1.0,0.86,0.62),t)* mix(0.012,G_LUZ_LANTERNA,uNoite)*(0.65 + 0.35 * t);
fEmi *=mix(0.3,1.0,vC.w);
float m=gLinha(u / 0.75,0.12);
fTint=mix(fTint,vec3(0.26,0.17,0.09),m);
fMet=mix(fMet,1.0,m);
fAlb=mix(fAlb,vec3(0.0),m);
fEmi *=1.0 - 0.8 * m;
}else if(tipo < 5.5){
fTint=vec3(0.32,0.34,0.33);
fMet=0.2;
fRug=0.03;
fAlb=vec3(0.05,0.06,0.06);
}else if(tipo < 7.5){
float semA=(floor(fract(vC.y)* ${Io}.0)+ 0.5)/ ${Io}.0;
gVidroAnel(u,y,semA,vC.z,floor(vC.y),vC.w,tipo > 6.5 ? 1.5 : 3.2,dentro);
}else if(tipo < 8.5){
float yy=y / 4.5;
float fl=floor(yy);
float fv=fract(yy);
gVidroPainel(floor(u / 1.8),fl,fv,sem,step(0.9,fv));
fTint *=vec3(0.42,0.44,0.48);
fMet=min(1.0,fMet + 0.25);
fRug *=0.7;
fAlb *=0.45;
fEmi *=0.5;
float m=gLinha(yy,0.04);
fTint=mix(fTint,vec3(0.06),m);
fAlb=mix(fAlb,vec3(0.02),m);
}else{
fTint=vec3(0.42,0.47,0.49);
fMet=0.3;
fRug=0.05;
fAlb=mix(vec3(0.08,0.09,0.09),vec3(0.26,0.26,0.27),gLinha(u / 0.45,0.25)* 0.6);
float corrimao=1.0 - smoothstep(0.0,0.2,abs(y - 1.0));
fEmi=vec3(1.0,0.86,0.62)* mix(0.004,0.1,uNoite)*(0.25 + 0.75 * corrimao);
}
}
`,la=`
float oRug;float oMet;vec3 oEmi;float oPad;vec3 oCor;float oMalha;
void gOpaco(){
oMalha=0.0;
float pk=floor(vC.w + 0.5);
oPad=mod(pk,16.0);pk=floor(pk / 16.0);
float cls=mod(pk,16.0);pk=floor(pk / 16.0);
oMet=mod(pk,16.0)/ 15.0;pk=floor(pk / 16.0);
oRug=mod(pk,16.0)/ 15.0;
oCor=vC.rgb;
vec2 p=vUvM;
if(oPad > 0.5 && oPad < 1.5){
float fila=floor(p.y / 0.75);
float bloco=floor(p.x / 1.5 + 0.5 * mod(fila,2.0));
float j=max(gLinha(p.y / 0.75,0.025),gLinha(p.x / 1.5 + 0.5 * mod(fila,2.0),0.012));
oCor *=(0.93 + 0.12 * gH1(vec2(bloco,fila)))*(1.0 - 0.18 * j);
}else if(oPad > 1.5 && oPad < 2.5){
float j=max(gLinha(p.x / 1.2,0.03),gLinha(p.y / 1.2,0.03));
oCor *=(0.92 + 0.14 * gH1(floor(p / 1.2)))*(1.0 - 0.15 * j);
}else if(oPad > 2.5 && oPad < 3.5){
float n=gRuidoF(p / 6.0)* 0.5 + gRuidoF(p / 1.7 + 3.1)* 0.3 + gRuidoF(p / 23.0 + 9.7)* 0.2;
oCor *=0.74 + 0.52 * n;
}else if(oPad > 3.5 && oPad < 4.5){
oCor *=1.0;
}else if(oPad > 4.5 && oPad < 5.5){
float fase=(p.y + 1.4 * sin(p.x / 1.45))* 2.1;
float o=sin(fase);
float fw=fwidth(o)+ 1e-3;
float b=mix(smoothstep(-fw,fw,o),0.5,smoothstep(0.7,1.8,fwidth(fase)));
oCor=mix(vec3(0.07,0.066,0.06),vec3(0.5,0.47,0.42),b);
}else if(oPad > 5.5 && oPad < 6.5){
float j=max(gLinha(p.x / 2.0,0.05),gLinha(p.y / 1.0,0.05));
oCor=mix(oCor,vec3(0.2,0.2,0.21),j);
oMet=mix(oMet,0.8,j);
}else if(oPad > 6.5 && oPad < 7.5){
oCor *=0.8 + 0.4 * gRuidoF(p * 1.3);
}else if(oPad > 7.5 && oPad < 8.5){
oRug=clamp(oRug +(gH1(floor(p * vec2(0.5,3.0)))- 0.5)* 0.12,0.05,1.0);
oCor *=mix(1.0,0.14,uNoite);
}else if(oPad > 8.5 && oPad < 9.5){
float raia=gLinha(p.y / 1.22,0.05 / 1.22)* step(0.1,p.y)* step(p.y,7.25);
float marca=gLinha(p.x / 100.0,0.1 / 100.0);
oCor *=0.9 + 0.12 * gRuidoF(p * 0.7);
oCor=mix(oCor,vec3(0.78,0.77,0.74),max(raia,marca * 0.8));
}else if(oPad > 9.5 && oPad < 10.5){
vec2 a=abs(p);
float fw=max(fwidth(p.x),1e-3);
float l=0.0;
l=max(l,(1.0 - smoothstep(0.05,0.05 + fw,abs(a.x - 11.885)))* step(a.y,5.49));
l=max(l,(1.0 - smoothstep(0.05,0.05 + fw,abs(a.y - 5.485)))* step(a.x,11.89));
l=max(l,(1.0 - smoothstep(0.05,0.05 + fw,abs(a.y - 4.115)))* step(a.x,11.89));
l=max(l,(1.0 - smoothstep(0.05,0.05 + fw,abs(a.x - 6.4)))* step(a.y,4.12));
l=max(l,(1.0 - smoothstep(0.05,0.05 + fw,a.y))* step(a.x,6.4));
l=mix(l,0.06,smoothstep(0.3,1.0,fw));
float dentro=step(a.x,11.9)* step(a.y,5.5);
oCor *=mix(0.72,1.0,dentro);
oCor=mix(oCor,vec3(0.82,0.82,0.8),l);
}else if(oPad > 11.5 && oPad < 12.5){
oCor *=(1.0 - 0.1 * gLinha(p.x / 1.5,0.03))* mix(1.0,0.2,uNoite);
}else if(oPad > 12.5 && oPad < 13.5){
vec2 fw=fwidth(p);
float perto=1.0 - smoothstep(0.18,0.4,max(fw.x,fw.y));
float aco=max(max(gLinha(p.x,0.11),gLinha(p.y,0.1)),max(gLinha(p.x + p.y * 0.5,0.06),gLinha(p.x - p.y * 0.5,0.06)));
float hc=gH1(floor(p)+ 11.3);
float jardim=step(hc,0.32);
vec3 folhas=mix(vec3(0.07,0.1,0.045),vec3(0.26,0.07,0.1),step(0.85,gH1(floor(p * 2.0)+ 3.1)))*(0.8 + 0.4 * gRuidoF(p * 3.0));
if(perto > 0.5 && aco < 0.3 && jardim < 0.5)discard;
vec3 longe=mix(oCor * 0.85,folhas,0.3);
oCor=mix(longe,mix(folhas,oCor,aco),perto);
oMalha=aco * perto + 0.3 *(1.0 - perto);
}else if(oPad > 13.5 && oPad < 14.5){
float los=max(gLinha((p.x + 0.8 * p.y)/ 2.6,0.1),gLinha((p.x - 0.8 * p.y)/ 2.6,0.1));
float n=gRuidoF(p * 0.9)* 0.6 + gRuidoF(p * 2.7 + 5.0)* 0.4;
vec3 folhas=mix(vec3(0.06,0.09,0.04),vec3(0.12,0.15,0.06),n);
folhas=mix(folhas,vec3(0.3,0.08,0.14),step(0.78,gRuidoF(p * 1.7 + 9.0))* 0.8);
oCor=mix(folhas,vec3(0.2,0.12,0.08),los);
oMet=mix(0.0,0.4,los);
oMalha=los;
}else if(oPad > 10.5){
float fila=floor(p.y / 0.42);
float col=floor(p.x / 0.09 + gH1(vec2(fila,3.0)));
float h=gH1(vec2(col,fila));
vec3 lomb=mix(mix(vec3(0.32,0.12,0.07),vec3(0.55,0.45,0.3),h),vec3(0.12,0.16,0.2),step(0.82,h));
float prat=gLinha(p.y / 0.42,0.08);
float longe=smoothstep(0.04,0.12,fwidth(p.x));
vec3 c=mix(lomb *(0.8 + 0.4 * gH1(vec2(col * 1.3,fila))),vec3(0.36,0.25,0.17),longe);
oCor=mix(c,oCor,prat);
}
oEmi=vec3(0.0);
if(cls > 0.5 && cls < 1.5)oEmi=vec3(1.0,0.93,0.8)* mix(0.04,G_LUZ_ARO,uNoite);
else if(cls > 1.5 && cls < 2.5)oEmi=vec3(1.0,0.06,0.03)*(0.4 + 2.5 * uNoite)* step(0.5,fract(uTempo * 0.66));
else if(cls > 2.5 && cls < 3.5)oEmi=vec3(1.0,0.87,0.68)* mix(0.02,G_LUZ_FORRO,uNoite);
else if(cls > 3.5 && cls < 4.5)oEmi=vec3(0.25,0.62,0.72)* uNoite * 0.2;
else if(cls > 4.5 && cls < 5.5)oEmi=vec3(1.0,0.74,0.45)* uNoite * 0.2 * smoothstep(0.0,30.0,vUvM.y);
else if(cls > 5.5 && cls < 6.5)oEmi=vec3(1.0,0.76,0.48)* uNoite * G_LUZ_JANELA * step(0.45,gH1(floor(p / vec2(1.5,3.2))));
else if(cls > 6.5 && cls < 7.5)oEmi=vec3(1.0,0.88,0.7)* mix(0.01,0.45,uNoite);
else if(cls > 7.5 && cls < 8.5){
float fase=dot(vGPosMundo.xz,vec2(0.012,0.009));
float ciclo=0.5 + 0.5 * sin(uTempo * 0.35 + fase + vGPosMundo.y * 0.05);
vec3 show=mix(mix(vec3(0.62,0.3,1.0),vec3(1.0,0.32,0.7),ciclo),vec3(1.0,0.78,0.5),smoothstep(0.7,1.0,sin(uTempo * 0.13 + fase)));
float linha=oPad > 12.5 ? oMalha : max(gLinha(p.x / 2.5,0.25),gLinha(p.y / 2.5,0.25));
oEmi=show * uNoite *(0.008 + 0.07 * linha);
}
else if(cls > 11.5 && cls < 12.5)oEmi=vec3(1.0,0.78,0.52)* uNoite *(0.004 + 0.016 * smoothstep(0.35,0.75,gRuidoF(vGPosMundo.xz / 70.0)));
else if(cls > 8.5 && cls < 9.5)oEmi=vec3(1.0,0.72,0.42)* uNoite * 0.014;
else if(cls > 9.5 && cls < 10.5)oEmi=vec3(1.0,0.87,0.68)* mix(0.03,G_LUZ_LED * 2.6,uNoite)*(0.8 + 0.2 * sin(vUvM.y / 38.0 - uTempo * 0.6));
else if(cls > 10.5)oEmi=vec3(1.0,0.8,0.56)* mix(0.004,0.06,uNoite)* oCor * 6.0;
}
`;function st(o,e){Object.assign(o.uniforms,Oo,e),o.vertexShader=o.vertexShader.replace("#include <common>",`#include <common>
${ca}`).replace("#include <begin_vertex>",`#include <begin_vertex>
vC = aC;
vUvM = aUvM;`)}var Qo=Object.freeze({vidro:"arcologia-vidro-6",opaco:"arcologia-opaco-5",cascata:"arcologia-cascata-3",jato:"arcologia-jato-2"}),ve=K.vao/2-1,ua=2,Ht=()=>({uCorteEixo:{value:new ot(0,0,0,0)},uCorteH:{value:new ot(1e6,1e6,1e6,0)}});function Ko(o,{linhas:e=0,corte:r=1e6}={}){let t=new ao({color:16777215,roughness:.1,metalness:.4,envMapIntensity:1}),n={uLinhas:{value:e},uCorte:{value:r},...Ht()};return t.userData.uniformes=n,t.onBeforeCompile=a=>{st(a,n);let s=a.fragmentShader.replace("#include <common>",`#include <common>
${rt}
${fa}`);s=s.replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
if ( vGPosMundo.y > gCorte( vGPosMundo ) ) discard;`),s=s.replace("#include <color_fragment>",`#include <color_fragment>
fCosV = abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) );
gFachada();
diffuseColor.rgb = fTint;`),s=s.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
roughnessFactor = fRug;`),s=s.replace("#include <metalnessmap_fragment>",`#include <metalnessmap_fragment>
metalnessFactor = fMet;`),s=s.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
normal = normalize( normal + vec3( fInc, 0.0 ) + ( viewMatrix * vec4( fIncM, 0.0 ) ).xyz );`),s=s.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
totalEmissiveRadiance += fEmi;`),s=s.replace("#include <lights_physical_fragment>",`#include <lights_physical_fragment>
material.diffuseContribution = fAlb;`),a.fragmentShader=s},t.customProgramCacheKey=()=>Qo.vidro,t.name="arcologia:vidro",o.aplicar(t,mt)}function vt(o,{corte:e=1e6}={}){let r=new ao({color:16777215,roughness:.8,metalness:0,envMapIntensity:.8}),t={uCorte:{value:e},...Ht()};return r.userData.uniformes=t,r.onBeforeCompile=n=>{st(n,t);let a=n.fragmentShader.replace("#include <common>",`#include <common>
${rt}
${la}`);a=a.replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
if ( vGPosMundo.y > gCorte( vGPosMundo ) ) discard;`),a=a.replace("#include <color_fragment>",`#include <color_fragment>
gOpaco();
diffuseColor.rgb *= oCor;`),a=a.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
roughnessFactor = oRug;`),a=a.replace("#include <metalnessmap_fragment>",`#include <metalnessmap_fragment>
metalnessFactor = oMet;`),a=a.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
totalEmissiveRadiance += oEmi;`),n.fragmentShader=a},r.customProgramCacheKey=()=>Qo.opaco,r.name="arcologia:opaco",o.aplicar(r,mt)}var ma=`
vec3 wAlb;float wAlfa;float wRug;vec3 wEmi;
float wQueda(float x,float y,float t){
float q=sqrt(max(y,0.0)* 0.204);
return gRuidoF(vec2(x * 1.4,(q - t)* 3.2))* 0.6 + gRuidoF(vec2(x * 3.7 + 7.0,(q - t)* 7.5))* 0.4;
}
void gCascata(){
float modo=floor(vC.x + 0.5);
float fase=vC.y;
vec2 p=vUvM;
float t=uTempo;
wRug=0.25;
wEmi=vec3(0.0);
if(modo < 0.5){
float fio=wQueda(p.x,p.y,t + fase * 3.0);
float cordas=gRuidoF(vec2(p.x * 1.5 + 0.35 * sin(p.y * 0.21),3.1 + fase * 7.0));
float ar=smoothstep(2.0,30.0,p.y);
float esp=smoothstep(0.46 - 0.2 * ar,0.78,fio);
wAlb=mix(vec3(0.3,0.42,0.42),vec3(0.88,0.9,0.9),max(esp,0.2 + ar * 0.65));
wAlfa=clamp((0.42 + 0.55 * fio + 0.25 * ar)* mix(0.5,1.0,smoothstep(0.25,0.6,cordas)),0.0,0.96);
float lat=vC.z - 1.0;
wAlfa=vC.z > 0.5 ? clamp(wAlfa * 1.3,0.0,0.97)* smoothstep(0.0,0.1,lat)*(1.0 - smoothstep(0.9,1.0,lat)): wAlfa;
float luzPe=1.0 - 0.8 * smoothstep(8.0,110.0,p.y)* step(0.5,vC.z);
wEmi=mix(vec3(0.6,0.78,1.0),vec3(1.0,0.96,0.9),esp)* uNoite *(0.02 + 0.16 * esp)*(0.4 + 0.6 * ar)* luzPe * mix(1.0,2.6,step(0.5,vC.z));
}else if(modo < 1.5){
float n=gRuidoF(vec2(p.x * 0.3 + t * 0.25,p.y * 0.22 - t * 0.55 + fase * 9.0))* 0.6 + gRuidoF(vec2(p.x * 0.8 - t * 0.4,p.y * 0.5 - t * 1.0))* 0.4;
float alt=1.0 - smoothstep(1.0,16.0,p.y);
wAlb=vec3(0.86,0.88,0.89);
wAlfa=smoothstep(0.3,0.8,n)* alt * 0.7;
wRug=1.0;
wEmi=vec3(0.75,0.88,1.0)* uNoite * 0.11 * wAlfa;
}else if(modo < 2.5){
float n=gRuidoF(p * 0.8 + vec2(t * 0.35,-t * 0.6))* 0.6 + gRuidoF(p * 2.2 - vec2(t * 0.8,t * 0.25))* 0.4;
float perto=1.0 - smoothstep(0.5,9.0,abs(p.y));
wAlb=vec3(0.84,0.86,0.86);
wAlfa=smoothstep(0.3,0.7,n)* perto * 0.92;
wRug=0.5;
wEmi=vec3(0.7,0.86,1.0)* uNoite * 0.1 * wAlfa;
}else{
float fl=gRuidoF(vec2(p.x * 0.9,(p.y - t * 2.2)* 1.6))* 0.6 + gRuidoF(vec2(p.x * 2.6 + 4.0,(p.y - t * 3.1)* 3.0))* 0.4;
wAlb=mix(vec3(0.16,0.26,0.27),vec3(0.74,0.8,0.8),smoothstep(0.62,0.92,fl));
wAlfa=0.55 + 0.35 * fl;
wRug=0.08;
wEmi=vec3(0.7,0.86,1.0)* uNoite * 0.03 * fl;
}
}
`;function ye(o){let e=new ao({color:16777215,roughness:.25,metalness:0,transparent:!0,depthWrite:!1,side:lt,envMapIntensity:.9});e.forceSinglePass=!0;let r={uCorte:{value:1e6}};return e.userData.uniformes=r,e.onBeforeCompile=t=>{st(t,r);let n=t.fragmentShader.replace("#include <common>",`#include <common>
${rt}
${ma}`);n=n.replace("#include <color_fragment>",`#include <color_fragment>
gCascata();
diffuseColor = vec4( wAlb, wAlfa );`),n=n.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
roughnessFactor = wRug;`),n=n.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
totalEmissiveRadiance += wEmi;`),t.fragmentShader=n},e.customProgramCacheKey=()=>Qo.cascata,e.name="arcologia:cascata",o.aplicar(e,["neblina"])}var yo=Object.freeze({altura:72,ciclo:48}),pa=`
attribute vec2 aJato;
varying vec3 vJ;
float jAto(float a,float f,float t){
if(a < 0.5)return 0.5 + 0.5 * sin(6.2832 *(t / 4.0 - f * 2.5));
if(a < 1.5)return pow(0.5 + 0.5 * sin(6.2832 * t / 2.4),2.0);
if(a < 2.5)return 0.5 + 0.5 * sin(6.2832 * t / 3.0 + 3.1416 * mod(floor(f * 63.0 + 0.5),2.0));
float c=fract(t / 6.0);
return smoothstep(0.0,0.2,c * 1.3 - abs(f - 0.5))*(1.0 - smoothstep(0.65,1.0,c));
}
float jAltura(float f,float tp,float t){
float ciclo=mod(t,${yo.ciclo.toFixed(1)});
float a=floor(ciclo / 12.0);
float s=fract(ciclo / 12.0);
float h=mix(jAto(a,f,t),jAto(mod(a + 1.0,4.0),f,t),smoothstep(0.82,1.0,s));
float teto=mix(1.0,0.4,tp)*(0.55 + 0.45 * sin(3.1416 * f))*(0.62 + 0.38 * fract(sin(f * 91.7 + tp * 13.1)* 437.5));
return max(0.015,h)* teto * ${yo.altura.toFixed(1)};
}
`,da=`
varying vec3 vJ;
vec3 jAlb;float jAlfa;vec3 jEmi;
void gJato(){
float v=vJ.y;
float fio=gRuidoF(vec2(vJ.x * 7.0,v * vJ.z * 0.3 - uTempo * 5.0))* 0.65 + gRuidoF(vec2(vJ.x * 17.0 + 3.0,v * vJ.z * 0.9 - uTempo * 7.0))* 0.35;
float r=abs(vJ.x)*(1.0 + 0.8 *(1.0 - v));
float miolo=1.0 - smoothstep(0.06,0.42,r);
float halo=1.0 - smoothstep(0.2,0.5,r);
float topo=1.0 - smoothstep(0.72,1.0,v);
float nevoa=mix(1.0,0.5,smoothstep(0.55,0.95,v));
float corpo=max(smoothstep(0.15,0.75,fio)* miolo,0.28 * halo * fio);
jAlfa=corpo * topo * nevoa * 0.85 * smoothstep(0.0,0.04,v)* smoothstep(1.0,4.0,vJ.z);
jAlb=mix(vec3(0.62,0.7,0.72),vec3(0.88,0.9,0.9),v);
jEmi=vec3(0.85,0.92,1.0)* uNoite * 0.2 *(1.0 - 0.65 * v)*(0.4 + 0.6 * fio)*(0.5 + 0.5 * miolo);
}
`;function be(o){let e=new ao({color:16777215,roughness:.55,metalness:0,transparent:!0,depthWrite:!1,side:lt,envMapIntensity:.8});e.forceSinglePass=!0;let r={uCorte:{value:1e6}};return e.userData.uniformes=r,e.onBeforeCompile=t=>{st(t,r);let n=t.vertexShader.replace("#include <common>",`#include <common>
uniform float uTempo;
${pa}`);n=n.replace("#include <begin_vertex>",`#include <begin_vertex>
{
  float H = jAltura( aJato.x, aJato.y, uTempo );
  float v = position.y;
  float larg = 1.6 + 4.8 * pow( v, 2.0 ) * ( 0.25 + 0.75 * H / ${yo.altura.toFixed(1)} );
  transformed = vec3( position.x * larg, v * H, position.z * larg );
  // os jatos balançam e se inclinam em leque (os robôs da Dubai Fountain), para o lado de fora do arco
  float leque = ( aJato.x - 0.5 ) * 0.5 * ( 0.5 + 0.5 * sin( uTempo * 0.35 ) );
  transformed.x += ( sin( uTempo * 0.7 + aJato.x * 9.0 ) * 0.07 * v + leque ) * H * v;
  vJ = vec3( position.x + position.z, v, H );
}`),t.vertexShader=n;let a=t.fragmentShader.replace("#include <common>",`#include <common>
${rt}
${da}`);a=a.replace("#include <color_fragment>",`#include <color_fragment>
gJato();
diffuseColor = vec4( jAlb, jAlfa );`),a=a.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
totalEmissiveRadiance += jEmi;`),t.fragmentShader=a},e.customProgramCacheKey=()=>Qo.jato,e.name="arcologia:jato",o.aplicar(e,["neblina"])}function Me(){let o=new Y("jato"),e=[0,0,0,0];for(let[r,t]of[[1,0],[0,1]]){let n=o.vertices,a=[t,0,-r];for(let s=0;s<=8;s++){let f=s/8;o.v(-.5*r,f,-.5*t,...a,-.5,f,e),o.v(.5*r,f,.5*t,...a,.5,f,e)}for(let s=0;s<8;s++){let f=n+2*s;o.i.push(f,f+1,f+3,f,f+3,f+2)}}return o}function ha(o,e,r,t){let n=No(Me()),a=e.length,s=new Float32Array(2*a);e.forEach((i,g)=>{s[2*g]=i.f,s[2*g+1]=i.tipo}),n.setAttribute("aJato",new Bo(s,2));let f=new Go(n,t,Math.max(1,a)),l=new qo,c=1/0,p=1/0,h=-1/0,m=-1/0;return e.forEach((i,g)=>{f.setMatrixAt(g,l.makeTranslation(i.x,r,i.z)),c=Math.min(c,i.x),h=Math.max(h,i.x),p=Math.min(p,i.z),m=Math.max(m,i.z)}),f.count=a,f.instanceMatrix.needsUpdate=!0,n.boundingBox=new Gt(new k(-6,0,-6),new k(6,yo.altura+2,6)),n.boundingSphere=new ut(new k(0,yo.altura/2,0),yo.altura),f.frustumCulled=a>0,a&&(f.boundingSphere=new ut(new k((c+h)/2,r+yo.altura/2,(p+m)/2),Math.hypot(h-c,m-p)/2+yo.altura)),f.name="arcologia:fontes",f.renderOrder=12,o.medidas?.familia(f,"arcologia"),f}var at=new WeakMap;function Ee(o){let e=at.get(o);if(!e){let r=o.ganchos;e={vidro:Ko(r),vidroLod1:Ko(r,{linhas:1}),opaco:vt(r),cascata:ye(r),jato:be(r),torreVidro:Ko(r),torreVidroLod1:Ko(r,{linhas:1}),torreOpaco:vt(r)},e.lista=new Set(Object.values(e)),at.set(o,e)}return e}function ga(o){let e=at.get(o);if(e){for(let r of e.lista)r.dispose();e.lista.clear(),at.delete(o)}}function xa(o,e){let r=new Uo;r.name="arcologia:aquecer";let t=new Y("aquecer"),n=[0,0,0,0];t.v(0,-1e3,0,0,1,0,0,0,n),t.v(0,-1e3,0,0,1,0,0,0,n),t.v(0,-1e3,0,0,1,0,0,0,n),t.i.push(0,1,2);let a=No(t);for(let l of e){let c;if(l.name==="arcologia:jato"){let p=No(t);p.setAttribute("aJato",new Bo(new Float32Array(2),2)),c=new Go(p,l,1)}else c=new xo(a,l);c.frustumCulled=!1,c.name=`aquecer:${l.name}`,r.add(c)}let s=0,f={grupo:r,feito:!1,quadro(){if(f.feito)return!1;let l=!!o.cena?.environment;return r.visible=l,l&&++s>2&&(r.visible=!1,f.feito=!0),r.visible},descartar(){r.parent?.remove(r);for(let l of r.children)l.geometry!==a&&l.geometry.dispose(),l.isInstancedMesh&&l.dispose();a.dispose()}};return r.visible=!1,f}var va=new k;function ze(o,e={}){let r=o.horaDoCeu(),t=o.sim?.espelho?.tempo,n=ht(r,t?.diaDoAno??15,o.sim?.espelho?.mapa?.latitude??-23.5,e.dir??va.clone()),a=Ao.smoothstep(n.y,-.1,.1);e.dir=n,e.hora=r;let s=o.sol?.dia;return e.noite=Number.isFinite(s)?Math.min(1,Math.max(0,1-1.25*s)):1-a,e.baixo=1-Ao.smoothstep(n.y,.02,.4),e}var Ae=Object.freeze({leve:380,media:650,alta:950,ultra:1300,pc:950}),Re=4800,Wo=(o,e,r,t="arcologia",n="")=>{let a=new xo(No(e),r);return a.name=n,o.medidas?.familia(a,t),a},ya=(...o)=>{let e=o.map(r=>r.caixa()).filter(Boolean);return[0,1,2].map(r=>Math.min(...e.map(t=>t[r]))).concat([3,4,5].map(r=>Math.max(...e.map(t=>t[r]))))};function we(o,{nome:e,m0:r,m1:t,ms:n,efeitos:a=null,yCentro:s,topo:f}){let l=Ee(o),c=new Uo;c.name=e;let p=new Uo,h=new Uo;p.add(Wo(o,r.vidro,l.torreVidro,"arcologia",`${e}:lod0:vidro`),Wo(o,r.opaco,l.torreOpaco,"arcologia",`${e}:lod0:opaco`)),h.add(Wo(o,t.vidro,l.torreVidroLod1,"arcologia",`${e}:lod1:vidro`),Wo(o,t.opaco,l.torreOpaco,"arcologia",`${e}:lod1:opaco`));let m=a?.triangulos?Wo(o,a,l.cascata,"arcologia",`${e}:efeitos`):null;m&&(m.renderOrder=11);let i=new xo(No(n),l.torreOpaco);i.visible=!1,i.name=`${e}:sombra`,c.add(p,h,i),m&&c.add(m);let g=!1,d=u=>{o.sombra&&(u&&!g?o.medidas?.familia(o.sombra.projetor(i),"sombra"):!u&&g&&o.sombra.soltar(i),g=u)};d(!0);let x=0,v=1e6,b=new k,A={grupo:c,get lod(){return x},triangulos:{lod0:r.vidro.triangulos+r.opaco.triangulos,lod1:t.vidro.triangulos+t.opaco.triangulos,sombra:n.triangulos,efeitos:a?.triangulos??0},caixa:ya(r.vidro,r.opaco),posicionar(u,y,E,z){c.position.set(u,y,E),c.rotation.set(0,z,0),c.updateMatrixWorld(!0),o.sombra?.marcar()},forcarLod:null,quadro(){b.set(0,s,0).applyMatrix4(c.matrixWorld);let u=o.camera.position.distanceTo(b),y=(Ae[o.perfil?.id]??1700)*(x===0?1.05:.95);x=A.forcarLod??(u<y?0:1),p.visible=x===0&&c.visible,h.visible=x===1&&c.visible,m&&(m.visible=c.visible&&v>=f&&u<Re)},mostrar(u){c.visible=!!u,d(!!u),o.sombra?.marcar()},corte(u=1e6){v=u;for(let y of[l.torreVidro,l.torreVidroLod1,l.torreOpaco])y.userData.uniformes.uCorte.value=c.position.y+u,y.userData.uniformes.uCorteEixo.value.set(0,0,0,0),y.userData.uniformes.uCorteH.value.set(1e6,1e6,1e6,0);i.scale.y=Math.min(1,Math.max(.001,u/f)),i.updateMatrixWorld(!0),o.sombra?.marcar()},cortePorLado(u=1e6,y=u,E=Math.min(u,y)){let z=c.position.y,O=c.rotation.y;v=Math.max(u,y);for(let H of[l.torreVidro,l.torreVidroLod1,l.torreOpaco]){let P=H.userData.uniformes;P.uCorte.value=1e6,P.uCorteEixo.value.set(c.position.x,c.position.z,Math.cos(O),-Math.sin(O)),P.uCorteH.value.set(z+u,z+y,z+E,ve)}let w=Math.min(1,Math.max(.001,v/f)),T=i.scale.y;w!==T&&(Math.abs(w-T)*f>=ua||w===1||w<T)&&(i.scale.y=w,i.updateMatrixWorld(!0),o.sombra?.marcar())},descartar(){d(!1),c.parent?.remove(c),c.traverse(u=>u.geometry?.dispose())}};return A}function ba(o,{perfil:e=o.perfil,comEsplanada:r=!0,spec:t=co}={}){let n=zt[e?.id]??1,a=Co(t);return we(o,{nome:"arcologia:torre",m0:nt({nivel:n,comEsplanada:r,spec:t}),m1:Ot({comEsplanada:r,spec:t}),ms:Ct({spec:t}),yCentro:(t.altura+a.PODIO)/2,topo:a.topo})}function Ma(o,{perfil:e=o.perfil}={}){let r=zt[e?.id]??1,t=xt({nivel:r,lod:0}),n=xt({lod:1}),a=we(o,{nome:"arcologia:par",m0:t,m1:n,ms:xe(),efeitos:t.efeitos,yCentro:co.altura/2,topo:ge(co).topo});a.par=!0;let s=null;return Object.defineProperty(a,"triangulosPorTorre",{enumerable:!0,get(){return s??=Yo({x:0,z:0,rot:0}).map(f=>{let l=nt({nivel:r,spec:f.spec,gemea:!0,base:K.podio});return{nome:f.spec.nome,lod0:l.vidro.triangulos+l.opaco.triangulos}}),s}}),a}function Ea(o,e,r=ze(o)){return Oo.uNoite.value=r.noite,Oo.uHora.value=r.hora,Oo.uTempo.value=e/1e3%7200,r}function Te(o,e,r,t=null){let n=ho(e.contorno),a=r+e.fundo,s=1/0,f=1/0,l=-1/0,c=-1/0;for(let d=0;d<n.length;d+=2)s=Math.min(s,n[d]),l=Math.max(l,n[d]),f=Math.min(f,n[d+1]),c=Math.max(c,n[d+1]);let p=24+o.passo,h=Math.max(0,Math.floor((s-p-o.origem[0])/o.passo)),m=Math.min(o.n-1,Math.ceil((l+p-o.origem[0])/o.passo)),i=Math.max(0,Math.floor((f-p-o.origem[1])/o.passo)),g=Math.min(o.n-1,Math.ceil((c+p-o.origem[1])/o.passo));for(let d=i;d<=g;d++)for(let x=h;x<=m;x++){let v=o.origem[0]+x*o.passo,b=o.origem[1]+d*o.passo,u=It(v,b,n)?0:Nt(v,b,n);if(u>24)continue;let y=d*o.n+x;t&&!t.has(y)&&t.set(y,o.altura[y]);let E=u<=8?0:(u-8)/16,z=E*E*(3-2*E),O=a+(o.altura[y]-a)*z;O<o.altura[y]&&(o.altura[y]=O)}return[s-p,f-p,l+p,c+p]}function Aa(o,e,r,t){let n=o.sim?.espelho?.terreno;if(!n)return;t.guarda.size&&(Oe(n,t.guarda),t.ret&&o.sim.mudancas.marcarRet("terreno",...t.ret));let a=e.partes.find(s=>s.id==="lago").pecas.find(s=>s.tipo==="lago");t.ret=Te(n,a,r,t.guarda),o.sim.mudancas.marcarRet("terreno",...t.ret)}function Oe(o,e){for(let[r,t]of e)o.altura[r]=t;e.clear()}var Ce={uTempoAgua:{value:0}};function Ra(o){let e=new ao({color:new bo(.018,.075,.085),roughness:.05,metalness:0,envMapIntensity:1});return e.onBeforeCompile=r=>{Object.assign(r.uniforms,Ce,{uNoite:Oo.uNoite}),r.fragmentShader=r.fragmentShader.replace("#include <common>",`#include <common>
uniform float uTempoAgua;
uniform float uNoite;`).replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
reflectedLight.indirectSpecular *= mix( 1.0, 0.35, uNoite );`).replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
{
  vec2 p = vGPosMundo.xz;
  float t = uTempoAgua;
  vec2 g = vec2( cos( p.x * 0.21 + t * 0.9 ) * 0.5 + cos( ( p.x + p.y ) * 0.47 - t * 1.3 ) * 0.35 + cos( p.x * 1.3 + p.y * 0.7 + t * 2.1 ) * 0.15,
                 cos( p.y * 0.19 - t * 0.8 ) * 0.5 + cos( ( p.y - p.x ) * 0.43 + t * 1.1 ) * 0.35 + cos( p.y * 1.1 - p.x * 0.9 + t * 1.9 ) * 0.15 );
  vec3 nMundo = normalize( vec3( -g.x * 0.04, 1.0, -g.y * 0.04 ) );
  normal = normalize( ( viewMatrix * vec4( nMundo, 0.0 ) ).xyz );
}`)},e.customProgramCacheKey=()=>"arcologia-agua-3",e.name="arcologia:agua",o.aplicar(e,["sombra","neblina"])}function wa(o){Ce.uTempoAgua.value=o/1e3%7200}function Ta(){}export{Fa as a,Yt as b,ja as c,Da as d,Va as e,qa as f,Ua as g,G as h,fo as i,Xe as j,_ as k,lo as l,vo as m,Qe as n,bt as o,Y as p,ho as q,po as r,ne as s,Eo as t,R as u,B as v,Ye as w,J as x,re as y,me as z,ra as A,sa as B,xt as C,No as D,Oo as E,ve as F,ha as G,Ee as H,ga as I,xa as J,ze as K,Re as L,Ma as M,Ea as N,za as O,Aa as P,Oe as Q,Ra as R,wa as S,Oa as T};
