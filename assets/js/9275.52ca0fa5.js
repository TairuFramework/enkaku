"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["9275"],{1355:function(t,e,s){s.d(e,{a:function(){return p}});var r=s(6223),i=s(8888),n=(0,i.a)((t,e,s)=>{let r=t.get(e);r?r.includes(s)||r.push(s):t.set(e,[s])},"appendToMap"),a=(0,i.a)((t,e)=>{let s;return(...r)=>{s&&clearTimeout(s),s=setTimeout(()=>{s=0,t(...r)},e)}},"debounce"),o=(0,i.a)(t=>!("isConnected"in t)||t.isConnected,"isConnected"),l=a(t=>{for(let e of t.keys())t.set(e,t.get(e).filter(o))},2e3),h=(0,i.a)(()=>{if("function"!=typeof r.f)return{};let t=new Map;return{dispose:(0,i.a)(()=>t.clear(),"dispose"),get:(0,i.a)(e=>{let s=(0,r.f)();s&&n(t,e,s)},"get"),set:(0,i.a)(e=>{let s=t.get(e);s&&t.set(e,s.filter(r.g)),l(t)},"set"),reset:(0,i.a)(()=>{t.forEach(t=>t.forEach(r.g)),l(t)},"reset")}},"stencilSubscription"),c=(0,i.a)(t=>"function"==typeof t?t():t,"unwrap"),d=(0,i.a)((t,e=(t,e)=>t!==e)=>{let s=c(t),r=new Map(Object.entries(s??{})),n={dispose:[],get:[],set:[],reset:[]},a=(0,i.a)(()=>{var e;r=new Map(Object.entries(null!==(e=c(t))&&void 0!==e?e:{})),n.reset.forEach(t=>t())},"reset"),o=(0,i.a)(()=>{n.dispose.forEach(t=>t()),a()},"dispose"),l=(0,i.a)(t=>(n.get.forEach(e=>e(t)),r.get(t)),"get"),h=(0,i.a)((t,s)=>{let i=r.get(t);e(s,i,t)&&(r.set(t,s),n.set.forEach(e=>e(t,s,i)))},"set"),d=typeof Proxy>"u"?{}:new Proxy(s,{get:(t,e)=>l(e),ownKeys:t=>Array.from(r.keys()),getOwnPropertyDescriptor:()=>({enumerable:!0,configurable:!0}),has:(t,e)=>r.has(e),set:(t,e,s)=>(h(e,s),!0)}),p=(0,i.a)((t,e)=>(n[t].push(e),()=>{u(n[t],e)}),"on");return{state:d,get:l,set:h,on:p,onChange:(0,i.a)((e,s)=>{let r=p("set",(t,r)=>{t===e&&s(r)}),i=p("reset",()=>s(c(t)[e]));return()=>{r(),i()}},"onChange"),use:(0,i.a)((...t)=>{let e=t.reduce((t,e)=>(e.set&&t.push(p("set",e.set)),e.get&&t.push(p("get",e.get)),e.reset&&t.push(p("reset",e.reset)),e.dispose&&t.push(p("dispose",e.dispose)),t),[]);return()=>e.forEach(t=>t())},"use"),dispose:o,reset:a,forceUpdate:(0,i.a)(t=>{let e=r.get(t);n.set.forEach(s=>s(t,e,e))},"forceUpdate")}},"createObservableMap"),u=(0,i.a)((t,e)=>{let s=t.indexOf(e);s>=0&&(t[s]=t[t.length-1],t.length--)},"removeFromArray"),p=(0,i.a)((t,e)=>{let s=d(t,e);return s.use(h()),s},"createStore")},7604:function(t,e,s){var r=s(8992),i=s(8888),n=Object.defineProperty,a=Object.getOwnPropertyDescriptor,o=(0,i.a)((t,e,s,r)=>{for(var i,o=r>1?void 0:r?a(e,s):e,l=t.length-1;l>=0;l--)(i=t[l])&&(o=(r?i(e,s,o):i(o))||o);return r&&o&&n(e,s,o),o},"s"),l=class extends r.d{static{(0,i.a)(this,"t")}constructor(){super(...arguments),this.size="1em",this.weight="regular",this.color="currentColor",this.mirrored=!1}render(){var t;return(0,r.b)`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="${this.size}"
      height="${this.size}"
      fill="${this.color}"
      viewBox="0 0 256 256"
      transform=${this.mirrored?"scale(-1, 1)":null}
    >
      ${l.weightsMap.get(null!=(t=this.weight)?t:"regular")}
    </svg>`}};l.weightsMap=new Map([["thin",(0,r.c)`<path d="M226.83,221.17l-52.7-52.7a84.1,84.1,0,1,0-5.66,5.66l52.7,52.7a4,4,0,0,0,5.66-5.66ZM36,112a76,76,0,1,1,76,76A76.08,76.08,0,0,1,36,112Z"/>`],["light",(0,r.c)`<path d="M228.24,219.76l-51.38-51.38a86.15,86.15,0,1,0-8.48,8.48l51.38,51.38a6,6,0,0,0,8.48-8.48ZM38,112a74,74,0,1,1,74,74A74.09,74.09,0,0,1,38,112Z"/>`],["regular",(0,r.c)`<path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>`],["bold",(0,r.c)`<path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z"/>`],["fill",(0,r.c)`<path d="M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/>`],["duotone",(0,r.c)`<path d="M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z" opacity="0.2"/><path d="M229.66,218.34,179.6,168.28a88.21,88.21,0,1,0-11.32,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>`]]),l.styles=(0,r.a)`
    :host {
      display: contents;
    }
  `,o([(0,r.f)({type:String,reflect:!0})],l.prototype,"size",2),o([(0,r.f)({type:String,reflect:!0})],l.prototype,"weight",2),o([(0,r.f)({type:String,reflect:!0})],l.prototype,"color",2),o([(0,r.f)({type:Boolean,reflect:!0})],l.prototype,"mirrored",2),l=o([(0,r.e)("ph-magnifying-glass")],l)},3024:function(t,e,s){s.d(e,{a:function(){return i},b:function(){return n}});var r=(0,s(1355).a)({open:!1,currentTask:"search",currentTerm:""}),{state:i}=r,n=function(t,e){var s={};for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&0>e.indexOf(r)&&(s[r]=t[r]);if(null!=t&&"function"==typeof Object.getOwnPropertySymbols)for(var i=0,r=Object.getOwnPropertySymbols(t);i<r.length;i++)0>e.indexOf(r[i])&&Object.prototype.propertyIsEnumerable.call(t,r[i])&&(s[r[i]]=t[r[i]]);return s}(r,["state"])},8992:function(t,e,s){s.d(e,{a:function(){return d},b:function(){return G},c:function(){return X},d:function(){return tg},e:function(){return t_},f:function(){return tT}});var r,i=s(8888),n=globalThis,a=n.ShadowRoot&&(void 0===n.ShadyCSS||n.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,o=Symbol(),l=new WeakMap,h=class{static{(0,i.a)(this,"l$2")}constructor(t,e,s){if(this._$cssResult$=!0,s!==o)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(a&&void 0===t){let s=void 0!==e&&1===e.length;s&&(t=l.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&l.set(e,t))}return t}toString(){return this.cssText}},c=(0,i.a)(t=>new h("string"==typeof t?t:t+"",void 0,o),"h$1"),d=(0,i.a)((t,...e)=>new h(1===t.length?t[0]:e.reduce((e,s,r)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[r+1],t[0]),t,o),"p$3"),u=(0,i.a)((t,e)=>{if(a)t.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let s of e){let e=document.createElement("style"),r=n.litNonce;void 0!==r&&e.setAttribute("nonce",r),e.textContent=s.cssText,t.appendChild(e)}},"d$2"),p=a?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(let s of t.cssRules)e+=s.cssText;return c(e)})(t):t,{is:f,defineProperty:$,getOwnPropertyDescriptor:m,getOwnPropertyNames:y,getOwnPropertySymbols:g,getPrototypeOf:v}=Object,_=globalThis,b=_.trustedTypes,A=b?b.emptyScript:"",S=_.reactiveElementPolyfillSupport,E=(0,i.a)((t,e)=>t,"l$1"),w={toAttribute(t,e){switch(e){case Boolean:t=t?A:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let s=t;switch(e){case Boolean:s=null!==t;break;case Number:s=null===t?null:Number(t);break;case Object:case Array:try{s=JSON.parse(t)}catch{s=null}}return s}},C=(0,i.a)((t,e)=>!f(t,e),"y$2"),P={attribute:!0,type:String,converter:w,reflect:!1,hasChanged:C};null!=Symbol.metadata||(Symbol.metadata=Symbol("metadata")),null!=_.litPropertyMetadata||(_.litPropertyMetadata=new WeakMap);var O,M=class extends HTMLElement{static{(0,i.a)(this,"c")}static addInitializer(t){var e;this._$Ei(),(null!=(e=this.l)?e:this.l=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=P){if(e.state&&(e.attribute=!1),this._$Ei(),this.elementProperties.set(t,e),!e.noAccessor){let s=Symbol(),r=this.getPropertyDescriptor(t,s,e);void 0!==r&&$(this.prototype,t,r)}}static getPropertyDescriptor(t,e,s){var r;let{get:i,set:n}=null!=(r=m(this.prototype,t))?r:{get(){return this[e]},set(t){this[e]=t}};return{get(){return i?.call(this)},set(e){let r=i?.call(this);n.call(this,e),this.requestUpdate(t,r,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){var e;return null!=(e=this.elementProperties.get(t))?e:P}static _$Ei(){if(this.hasOwnProperty(E("elementProperties")))return;let t=v(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(E("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(E("properties"))){let t=this.properties;for(let e of[...y(t),...g(t)])this.createProperty(e,t[e])}let t=this[Symbol.metadata];if(null!==t){let e=litPropertyMetadata.get(t);if(void 0!==e)for(let[t,s]of e)this.elementProperties.set(t,s)}for(let[t,e]of(this._$Eh=new Map,this.elementProperties)){let s=this._$Eu(t,e);void 0!==s&&this._$Eh.set(s,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t))for(let s of new Set(t.flat(1/0).reverse()))e.unshift(p(s));else void 0!==t&&e.push(p(t));return e}static _$Eu(t,e){let s=e.attribute;return!1===s?void 0:"string"==typeof s?s:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),null==(t=this.constructor.l)||t.forEach(t=>t(this))}addController(t){var e,s;(null!=(e=this._$EO)?e:this._$EO=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&(null==(s=t.hostConnected)||s.call(t))}removeController(t){var e;null==(e=this._$EO)||e.delete(t)}_$E_(){let t=new Map;for(let e of this.constructor.elementProperties.keys())this.hasOwnProperty(e)&&(t.set(e,this[e]),delete this[e]);t.size>0&&(this._$Ep=t)}createRenderRoot(){var t;let e=null!=(t=this.shadowRoot)?t:this.attachShadow(this.constructor.shadowRootOptions);return u(e,this.constructor.elementStyles),e}connectedCallback(){var t;null!=this.renderRoot||(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),null==(t=this._$EO)||t.forEach(t=>{var e;return null==(e=t.hostConnected)?void 0:e.call(t)})}enableUpdating(t){}disconnectedCallback(){var t;null==(t=this._$EO)||t.forEach(t=>{var e;return null==(e=t.hostDisconnected)?void 0:e.call(t)})}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$EC(t,e){var s;let r=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,r);if(void 0!==i&&!0===r.reflect){let n=((null==(s=r.converter)?void 0:s.toAttribute)!==void 0?r.converter:w).toAttribute(e,r.type);this._$Em=t,null==n?this.removeAttribute(i):this.setAttribute(i,n),this._$Em=null}}_$AK(t,e){var s;let r=this.constructor,i=r._$Eh.get(t);if(void 0!==i&&this._$Em!==i){let t=r.getPropertyOptions(i),n="function"==typeof t.converter?{fromAttribute:t.converter}:(null==(s=t.converter)?void 0:s.fromAttribute)!==void 0?t.converter:w;this._$Em=i,this[i]=n.fromAttribute(e,t.type),this._$Em=null}}requestUpdate(t,e,s){var r;if(void 0!==t){if(null!=s||(s=this.constructor.getPropertyOptions(t)),!(null!=(r=s.hasChanged)?r:C)(this[t],e))return;this.P(t,e,s)}!1===this.isUpdatePending&&(this._$ES=this._$ET())}P(t,e,s){var r;this._$AL.has(t)||this._$AL.set(t,e),!0===s.reflect&&this._$Em!==t&&(null!=(r=this._$Ej)?r:this._$Ej=new Set).add(t)}async _$ET(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(null!=this.renderRoot||(this.renderRoot=this.createRenderRoot()),this._$Ep){for(let[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}let t=this.constructor.elementProperties;if(t.size>0)for(let[e,s]of t)!0!==s.wrapped||this._$AL.has(e)||void 0===this[e]||this.P(e,this[e],s)}let e=!1,s=this._$AL;try{(e=this.shouldUpdate(s))?(this.willUpdate(s),null==(t=this._$EO)||t.forEach(t=>{var e;return null==(e=t.hostUpdate)?void 0:e.call(t)}),this.update(s)):this._$EU()}catch(t){throw e=!1,this._$EU(),t}e&&this._$AE(s)}willUpdate(t){}_$AE(t){var e;null==(e=this._$EO)||e.forEach(t=>{var e;return null==(e=t.hostUpdated)?void 0:e.call(t)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EU(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Ej&&(this._$Ej=this._$Ej.forEach(t=>this._$EC(t,this[t]))),this._$EU()}updated(t){}firstUpdated(t){}};M.elementStyles=[],M.shadowRootOptions={mode:"open"},M[E("elementProperties")]=new Map,M[E("finalized")]=new Map,S?.({ReactiveElement:M}),(null!=(O=_.reactiveElementVersions)?O:_.reactiveElementVersions=[]).push("2.0.4");var k=globalThis,x=k.trustedTypes,T=x?x.createPolicy("lit-html",{createHTML:(0,i.a)(t=>t,"createHTML")}):void 0,U="$lit$",H=`lit$${Math.random().toFixed(9).slice(2)}$`,R="?"+H,j=`<${R}>`,N=document,z=(0,i.a)(()=>N.createComment(""),"x"),L=(0,i.a)(t=>null===t||"object"!=typeof t&&"function"!=typeof t,"H"),D=Array.isArray,I=(0,i.a)(t=>D(t)||"function"==typeof t?.[Symbol.iterator],"Z"),Z=`[ 	
\f\r]`,B=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,V=/-->/g,K=/>/g,W=RegExp(`>|${Z}(?:([^\\s"'>=/]+)(${Z}*=${Z}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),q=/'/g,Q=/"/g,J=/^(?:script|style|textarea|title)$/i,F=(0,i.a)(t=>(e,...s)=>({_$litType$:t,strings:e,values:s}),"O$1"),G=F(1),X=F(2),Y=Symbol.for("lit-noChange"),tt=Symbol.for("lit-nothing"),te=new WeakMap,ts=N.createTreeWalker(N,129);function tr(t,e){if(!Array.isArray(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==T?T.createHTML(e):e}(0,i.a)(tr,"z");var ti=(0,i.a)((t,e)=>{let s=t.length-1,r=[],i,n=2===e?"<svg>":"",a=B;for(let e=0;e<s;e++){let s=t[e],o,l,h=-1,c=0;for(;c<s.length&&(a.lastIndex=c,null!==(l=a.exec(s)));)c=a.lastIndex,a===B?"!--"===l[1]?a=V:void 0!==l[1]?a=K:void 0!==l[2]?(J.test(l[2])&&(i=RegExp("</"+l[2],"g")),a=W):void 0!==l[3]&&(a=W):a===W?">"===l[0]?(a=i??B,h=-1):void 0===l[1]?h=-2:(h=a.lastIndex-l[2].length,o=l[1],a=void 0===l[3]?W:'"'===l[3]?Q:q):a===Q||a===q?a=W:a===V||a===K?a=B:(a=W,i=void 0);let d=a===W&&t[e+1].startsWith("/>")?" ":"";n+=a===B?s+j:h>=0?(r.push(o),s.slice(0,h)+U+s.slice(h)+H+d):s+H+(-2===h?e:d)}return[tr(t,n+(t[s]||"<?>")+(2===e?"</svg>":"")),r]},"q"),tn=class t{static{(0,i.a)(this,"T")}constructor({strings:e,_$litType$:s},r){let i;this.parts=[];let n=0,a=0,o=e.length-1,l=this.parts,[h,c]=ti(e,s);if(this.el=t.createElement(h,r),ts.currentNode=this.el.content,2===s){let t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(i=ts.nextNode())&&l.length<o;){if(1===i.nodeType){if(i.hasAttributes())for(let t of i.getAttributeNames())if(t.endsWith(U)){let e=c[a++],s=i.getAttribute(t).split(H),r=/([.?@])?(.*)/.exec(e);l.push({type:1,index:n,name:r[2],strings:s,ctor:"."===r[1]?td:"?"===r[1]?tu:"@"===r[1]?tp:tc}),i.removeAttribute(t)}else t.startsWith(H)&&(l.push({type:6,index:n}),i.removeAttribute(t));if(J.test(i.tagName)){let t=i.textContent.split(H),e=t.length-1;if(e>0){i.textContent=x?x.emptyScript:"";for(let s=0;s<e;s++)i.append(t[s],z()),ts.nextNode(),l.push({type:2,index:++n});i.append(t[e],z())}}}else if(8===i.nodeType){if(i.data===R)l.push({type:2,index:n});else{let t=-1;for(;-1!==(t=i.data.indexOf(H,t+1));)l.push({type:7,index:n}),t+=H.length-1}}n++}}static createElement(t,e){let s=N.createElement("template");return s.innerHTML=t,s}};function ta(t,e,s=t,r){var i,n,a;if(e===Y)return e;let o=void 0!==r?null==(i=s._$Co)?void 0:i[r]:s._$Cl,l=L(e)?void 0:e._$litDirective$;return o?.constructor!==l&&(null==(n=o?._$AO)||n.call(o,!1),void 0===l?o=void 0:(o=new l(t))._$AT(t,s,r),void 0!==r?(null!=(a=s._$Co)?a:s._$Co=[])[r]=o:s._$Cl=o),void 0!==o&&(e=ta(t,o._$AS(t,e.values),o,r)),e}(0,i.a)(ta,"f$1");var to,tl=class{static{(0,i.a)(this,"G")}constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){var e;let{el:{content:s},parts:r}=this._$AD,i=(null!=(e=t?.creationScope)?e:N).importNode(s,!0);ts.currentNode=i;let n=ts.nextNode(),a=0,o=0,l=r[0];for(;void 0!==l;){if(a===l.index){let e;2===l.type?e=new th(n,n.nextSibling,this,t):1===l.type?e=new l.ctor(n,l.name,l.strings,this,t):6===l.type&&(e=new tf(n,this,t)),this._$AV.push(e),l=r[++o]}a!==l?.index&&(n=ts.nextNode(),a++)}return ts.currentNode=N,i}p(t){let e=0;for(let s of this._$AV)void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}},th=class t{static{(0,i.a)(this,"b$1")}get _$AU(){var t,e;return null!=(e=null==(t=this._$AM)?void 0:t._$AU)?e:this._$Cv}constructor(t,e,s,r){var i;this.type=2,this._$AH=tt,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=r,this._$Cv=null==(i=r?.isConnected)||i}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return void 0!==e&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){L(t=ta(this,t,e))?t===tt||null==t||""===t?(this._$AH!==tt&&this._$AR(),this._$AH=tt):t!==this._$AH&&t!==Y&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):I(t)?this.k(t):this._(t)}S(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.S(t))}_(t){this._$AH!==tt&&L(this._$AH)?this._$AA.nextSibling.data=t:this.T(N.createTextNode(t)),this._$AH=t}$(t){var e;let{values:s,_$litType$:r}=t,i="number"==typeof r?this._$AC(t):(void 0===r.el&&(r.el=tn.createElement(tr(r.h,r.h[0]),this.options)),r);if((null==(e=this._$AH)?void 0:e._$AD)===i)this._$AH.p(s);else{let t=new tl(i,this),e=t.u(this.options);t.p(s),this.T(e),this._$AH=t}}_$AC(t){let e=te.get(t.strings);return void 0===e&&te.set(t.strings,e=new tn(t)),e}k(e){D(this._$AH)||(this._$AH=[],this._$AR());let s=this._$AH,r,i=0;for(let n of e)i===s.length?s.push(r=new t(this.S(z()),this.S(z()),this,this.options)):r=s[i],r._$AI(n),i++;i<s.length&&(this._$AR(r&&r._$AB.nextSibling,i),s.length=i)}_$AR(t=this._$AA.nextSibling,e){var s;for(null==(s=this._$AP)||s.call(this,!1,!0,e);t&&t!==this._$AB;){let e=t.nextSibling;t.remove(),t=e}}setConnected(t){var e;void 0===this._$AM&&(this._$Cv=t,null==(e=this._$AP)||e.call(this,t))}},tc=class{static{(0,i.a)(this,"M")}get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,r,i){this.type=1,this._$AH=tt,this._$AN=void 0,this.element=t,this.name=e,this._$AM=r,this.options=i,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=tt}_$AI(t,e=this,s,r){let i=this.strings,n=!1;if(void 0===i)(n=!L(t=ta(this,t,e,0))||t!==this._$AH&&t!==Y)&&(this._$AH=t);else{let r=t,a,o;for(t=i[0],a=0;a<i.length-1;a++)(o=ta(this,r[s+a],e,a))===Y&&(o=this._$AH[a]),n||(n=!L(o)||o!==this._$AH[a]),o===tt?t=tt:t!==tt&&(t+=(o??"")+i[a+1]),this._$AH[a]=o}n&&!r&&this.j(t)}j(t){t===tt?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},td=class extends tc{static{(0,i.a)(this,"J")}constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===tt?void 0:t}},tu=class extends tc{static{(0,i.a)(this,"K")}constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==tt)}},tp=class extends tc{static{(0,i.a)(this,"Q")}constructor(t,e,s,r,i){super(t,e,s,r,i),this.type=5}_$AI(t,e=this){var s;if((t=null!=(s=ta(this,t,e,0))?s:tt)===Y)return;let r=this._$AH,i=t===tt&&r!==tt||t.capture!==r.capture||t.once!==r.once||t.passive!==r.passive,n=t!==tt&&(r===tt||i);i&&this.element.removeEventListener(this.name,this,r),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e,s;"function"==typeof this._$AH?this._$AH.call(null!=(s=null==(e=this.options)?void 0:e.host)?s:this.element,t):this._$AH.handleEvent(t)}},tf=class{static{(0,i.a)(this,"X")}constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){ta(this,t)}},t$=k.litHtmlPolyfillSupport;t$?.(tn,th),(null!=(to=k.litHtmlVersions)?to:k.litHtmlVersions=[]).push("3.1.4");var tm=(0,i.a)((t,e,s)=>{var r,i;let n=null!=(r=s?.renderBefore)?r:e,a=n._$litPart$;if(void 0===a){let t=null!=(i=s?.renderBefore)?i:null;n._$litPart$=a=new th(e.insertBefore(z(),t),t,void 0,s??{})}return a._$AI(t),a},"et"),ty,tg=class extends M{static{(0,i.a)(this,"n")}constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var t;let e=super.createRenderRoot();return null!=(t=this.renderOptions).renderBefore||(t.renderBefore=e.firstChild),e}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=tm(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),null==(t=this._$Do)||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),null==(t=this._$Do)||t.setConnected(!1)}render(){return Y}};tg._$litElement$=!0,tg.finalized=!0,null==(ty=globalThis.litElementHydrateSupport)||ty.call(globalThis,{LitElement:tg});var tv=globalThis.litElementPolyfillSupport;tv?.({LitElement:tg}),(null!=(r=globalThis.litElementVersions)?r:globalThis.litElementVersions=[]).push("4.0.6");var t_=(0,i.a)(t=>(e,s)=>{void 0!==s?s.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)},"s"),tb=Object.defineProperty,tA=Object.defineProperties,tS=Object.getOwnPropertyDescriptors,tE=Object.getOwnPropertySymbols,tw=Object.prototype.hasOwnProperty,tC=Object.prototype.propertyIsEnumerable,tP=(0,i.a)((t,e,s)=>e in t?tb(t,e,{enumerable:!0,configurable:!0,writable:!0,value:s}):t[e]=s,"d"),tO=(0,i.a)((t,e)=>{for(var s in e||(e={}))tw.call(e,s)&&tP(t,s,e[s]);if(tE)for(var s of tE(e))tC.call(e,s)&&tP(t,s,e[s]);return t},"l"),tM=(0,i.a)((t,e)=>tA(t,tS(e)),"u"),tk={attribute:!0,type:String,converter:w,reflect:!1,hasChanged:C},tx=(0,i.a)((t=tk,e,s)=>{let{kind:r,metadata:i}=s,n=globalThis.litPropertyMetadata.get(i);if(void 0===n&&globalThis.litPropertyMetadata.set(i,n=new Map),n.set(s.name,t),"accessor"===r){let{name:r}=s;return{set(s){let i=e.get.call(this);e.set.call(this,s),this.requestUpdate(r,i,t)},init(e){return void 0!==e&&this.P(r,void 0,t),e}}}if("setter"===r){let{name:r}=s;return function(s){let i=this[r];e.call(this,s),this.requestUpdate(r,i,t)}}throw Error("Unsupported decorator location: "+r)},"w");function tT(t){return(e,s)=>{var r,i,n;let a;return"object"==typeof s?tx(t,e,s):(r=t,i=e,n=s,a=i.hasOwnProperty(n),i.constructor.createProperty(n,a?tM(tO({},r),{wrapped:!0}):r),a?Object.getOwnPropertyDescriptor(i,n):void 0)}}(0,i.a)(tT,"O")},5833:function(t,e,s){s.r(e),s.d(e,{orama_search_button:function(){return o}}),s(7604);var r=s(8039),i=s(3024);s(8992),s(1355);var n=s(6223),a=s(8888),o=class{static{(0,a.a)(this,"OramaSearchButton")}constructor(t){(0,n.a)(this,t),this.onPrefersColorSchemeChange=t=>{this.systemScheme=t.matches?"dark":"light",this.updateTheme()},this.size="medium",this.themeConfig=void 0,this.colorScheme="light",this.systemScheme="light",this.shortcutLabel="",this.componentID=(0,r.e)("search-button")}watchHandler(){this.updateTheme()}handleSearchboxClosed(t){this.buttonRef.querySelector("button").focus()}handleKeyDown(t){"k"===t.key&&(t.metaKey||t.ctrlKey)&&(t.preventDefault(),this.buttonRef.click())}updateTheme(){let t="system"===this.colorScheme?this.systemScheme:this.colorScheme,e=this.htmlElement;e&&t&&(e.classList.remove("theme-light","theme-dark"),e.classList.add(`theme-${t}`)),this.updateCssVariables(t)}updateCssVariables(t){var e;let s=this.themeConfig,r=this.htmlElement;if(r&&s&&t){if(!(null===(e=s.colors)||void 0===e)&&e[t])for(let e of Object.keys(s.colors[t]))r.style.setProperty(`${e}`,s.colors[t][e]);if(s.typography)for(let t of Object.keys(s.typography))r.style.setProperty(`${t}`,s.typography[t])}}handleShortcutLabel(){return navigator.userAgent.includes("Mac")?"\u2318 K":"Ctrl + K"}connectedCallback(){this.htmlElement.id=this.componentID,this.shortcutLabel=this.handleShortcutLabel(),this.schemaQuery=window.matchMedia("(prefers-color-scheme: dark)"),this.systemScheme=this.schemaQuery.matches?"dark":"light",this.updateTheme(),this.schemaQuery.addEventListener("change",this.onPrefersColorSchemeChange)}disconnectedCallback(){this.schemaQuery.removeEventListener("change",this.onPrefersColorSchemeChange)}render(){return(0,n.b)(n.c,{key:"0de36da389270a1ff08edb048c6eb3b5d1cee67c"},(0,n.b)("orama-button",{key:"5953b318379d9dba5d49822930fba59b84c6062a",type:"button",variant:"secondary",ref:(0,a.a)(t=>this.buttonRef=t,"ref"),size:this.size,onClick:(0,a.a)(()=>{i.a.open=!0},"onClick")},(0,n.b)("span",{key:"945a888665316a4873428f41d3ac2ffaf4bdf0e2",slot:"adorment-start"},(0,n.b)("ph-magnifying-glass",{key:"c26fae6356951fde05dfccba6ae2373c93f030b2"})),(0,n.b)("slot",{key:"a35860b064c9d6002a10d39881f30ddcdd1669c0"}),(0,n.b)("span",{key:"59ad0141de8493ee3fa368dd2f3b0a45a72fd4e9",slot:"adorment-end",class:"kyb-shortcut"},this.shortcutLabel)))}get htmlElement(){return(0,n.d)(this)}static get watchers(){return{themeConfig:["watchHandler"],colorScheme:["watchHandler"]}}};o.style=":host{display:block}.kyb-shortcut{background-color:#eee9f6;background-color:var(--background-color-tertiary,#eee9f6);border-radius:.5rem;border-radius:var(--radius-s,calc(8rem/var(--orama-base-font-size, 16)));padding:.25rem;padding:var(--spacing-xs,calc(4rem/var(--orama-base-font-size, 16))) var(--spacing-s,calc(4rem/var(--orama-base-font-size, 16)))}"}}]);