import{a as z}from"./parte.20261008151423.27MLVN3P.js";import{f as w}from"./parte.20261008151423.JKD2AK5A.js";import"./parte.20261008151423.FJO6KBUZ.js";import"./parte.20261008151423.6UHGLOXD.js";import"./parte.20261008151423.CJ3O7AC6.js";import"./parte.20261008151423.XE675E5M.js";import"./parte.20261008151423.VFPW5CDP.js";import{Ga as G,Ha as g,Ka as F,Ua as i,Wa as q,fa as H,ga as f,pa as T,ta as M}from"./parte.20261008151423.IHDIGFOA.js";import"./parte.20261008151423.32E5XRFC.js";var r=Object.freeze({chamadas:300,triangulos:9e5,torres:256}),S=`
float fcFaixa(float x,float w,float fw){
float f=fract(x);
return smoothstep(0.5 - w - fw,0.5 - w + fw,f)- smoothstep(0.5 + w - fw,0.5 + w + fw,f);
}
`;function $(p){let e=w({color:p,roughness:.78,metalness:0},{ganchos:["sombra","neblina"]}),d=e.onBeforeCompile;e.onBeforeCompile=(o,n)=>{d.call(e,o,n),o.fragmentShader=o.fragmentShader.replace("void main() {",`${S}
void main() {`).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
{
vec3 nf=normalize(cross(dFdx(vGPosMundo),dFdy(vGPosMundo)));
float parede=1.0 - step(0.8,abs(nf.y));
float u=abs(nf.x)> abs(nf.z)? vGPosMundo.z : vGPosMundo.x;
vec2 g=vec2(u / 1.6,vGPosMundo.y / 3.3);
vec2 fw=fwidth(g);
float janela=fcFaixa(g.x,0.36,fw.x)* fcFaixa(g.y - 0.08,0.3,fw.y);
float longe=smoothstep(0.25,0.5,max(fw.x,fw.y));
janela=mix(janela,0.43,longe)* parede;
vec3 hq=fract(floor(g).xyx * vec3(0.1031,0.1030,0.0973));
hq +=dot(hq,hq.yzx + 33.33);
float hs=fract((hq.x + hq.y)* hq.z);
diffuseColor.rgb=mix(diffuseColor.rgb *(0.92 + 0.16 * hs * parede),vec3(0.035,0.042,0.05),janela);
roughnessFactor=mix(roughnessFactor,0.1,janela);
}`)};let h=e.customProgramCacheKey.bind(e);return e.customProgramCacheKey=()=>`${h()}|fachada-estresse`,e}function _(p){p("estresse",{sim:"vazia",hora:15.5,perfil:"media",dominios:["ceu","bancada","entrada"],camera:{x:40,z:20,dist:330,guinada:0,inclinacao:10},async montar(e){let{cena:d,medidas:h}=e,o=new M;o.name="estresse";let n=h.familia(new g(new q(6e3,6e3).rotateX(-Math.PI/2),w({superficie:"asfaltoGasto"},{ganchos:["sombra","neblina"]})),"terreno");n.name="estresse:chao",o.add(n);let u=[new i(24,1,24,8,54,8),new i(32,1,20,10,44,6),new i(18,1,30,6,52,10),new i(28,1,28,9,46,9)].map(a=>a.translate(0,.5,0)),E=["#b9b2a6","#9da3a8","#c4b8a3"].map(a=>$(a)),s=new F(new i(1,1,1).translate(0,.5,0),new G,r.torres);s.visible=!1;let P=new T,j=new H,m=0;for(let a=0;m<r.torres;a++)for(let t of[-1,1])for(let c=0;c<4&&m<r.torres;c++){let x=(a*7+c*3+(t>0?1:0))%u.length,v=40+(a*37+c*53+(t>0?17:0))%110,y=t*(34+c*42),b=60-a*46,l=new g(u[x],E[(a+c)%E.length]);l.frustumCulled=!1,l.position.set(y,0,b),l.scale.set(1,v,1),l.name=`estresse:torre${m}`,h.familia(l,"predios"),o.add(l);let R=u[x].parameters;s.setMatrixAt(m,P.compose(new f(y,0,b),j,new f(R.width,v,R.depth))),m++}s.instanceMatrix.needsUpdate=!0,o.add(s),d.add(o),z(e,s);let B=new f(-26,24,96),C=new f(80,78,-20);return{quadro(){let a=e.camera;a.position.copy(B),a.lookAt(C),a.updateMatrixWorld()},resultado(){let a=e.medidas.stats,t=[];return(a.calls<r.chamadas*.8||a.calls>r.chamadas)&&t.push(`${a.calls} chamadas (teto ${r.chamadas})`),(a.tris<r.triangulos*.9||a.tris>r.triangulos*1.02)&&t.push(`${a.tris} triângulos (alvo ${r.triangulos})`),e.ambiente||t.push("sem o céu"),{ok:t.length===0,falhas:t,medidas:{calls:a.calls,tris:a.tris,callsSombra:a.callsSombra,msaa:a.msaa,alvo:a.alvo}}},descartar(){e.sombra.soltar(s),d.remove(o);for(let a of[...u,n.geometry,s.geometry])a.dispose();for(let a of[...E,n.material,s.material])a.dispose();s.dispose()}}}})}export{r as ESTRESSE,_ as registrar};
