import"./parte.20261003212558.ROPLBJLA.js";var L=Object.freeze({PINTURA:0,VIDRO:1,PRETO:2,FAROL:3,LANTERNA:4,CROMADO:5,ARO:6,SOMBRA:7,FRENTE:8,TRASEIRA:9,CACAMBA:10,MADEIRA:11,CARGA:12,TAMBOR:13,BAU:14}),l=L,P=Object.freeze({c:8.6,l:2.5,h:3.1,cab:1.95,piso:1.28,roda:.52}),_=Object.freeze({z0:1.85,y0:1.95,z1:-3.6,y1:2.55}),F=Object.freeze(["basculante","carroceria","betoneira","bau"]),z=Object.freeze({brita:{corpo:"basculante",cor:[126,124,120]},areia:{corpo:"basculante",cor:[198,170,118]},argila:{corpo:"basculante",cor:[150,84,54]},calcario:{corpo:"basculante",cor:[214,210,200]},tijolo:{corpo:"carroceria",cor:[176,82,50]},cimento:{corpo:"carroceria",cor:[182,182,176]},aco:{corpo:"carroceria",cor:[104,110,118]},vidro:{corpo:"carroceria",cor:[150,186,196]},madeira:{corpo:"carroceria",cor:[132,92,58]},serrada:{corpo:"carroceria",cor:[196,156,104]},concreto:{corpo:"betoneira",cor:[150,150,146]}}),q=a=>z[a]??{corpo:"bau",cor:[200,200,196]},E=class{constructor(){this.pos=[],this.nor=[],this.parte=[],this.idx=[]}get nv(){return this.pos.length/3}poli(e,t,s=0){let[f,n,o]=e,c=[n[0]-f[0],n[1]-f[1],n[2]-f[2]],r=[o[0]-f[0],o[1]-f[1],o[2]-f[2]],C=[c[1]*r[2]-c[2]*r[1],c[2]*r[0]-c[0]*r[2],c[0]*r[1]-c[1]*r[0]];for(let i=3;Math.hypot(...C)<1e-12&&i<e.length;i++)r=[e[i][0]-f[0],e[i][1]-f[1],e[i][2]-f[2]],C=[c[1]*r[2]-c[2]*r[1],c[2]*r[0]-c[0]*r[2],c[0]*r[1]-c[1]*r[0]];let v=Math.hypot(...C)||1,u=this.nv;for(let i of e)this.pos.push(i[0],i[1],i[2]),this.nor.push(C[0]/v,C[1]/v,C[2]/v),this.parte.push(t,s);for(let i=1;i+1<e.length;i++)this.idx.push(u,u+i,u+i+1)}get tris(){return this.idx.length/3}fechar(){return{posicao:Float32Array.from(this.pos),normal:Float32Array.from(this.nor),parte:Float32Array.from(this.parte),indices:Uint16Array.from(this.idx),tris:this.idx.length/3}}};function h(a,e,t,s,f,n,o,c,{topo:r=c,frente:C=c,tras:v=c,fundo:u=!1,ci:i=0}={}){a.poli([[f,t,s],[f,n,s],[f,n,o],[f,t,o]],c,i),a.poli([[e,t,o],[e,n,o],[e,n,s],[e,t,s]],c,i),r!==null&&a.poli([[e,n,s],[e,n,o],[f,n,o],[f,n,s]],r,i),C!==null&&a.poli([[e,t,o],[f,t,o],[f,n,o],[e,n,o]],C,i),v!==null&&a.poli([[f,t,s],[e,t,s],[e,n,s],[f,n,s]],v,i),u&&a.poli([[e,t,s],[f,t,s],[f,t,o],[e,t,o]],c,i)}function G(a,e,t,s,f,n,o,c){a.poli([[f,t,o],[f,n,o],[f,n,s],[f,t,s]],c),a.poli([[e,t,s],[e,n,s],[e,n,o],[e,t,o]],c),a.poli([[f,t,o],[e,t,o],[e,n,o],[f,n,o]],c),a.poli([[e,t,s],[f,t,s],[f,n,s],[e,n,s]],c),a.poli([[e,t,o],[f,t,o],[f,t,s],[e,t,s]],c)}function I(a,e,t,s,f,n,o){let r=[];for(let i=0;i<8;i++){let m=Math.PI*2*i/8+Math.PI/8;r.push([Math.cos(m)*f,Math.sin(m)*f])}let C=e+o*n/2,v=e-o*n/2;for(let i=0;i<8;i++){let[m,R]=r[i],[O,b]=r[(i+1)%8],p=[[C,t+R,s+m],[C,t+b,s+O],[v,t+b,s+O],[v,t+R,s+m]];a.poli(o>0?p:[...p].reverse(),l.PRETO)}let u=r.map(([i,m])=>[C+o*.004,t+m*.58,s+i*.58]);a.poli(o>0?[...u].reverse():u,l.ARO)}function w(a){let{c:e,l:t,h:s,cab:f,roda:n}=P,o=t/2,c=e/2,r=-e/2,C=c-f,v=1.02,u=1.95,i=(p,A,g=0)=>[[-o+A,v],[-o+A*.6,u],[-o+A+g*.6,s-.08],[-o+A+.12+g,s],[o-A-.12-g,s],[o-A-g*.6,s-.08],[o-A*.6,u],[o-A,v]],m=[{z:C,pts:i(C,.04)},{z:c-.22,pts:i(c-.22,.04)},{z:c,pts:i(c,.12,.1)}];for(let p=0;p+1<m.length;p++){let A=m[p],g=m[p+1];for(let T=0;T+1<A.pts.length;T++){let M=(T===1||T===5)&&p===1,B=(T===1||T===5)&&p===0,D=M?l.VIDRO:l.PINTURA;a.poli([[A.pts[T][0],A.pts[T][1],A.z],[g.pts[T][0],g.pts[T][1],g.z],[g.pts[T+1][0],g.pts[T+1][1],g.z],[A.pts[T+1][0],A.pts[T+1][1],A.z]],D)}}for(let p of[-1,1]){let A=p*(o-.025),g=[[A+p*.005,u+.05,C+.35],[A+p*.005,s-.2,C+.35],[A+p*.005,s-.2,c-.3],[A+p*.005,u+.05,c-.3]];a.poli(p>0?g:[...g].reverse(),l.VIDRO)}let R=m[2].pts;a.poli(R.map(([p,A])=>[p,A,c]).reverse(),l.PINTURA),a.poli([[R[1][0]+.05,u+.05,c+.004],[R[6][0]-.05,u+.05,c+.004],[R[5][0]-.12,s-.18,c+.004],[R[2][0]+.12,s-.18,c+.004]],l.VIDRO),a.poli(m[0].pts.map(([p,A])=>[p,A,C]),l.PINTURA),a.poli([[-.62,1.15,c+.006],[.62,1.15,c+.006],[.62,1.78,c+.006],[-.62,1.78,c+.006]],l.PRETO),h(a,-o+.02,.42,c-.1,o-.02,.95,c+.12,l.PRETO,{tras:null});for(let p of[-1,1]){let A=p>0?o-.5:-o+.12;a.poli([[A,.7,c+.125],[A+.38,.7,c+.125],[A+.38,.88,c+.125],[A,.88,c+.125]],l.FAROL),h(a,p>0?o+.06:-o-.2,2.05,c-.42,p>0?o+.2:-o-.06,2.55,c-.34,l.PRETO)}h(a,o-.75,.48,C-1,o-.12,.98,C-.25,l.CROMADO,{fundo:!0});for(let p of[-1,1])h(a,p*.42-.08,.62,r+.12,p*.42+.08,.92,C,l.PRETO,{topo:null});h(a,-o+.05,.62,r,o-.05,.92,r+.14,l.PRETO,{topo:null});for(let p of[-1,1]){let A=p>0?o-.42:-o+.1;a.poli([[A+.32,.66,r-.006],[A,.66,r-.006],[A,.86,r-.006],[A+.32,.86,r-.006]],l.LANTERNA)}let O=r+1.55,b=r+2.95;for(let p of[-1,1])I(a,p*(o-.18),n,c-1.28,n,.32,p),I(a,p*(o-.28),n,O,n,.55,p),I(a,p*(o-.28),n,b,n,.55,p),h(a,p>0?o-.58:-o+.02,1.08,O-.62,p>0?o-.02:-o+.58,1.16,b+.62,l.PRETO);return{w:o,zF:c,zT:r,zc:C}}function U(a,e,t,s,f,n,o,c){let v=(i,m)=>{let R=i/4,O=m/6,b=Math.min(R,1-R)*2,p=Math.min(O,1-O)*2;return o+(c-o)*Math.sqrt(Math.max(0,b))*Math.min(1,p*1.6)-(b<.01||p<.01?.05:0)},u=(i,m)=>[e+(t-e)*i/4,v(i,m),s+(f-s)*m/6];for(let i=0;i<6;i++)for(let m=0;m<4;m++)a.poli([u(m,i),u(m,i+1),u(m+1,i+1),u(m+1,i)],l.CARGA)}function j(a,e){let{w:t,zT:s,zc:f}=e,n=P.piso,o=2.45,c=s+.05,r=f-.12;h(a,-t,n-.12,c,t,o,r,l.CACAMBA,{topo:null,fundo:!0}),G(a,-t+.08,n,c+.08,t-.08,o,r-.08,l.CACAMBA),a.poli([[-t,o,c],[-t,o,r],[-t+.08,o,r-.08],[-t+.08,o,c+.08]],l.CACAMBA),a.poli([[t-.08,o,c+.08],[t-.08,o,r-.08],[t,o,r],[t,o,c]],l.CACAMBA),a.poli([[-t,o,r],[t,o,r],[t-.08,o,r-.08],[-t+.08,o,r-.08]],l.CACAMBA),a.poli([[t,o,c],[-t,o,c],[-t+.08,o,c+.08],[t-.08,o,c+.08]],l.CACAMBA);for(let C of[-1,1])for(let v=1;v<4;v++)h(a,C>0?t:-t-.05,n,c+(r-c)*v/4-.06,C>0?t+.05:-t,o-.05,c+(r-c)*v/4+.06,l.CACAMBA,{tras:null,frente:null});a.poli([[-t+.1,o,r],[t-.1,o,r],[t-.1,o+.05,r+.55],[-t+.1,o+.05,r+.55]].reverse(),l.CACAMBA),U(a,-t+.1,t-.1,c+.1,r-.1,n,2.15,2.75)}function S(a,e){let{w:t,zT:s,zc:f}=e,n=P.piso,o=s+.02,c=f-.1;h(a,-t,n-.18,o,t,n,c,l.MADEIRA,{fundo:!0});for(let v of[-1,1])for(let[u,i]of[[n+.06,n+.3],[n+.38,n+.62]])h(a,v>0?t-.05:-t,u,o,v>0?t:-t+.05,i,c,l.MADEIRA);h(a,-t,n,o,t,n+.62,o+.05,l.MADEIRA,{frente:null}),h(a,-t,n,c-.06,t,n+1.5,c,l.CACAMBA);let r=(c-.12-(o+.12))/5,C=1;for(let v=4;v>=0;v--)for(let u of[-1,1]){let i=o+.12+v*r+.04,m=u>0?.06:-t+.14,R=u>0?t-.14:-.06;h(a,m,n,i,R,n+.14,i+r-.08,l.MADEIRA,{topo:null,ci:C}),h(a,m+.03,n+.14,i+.03,R-.03,n+1,i+r-.11,l.CARGA,{ci:C}),C++}}function H(a,e){let{w:t,zT:s,zc:f}=e;h(a,-t+.3,1,s+.2,t-.3,1.28,f-.1,l.PRETO),h(a,-.45,1.28,f-.75,.45,2.3,f-.12,l.CROMADO);let n=_,o=[0,n.y1-n.y0,n.z1-n.z0],c=Math.hypot(o[1],o[2]),r=[0,o[1]/c,o[2]/c],C=[1,0,0],v=[0,-r[2],r[1]],u=[[0,.55],[.08,.98],[.42,1.12],[.72,.95],[.95,.52],[1,.4]],i=10,m=u.map(([R,O])=>{let b=[0,n.y0+o[1]*R,n.z0+o[2]*R],p=[];for(let A=0;A<i;A++){let g=2*Math.PI*A/i;p.push([b[0]+(C[0]*Math.cos(g)+v[0]*Math.sin(g))*O,b[1]+(C[1]*Math.cos(g)+v[1]*Math.sin(g))*O,b[2]+(C[2]*Math.cos(g)+v[2]*Math.sin(g))*O])}return p});for(let R=0;R+1<m.length;R++)for(let O=0;O<i;O++){let b=(O+1)%i;a.poli([m[R][O],m[R+1][O],m[R+1][b],m[R][b]],l.TAMBOR)}a.poli([...m[0]],l.TAMBOR),a.poli([...m[m.length-1]].reverse(),l.PRETO),h(a,-.32,2.2,s-.05,.32,2.65,s+.45,l.CROMADO),a.poli([[-.2,1.45,s-.4],[.2,1.45,s-.4],[.2,2.2,s+.05],[-.2,2.2,s+.05]].reverse(),l.PRETO);for(let R of[f-.4,s+1])h(a,-.7,1.28,R-.12,.7,1.75,R+.12,l.PRETO)}function x(a,e){let{w:t,zT:s,zc:f}=e;h(a,-t,P.piso-.1,s+.02,t,3.45,f-.12,l.BAU,{fundo:!0,tras:l.BAU}),a.poli([[t-.02,1.3,s-.004],[-t+.02,1.3,s-.004],[-t+.02,3.4,s-.004],[t-.02,3.4,s-.004]],l.CROMADO)}function N(a){let e=P.l/2+.15,t=P.c/2+.2;a.poli([[-e,.03,t],[e,.03,t],[e,.03,-t],[-e,.03,-t]],l.SOMBRA)}function V(a){let e=new E,t=w(e);return{basculante:j,carroceria:S,betoneira:H,bau:x}[a](e,t),N(e),e.fechar()}function k(a){let e=new E,{c:t,l:s,h:f,cab:n}=P,o=s/2,c=t/2,r=-t/2,C=c-n;h(e,-o,.5,C,o,f,c,l.PINTURA,{frente:l.FRENTE,tras:null});let v=a==="basculante"?l.CACAMBA:a==="carroceria"?l.MADEIRA:a==="betoneira"?l.TAMBOR:l.BAU,u=a==="bau"?3.45:a==="betoneira"?2.9:a==="carroceria"?2.25:2.45;return h(e,-o,.5,r,o,u,C-.1,v,{tras:l.TRASEIRA,frente:null,topo:a==="basculante"||a==="carroceria"?l.CARGA:v}),N(e),e.fechar()}var d=new Map;function $(a,e=0){if(!F.includes(a))throw new Error(`carroceria desconhecida: ${a}`);let t=`${a}:${e}`;return d.has(t)||d.set(t,e?k(a):V(a)),d.get(t)}var J=`
attribute vec2 aParte2;
attribute vec4 aCab;
attribute vec4 aCarga;
flat varying vec4 vCab;
flat varying vec4 vCarga;
flat varying float vParte;
varying vec3 vCamLocal;
uniform float gCamTempo;
uniform vec4 gCamTambor;
uniform float gCamPiso;
vec3 camGira(vec3 p,vec3 o,vec3 d,float a){
vec3 v=p - o;
float c=cos(a);
float s=sin(a);
return o + v * c + cross(d,v)* s + d * dot(d,v)*(1.0 - c);
}
`,K=`
vec3 objectNormal=normal;
vec3 camPos=position;
{
int parte=int(aParte2.x + 0.5);
vParte=aParte2.x;
vCab=aCab;
vCarga=aCarga;
vCamLocal=vec3(position.xy,0.0);
if(parte==12){
float n=aCarga.a;
if(aParte2.y > 0.5){
if(aParte2.y > n + 0.01)camPos=vec3(0.0);
}else{
camPos.y=gCamPiso +(camPos.y - gCamPiso)* clamp(n / 10.0,0.0,1.0);
if(n < 0.5)camPos=vec3(0.0);
}
}
if(parte==13){
vec3 o=vec3(0.0,gCamTambor.x,gCamTambor.y);
vec3 d=normalize(vec3(0.0,gCamTambor.z - gCamTambor.x,gCamTambor.w - gCamTambor.y));
vec3 v=position - o;
float ax=dot(v,d);
vec3 r=v - d * ax;
vec3 e2=vec3(0.0,-d.z,d.y);
vCamLocal.z=atan(dot(r,e2),r.x)/ 6.2831853 + ax * 0.32;
float a=gCamTempo * 1.6 + floor(aCab.a / 4.0)* 0.7;
camPos=camGira(position,o,d,a);
objectNormal=camGira(normal,vec3(0.0),d,a);
}
}
`,Q=`
vec3 transformed=camPos;
`,W=`
flat varying vec4 vCab;
flat varying vec4 vCarga;
flat varying float vParte;
varying vec3 vCamLocal;
uniform float gCamNoite;
float gCamRug=0.4;
float gCamMetal=0.0;
vec3 camLinear(vec3 s){return pow(s / 255.0,vec3(2.2));}
`,X=`
{
int p=int(vParte + 0.5);
vec3 cab=min(camLinear(vCab.rgb),vec3(0.75));
vec3 c;
if(p==0 || p==8){c=cab;gCamRug=0.3;}
else if(p==1){c=vec3(0.02,0.025,0.03);gCamRug=0.06;}
else if(p==2){c=vec3(0.025);gCamRug=0.8;}
else if(p==3){c=vec3(0.55,0.55,0.52);gCamRug=0.15;}
else if(p==4){c=vec3(0.25,0.01,0.01);gCamRug=0.2;}
else if(p==5){c=vec3(0.55,0.56,0.56);gCamRug=0.35;gCamMetal=0.6;}
else if(p==6){c=vec3(0.3);gCamRug=0.3;gCamMetal=0.8;}
else if(p==9 || p==10){c=vec3(0.07,0.072,0.075);gCamRug=0.55;gCamMetal=0.3;}
else if(p==11){c=vec3(0.2,0.12,0.065);gCamRug=0.85;}
else if(p==12){c=camLinear(vCarga.rgb);gCamRug=0.95;}
else if(p==13){
float l=step(0.5,fract(vCamLocal.z * 3.0));
c=mix(cab,vec3(0.72,0.72,0.7),l);
gCamRug=0.35;
}
else if(p==14){c=vec3(0.7,0.7,0.68);gCamRug=0.45;}
else{c=vec3(0.0);gCamRug=1.0;}
diffuseColor.rgb=c;
}
`,Y=`
float roughnessFactor=gCamRug;
`,Z=`
float metalnessFactor=gCamMetal;
`,y=`
{
int p=int(vParte + 0.5);
int luz=int(mod(vCab.a,4.0)+ 0.5);
if(p==3 &&(luz & 1)!=0)totalEmissiveRadiance +=vec3(1.0,0.88,0.7)* 9.0 * gCamNoite;
if(p==4)totalEmissiveRadiance +=vec3(1.0,0.04,0.02)*(((luz & 2)!=0 ? 5.0 : 0.0)+ 2.5 * gCamNoite * float(luz & 1));
if(p==8 || p==9){
float x=abs(vCamLocal.x);
float par=step(0.45,x)* step(x,1.15)* step(0.55,vCamLocal.y)* step(vCamLocal.y,0.95);
if(p==8 &&(luz & 1)!=0)totalEmissiveRadiance +=vec3(1.0,0.88,0.7)* 6.0 * gCamNoite * par;
if(p==9)totalEmissiveRadiance +=vec3(1.0,0.04,0.02)* par *(((luz & 2)!=0 ? 4.0 : 0.0)+ 1.8 * gCamNoite * float(luz & 1));
}
}
`;function o0(){}export{P as CAMINHAO,X as CAMINHAO_FRAGMENTO_COR,y as CAMINHAO_FRAGMENTO_EMISSIVO,Z as CAMINHAO_FRAGMENTO_METAL,W as CAMINHAO_FRAGMENTO_PARS,Y as CAMINHAO_FRAGMENTO_RUGOSIDADE,Q as CAMINHAO_VERTICE_MAIN,K as CAMINHAO_VERTICE_NORMAL,J as CAMINHAO_VERTICE_PARS,z as CARGAS,F as CORPOS,L as PARTE_CAMINHAO,_ as TAMBOR,q as cargaDe,$ as malhaCaminhao,o0 as registrar};
