"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["8007"],{9380:function(t,e,s){s.d(e,{a:function(){return a}});var i=s(6658),r=s(7414),n=s(5650),o=Symbol("storeProps"),l=Symbol("storeWillLoadPatched");function a(t){return(e,s)=>{let n=e.constructor;if(n[o]||(n[o]=[]),n[o].push({propKey:s,storeName:t}),!n[l]){n[l]=!0;let t=e.componentWillLoad;e.componentWillLoad=function(){let e=(0,r.d)(this),s=this.constructor[o];if(s)for(let{propKey:t,storeName:r}of s){let s=(0,i.c)(r,e);this[t]=s}"function"==typeof t&&t.apply(this)}}}}(0,n.a)(a,"Store")},6658:function(t,e,s){s.d(e,{a:function(){return g},b:function(){return y},c:function(){return m}});var i=s(6574),r=s(7414),n=s(5650),o=(0,n.a)((t,e,s)=>{let i=t.get(e);i?i.includes(s)||i.push(s):t.set(e,[s])},"appendToMap"),l=(0,n.a)((t,e)=>{let s;return(...i)=>{s&&clearTimeout(s),s=setTimeout(()=>{s=0,t(...i)},e)}},"debounce"),a=(0,n.a)(t=>!("isConnected"in t)||t.isConnected,"isConnected"),h=l(t=>{for(let e of t.keys())t.set(e,t.get(e).filter(a))},2e3),c=(0,n.a)(()=>{if("function"!=typeof r.f)return{};let t=new Map;return{dispose:(0,n.a)(()=>t.clear(),"dispose"),get:(0,n.a)(e=>{let s=(0,r.f)();s&&o(t,e,s)},"get"),set:(0,n.a)(e=>{let s=t.get(e);s&&t.set(e,s.filter(r.g)),h(t)},"set"),reset:(0,n.a)(()=>{t.forEach(t=>t.forEach(r.g)),h(t)},"reset")}},"stencilSubscription"),u=(0,n.a)(t=>"function"==typeof t?t():t,"unwrap"),d=(0,n.a)((t,e=(t,e)=>t!==e)=>{let s=u(t),i=new Map(Object.entries(s??{})),r={dispose:[],get:[],set:[],reset:[]},o=(0,n.a)(()=>{var e;i=new Map(Object.entries(null!==(e=u(t))&&void 0!==e?e:{})),r.reset.forEach(t=>t())},"reset"),l=(0,n.a)(()=>{r.dispose.forEach(t=>t()),o()},"dispose"),a=(0,n.a)(t=>(r.get.forEach(e=>e(t)),i.get(t)),"get"),h=(0,n.a)((t,s)=>{let n=i.get(t);e(s,n,t)&&(i.set(t,s),r.set.forEach(e=>e(t,s,n)))},"set"),c=typeof Proxy>"u"?{}:new Proxy(s,{get:(t,e)=>a(e),ownKeys:t=>Array.from(i.keys()),getOwnPropertyDescriptor:()=>({enumerable:!0,configurable:!0}),has:(t,e)=>i.has(e),set:(t,e,s)=>(h(e,s),!0)}),d=(0,n.a)((t,e)=>(r[t].push(e),()=>{p(r[t],e)}),"on");return{state:c,get:a,set:h,on:d,onChange:(0,n.a)((e,s)=>{let i=d("set",(t,i)=>{t===e&&s(i)}),r=d("reset",()=>s(u(t)[e]));return()=>{i(),r()}},"onChange"),use:(0,n.a)((...t)=>{let e=t.reduce((t,e)=>(e.set&&t.push(d("set",e.set)),e.get&&t.push(d("get",e.get)),e.reset&&t.push(d("reset",e.reset)),e.dispose&&t.push(d("dispose",e.dispose)),t),[]);return()=>e.forEach(t=>t())},"use"),dispose:l,reset:o,forceUpdate:(0,n.a)(t=>{let e=i.get(t);r.set.forEach(s=>s(t,e,e))},"forceUpdate")}},"createObservableMap"),p=(0,n.a)((t,e)=>{let s=t.indexOf(e);s>=0&&(t[s]=t[t.length-1],t.length--)},"removeFromArray"),f=(0,n.a)((t,e)=>{let s=d(t,e);return s.use(c()),s},"createStore"),$={global:{open:!1,currentTask:"search",currentTerm:""},search:{count:0,facets:[],facetProperty:"",results:[],resultMap:{},highlightedIndex:-1,loading:!1,error:!1,searchService:null,searchParams:null},chat:{chatService:null,interactions:[],sourceBaseURL:"",linksTarget:"_blank",linksRel:"noopener noreferrer",prompt:"",sourcesMap:{title:"title",description:"description",path:"path"}}},_=new Map,v=(0,n.a)((t,e)=>{let s=_.get(t);if(!s)throw Error("Invalid parent component Id");let i=s[e];if(!i)throw Error("Store not initialized");return i},"getParentComponentStore"),g=(0,n.a)((t,e)=>{let s=$[t];if(!s)throw Error("Invalid store name");let i=f(s);return _.has(e)?_.get(e)[t]=i:_.set(e,{[t]:i}),i},"initStore"),y=(0,n.a)(t=>{_.delete(t)},"removeAllStores");function m(t,e){let s=(0,i.i)(e);if(!s)throw Error("Failed to get store");return v(s.id,t)}(0,n.a)(m,"getStore")},2701:function(t,e,s){s.d(e,{a:function(){return u},b:function(){return Q},c:function(){return X},d:function(){return tg},e:function(){return tm},f:function(){return tM}});var i,r=s(5650),n=globalThis,o=n.ShadowRoot&&(void 0===n.ShadyCSS||n.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,l=Symbol(),a=new WeakMap,h=class{static{(0,r.a)(this,"l$2")}constructor(t,e,s){if(this._$cssResult$=!0,s!==l)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(o&&void 0===t){let s=void 0!==e&&1===e.length;s&&(t=a.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&a.set(e,t))}return t}toString(){return this.cssText}},c=(0,r.a)(t=>new h("string"==typeof t?t:t+"",void 0,l),"h$1"),u=(0,r.a)((t,...e)=>new h(1===t.length?t[0]:e.reduce((e,s,i)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[i+1],t[0]),t,l),"p$3"),d=(0,r.a)((t,e)=>{if(o)t.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let s of e){let e=document.createElement("style"),i=n.litNonce;void 0!==i&&e.setAttribute("nonce",i),e.textContent=s.cssText,t.appendChild(e)}},"d$2"),p=o?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(let s of t.cssRules)e+=s.cssText;return c(e)})(t):t,{is:f,defineProperty:$,getOwnPropertyDescriptor:_,getOwnPropertyNames:v,getOwnPropertySymbols:g,getPrototypeOf:y}=Object,m=globalThis,A=m.trustedTypes,b=A?A.emptyScript:"",E=m.reactiveElementPolyfillSupport,S=(0,r.a)((t,e)=>t,"l$1"),w={toAttribute(t,e){switch(e){case Boolean:t=t?b:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let s=t;switch(e){case Boolean:s=null!==t;break;case Number:s=null===t?null:Number(t);break;case Object:case Array:try{s=JSON.parse(t)}catch{s=null}}return s}},P=(0,r.a)((t,e)=>!f(t,e),"y$2"),C={attribute:!0,type:String,converter:w,reflect:!1,hasChanged:P};null!=Symbol.metadata||(Symbol.metadata=Symbol("metadata")),null!=m.litPropertyMetadata||(m.litPropertyMetadata=new WeakMap);var O,U=class extends HTMLElement{static{(0,r.a)(this,"c")}static addInitializer(t){var e;this._$Ei(),(null!=(e=this.l)?e:this.l=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=C){if(e.state&&(e.attribute=!1),this._$Ei(),this.elementProperties.set(t,e),!e.noAccessor){let s=Symbol(),i=this.getPropertyDescriptor(t,s,e);void 0!==i&&$(this.prototype,t,i)}}static getPropertyDescriptor(t,e,s){var i;let{get:r,set:n}=null!=(i=_(this.prototype,t))?i:{get(){return this[e]},set(t){this[e]=t}};return{get(){return r?.call(this)},set(e){let i=r?.call(this);n.call(this,e),this.requestUpdate(t,i,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){var e;return null!=(e=this.elementProperties.get(t))?e:C}static _$Ei(){if(this.hasOwnProperty(S("elementProperties")))return;let t=y(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(S("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(S("properties"))){let t=this.properties;for(let e of[...v(t),...g(t)])this.createProperty(e,t[e])}let t=this[Symbol.metadata];if(null!==t){let e=litPropertyMetadata.get(t);if(void 0!==e)for(let[t,s]of e)this.elementProperties.set(t,s)}for(let[t,e]of(this._$Eh=new Map,this.elementProperties)){let s=this._$Eu(t,e);void 0!==s&&this._$Eh.set(s,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t))for(let s of new Set(t.flat(1/0).reverse()))e.unshift(p(s));else void 0!==t&&e.push(p(t));return e}static _$Eu(t,e){let s=e.attribute;return!1===s?void 0:"string"==typeof s?s:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),null==(t=this.constructor.l)||t.forEach(t=>t(this))}addController(t){var e,s;(null!=(e=this._$EO)?e:this._$EO=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&(null==(s=t.hostConnected)||s.call(t))}removeController(t){var e;null==(e=this._$EO)||e.delete(t)}_$E_(){let t=new Map;for(let e of this.constructor.elementProperties.keys())this.hasOwnProperty(e)&&(t.set(e,this[e]),delete this[e]);t.size>0&&(this._$Ep=t)}createRenderRoot(){var t;let e=null!=(t=this.shadowRoot)?t:this.attachShadow(this.constructor.shadowRootOptions);return d(e,this.constructor.elementStyles),e}connectedCallback(){var t;null!=this.renderRoot||(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),null==(t=this._$EO)||t.forEach(t=>{var e;return null==(e=t.hostConnected)?void 0:e.call(t)})}enableUpdating(t){}disconnectedCallback(){var t;null==(t=this._$EO)||t.forEach(t=>{var e;return null==(e=t.hostDisconnected)?void 0:e.call(t)})}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$EC(t,e){var s;let i=this.constructor.elementProperties.get(t),r=this.constructor._$Eu(t,i);if(void 0!==r&&!0===i.reflect){let n=((null==(s=i.converter)?void 0:s.toAttribute)!==void 0?i.converter:w).toAttribute(e,i.type);this._$Em=t,null==n?this.removeAttribute(r):this.setAttribute(r,n),this._$Em=null}}_$AK(t,e){var s;let i=this.constructor,r=i._$Eh.get(t);if(void 0!==r&&this._$Em!==r){let t=i.getPropertyOptions(r),n="function"==typeof t.converter?{fromAttribute:t.converter}:(null==(s=t.converter)?void 0:s.fromAttribute)!==void 0?t.converter:w;this._$Em=r,this[r]=n.fromAttribute(e,t.type),this._$Em=null}}requestUpdate(t,e,s){var i;if(void 0!==t){if(null!=s||(s=this.constructor.getPropertyOptions(t)),!(null!=(i=s.hasChanged)?i:P)(this[t],e))return;this.P(t,e,s)}!1===this.isUpdatePending&&(this._$ES=this._$ET())}P(t,e,s){var i;this._$AL.has(t)||this._$AL.set(t,e),!0===s.reflect&&this._$Em!==t&&(null!=(i=this._$Ej)?i:this._$Ej=new Set).add(t)}async _$ET(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(null!=this.renderRoot||(this.renderRoot=this.createRenderRoot()),this._$Ep){for(let[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}let t=this.constructor.elementProperties;if(t.size>0)for(let[e,s]of t)!0!==s.wrapped||this._$AL.has(e)||void 0===this[e]||this.P(e,this[e],s)}let e=!1,s=this._$AL;try{(e=this.shouldUpdate(s))?(this.willUpdate(s),null==(t=this._$EO)||t.forEach(t=>{var e;return null==(e=t.hostUpdate)?void 0:e.call(t)}),this.update(s)):this._$EU()}catch(t){throw e=!1,this._$EU(),t}e&&this._$AE(s)}willUpdate(t){}_$AE(t){var e;null==(e=this._$EO)||e.forEach(t=>{var e;return null==(e=t.hostUpdated)?void 0:e.call(t)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EU(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Ej&&(this._$Ej=this._$Ej.forEach(t=>this._$EC(t,this[t]))),this._$EU()}updated(t){}firstUpdated(t){}};U.elementStyles=[],U.shadowRootOptions={mode:"open"},U[S("elementProperties")]=new Map,U[S("finalized")]=new Map,E?.({ReactiveElement:U}),(null!=(O=m.reactiveElementVersions)?O:m.reactiveElementVersions=[]).push("2.0.4");var T=globalThis,x=T.trustedTypes,M=x?x.createPolicy("lit-html",{createHTML:(0,r.a)(t=>t,"createHTML")}):void 0,H="$lit$",N=`lit$${Math.random().toFixed(9).slice(2)}$`,R="?"+N,k=`<${R}>`,j=document,L=(0,r.a)(()=>j.createComment(""),"x"),I=(0,r.a)(t=>null===t||"object"!=typeof t&&"function"!=typeof t,"H"),z=Array.isArray,D=(0,r.a)(t=>z(t)||"function"==typeof t?.[Symbol.iterator],"Z"),B=`[ 	
\f\r]`,W=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,V=/-->/g,q=/>/g,K=RegExp(`>|${B}(?:([^\\s"'>=/]+)(${B}*=${B}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),F=/'/g,J=/"/g,Z=/^(?:script|style|textarea|title)$/i,G=(0,r.a)(t=>(e,...s)=>({_$litType$:t,strings:e,values:s}),"O$1"),Q=G(1),X=G(2),Y=Symbol.for("lit-noChange"),tt=Symbol.for("lit-nothing"),te=new WeakMap,ts=j.createTreeWalker(j,129);function ti(t,e){if(!Array.isArray(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==M?M.createHTML(e):e}(0,r.a)(ti,"z");var tr=(0,r.a)((t,e)=>{let s=t.length-1,i=[],r,n=2===e?"<svg>":"",o=W;for(let e=0;e<s;e++){let s=t[e],l,a,h=-1,c=0;for(;c<s.length&&(o.lastIndex=c,null!==(a=o.exec(s)));)c=o.lastIndex,o===W?"!--"===a[1]?o=V:void 0!==a[1]?o=q:void 0!==a[2]?(Z.test(a[2])&&(r=RegExp("</"+a[2],"g")),o=K):void 0!==a[3]&&(o=K):o===K?">"===a[0]?(o=r??W,h=-1):void 0===a[1]?h=-2:(h=o.lastIndex-a[2].length,l=a[1],o=void 0===a[3]?K:'"'===a[3]?J:F):o===J||o===F?o=K:o===V||o===q?o=W:(o=K,r=void 0);let u=o===K&&t[e+1].startsWith("/>")?" ":"";n+=o===W?s+k:h>=0?(i.push(l),s.slice(0,h)+H+s.slice(h)+N+u):s+N+(-2===h?e:u)}return[ti(t,n+(t[s]||"<?>")+(2===e?"</svg>":"")),i]},"q"),tn=class t{static{(0,r.a)(this,"T")}constructor({strings:e,_$litType$:s},i){let r;this.parts=[];let n=0,o=0,l=e.length-1,a=this.parts,[h,c]=tr(e,s);if(this.el=t.createElement(h,i),ts.currentNode=this.el.content,2===s){let t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(r=ts.nextNode())&&a.length<l;){if(1===r.nodeType){if(r.hasAttributes())for(let t of r.getAttributeNames())if(t.endsWith(H)){let e=c[o++],s=r.getAttribute(t).split(N),i=/([.?@])?(.*)/.exec(e);a.push({type:1,index:n,name:i[2],strings:s,ctor:"."===i[1]?tu:"?"===i[1]?td:"@"===i[1]?tp:tc}),r.removeAttribute(t)}else t.startsWith(N)&&(a.push({type:6,index:n}),r.removeAttribute(t));if(Z.test(r.tagName)){let t=r.textContent.split(N),e=t.length-1;if(e>0){r.textContent=x?x.emptyScript:"";for(let s=0;s<e;s++)r.append(t[s],L()),ts.nextNode(),a.push({type:2,index:++n});r.append(t[e],L())}}}else if(8===r.nodeType){if(r.data===R)a.push({type:2,index:n});else{let t=-1;for(;-1!==(t=r.data.indexOf(N,t+1));)a.push({type:7,index:n}),t+=N.length-1}}n++}}static createElement(t,e){let s=j.createElement("template");return s.innerHTML=t,s}};function to(t,e,s=t,i){var r,n,o;if(e===Y)return e;let l=void 0!==i?null==(r=s._$Co)?void 0:r[i]:s._$Cl,a=I(e)?void 0:e._$litDirective$;return l?.constructor!==a&&(null==(n=l?._$AO)||n.call(l,!1),void 0===a?l=void 0:(l=new a(t))._$AT(t,s,i),void 0!==i?(null!=(o=s._$Co)?o:s._$Co=[])[i]=l:s._$Cl=l),void 0!==l&&(e=to(t,l._$AS(t,e.values),l,i)),e}(0,r.a)(to,"f$1");var tl,ta=class{static{(0,r.a)(this,"G")}constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){var e;let{el:{content:s},parts:i}=this._$AD,r=(null!=(e=t?.creationScope)?e:j).importNode(s,!0);ts.currentNode=r;let n=ts.nextNode(),o=0,l=0,a=i[0];for(;void 0!==a;){if(o===a.index){let e;2===a.type?e=new th(n,n.nextSibling,this,t):1===a.type?e=new a.ctor(n,a.name,a.strings,this,t):6===a.type&&(e=new tf(n,this,t)),this._$AV.push(e),a=i[++l]}o!==a?.index&&(n=ts.nextNode(),o++)}return ts.currentNode=j,r}p(t){let e=0;for(let s of this._$AV)void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}},th=class t{static{(0,r.a)(this,"b$1")}get _$AU(){var t,e;return null!=(e=null==(t=this._$AM)?void 0:t._$AU)?e:this._$Cv}constructor(t,e,s,i){var r;this.type=2,this._$AH=tt,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=i,this._$Cv=null==(r=i?.isConnected)||r}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return void 0!==e&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){I(t=to(this,t,e))?t===tt||null==t||""===t?(this._$AH!==tt&&this._$AR(),this._$AH=tt):t!==this._$AH&&t!==Y&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):D(t)?this.k(t):this._(t)}S(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.S(t))}_(t){this._$AH!==tt&&I(this._$AH)?this._$AA.nextSibling.data=t:this.T(j.createTextNode(t)),this._$AH=t}$(t){var e;let{values:s,_$litType$:i}=t,r="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=tn.createElement(ti(i.h,i.h[0]),this.options)),i);if((null==(e=this._$AH)?void 0:e._$AD)===r)this._$AH.p(s);else{let t=new ta(r,this),e=t.u(this.options);t.p(s),this.T(e),this._$AH=t}}_$AC(t){let e=te.get(t.strings);return void 0===e&&te.set(t.strings,e=new tn(t)),e}k(e){z(this._$AH)||(this._$AH=[],this._$AR());let s=this._$AH,i,r=0;for(let n of e)r===s.length?s.push(i=new t(this.S(L()),this.S(L()),this,this.options)):i=s[r],i._$AI(n),r++;r<s.length&&(this._$AR(i&&i._$AB.nextSibling,r),s.length=r)}_$AR(t=this._$AA.nextSibling,e){var s;for(null==(s=this._$AP)||s.call(this,!1,!0,e);t&&t!==this._$AB;){let e=t.nextSibling;t.remove(),t=e}}setConnected(t){var e;void 0===this._$AM&&(this._$Cv=t,null==(e=this._$AP)||e.call(this,t))}},tc=class{static{(0,r.a)(this,"M")}get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,i,r){this.type=1,this._$AH=tt,this._$AN=void 0,this.element=t,this.name=e,this._$AM=i,this.options=r,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=tt}_$AI(t,e=this,s,i){let r=this.strings,n=!1;if(void 0===r)(n=!I(t=to(this,t,e,0))||t!==this._$AH&&t!==Y)&&(this._$AH=t);else{let i=t,o,l;for(t=r[0],o=0;o<r.length-1;o++)(l=to(this,i[s+o],e,o))===Y&&(l=this._$AH[o]),n||(n=!I(l)||l!==this._$AH[o]),l===tt?t=tt:t!==tt&&(t+=(l??"")+r[o+1]),this._$AH[o]=l}n&&!i&&this.j(t)}j(t){t===tt?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},tu=class extends tc{static{(0,r.a)(this,"J")}constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===tt?void 0:t}},td=class extends tc{static{(0,r.a)(this,"K")}constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==tt)}},tp=class extends tc{static{(0,r.a)(this,"Q")}constructor(t,e,s,i,r){super(t,e,s,i,r),this.type=5}_$AI(t,e=this){var s;if((t=null!=(s=to(this,t,e,0))?s:tt)===Y)return;let i=this._$AH,r=t===tt&&i!==tt||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,n=t!==tt&&(i===tt||r);r&&this.element.removeEventListener(this.name,this,i),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e,s;"function"==typeof this._$AH?this._$AH.call(null!=(s=null==(e=this.options)?void 0:e.host)?s:this.element,t):this._$AH.handleEvent(t)}},tf=class{static{(0,r.a)(this,"X")}constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){to(this,t)}},t$=T.litHtmlPolyfillSupport;t$?.(tn,th),(null!=(tl=T.litHtmlVersions)?tl:T.litHtmlVersions=[]).push("3.1.4");var t_,tv=(0,r.a)((t,e,s)=>{var i,r;let n=null!=(i=s?.renderBefore)?i:e,o=n._$litPart$;if(void 0===o){let t=null!=(r=s?.renderBefore)?r:null;n._$litPart$=o=new th(e.insertBefore(L(),t),t,void 0,s??{})}return o._$AI(t),o},"et"),tg=class extends U{static{(0,r.a)(this,"n")}constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var t;let e=super.createRenderRoot();return null!=(t=this.renderOptions).renderBefore||(t.renderBefore=e.firstChild),e}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=tv(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),null==(t=this._$Do)||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),null==(t=this._$Do)||t.setConnected(!1)}render(){return Y}};tg._$litElement$=!0,tg.finalized=!0,null==(t_=globalThis.litElementHydrateSupport)||t_.call(globalThis,{LitElement:tg});var ty=globalThis.litElementPolyfillSupport;ty?.({LitElement:tg}),(null!=(i=globalThis.litElementVersions)?i:globalThis.litElementVersions=[]).push("4.0.6");var tm=(0,r.a)(t=>(e,s)=>{void 0!==s?s.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)},"s"),tA=Object.defineProperty,tb=Object.defineProperties,tE=Object.getOwnPropertyDescriptors,tS=Object.getOwnPropertySymbols,tw=Object.prototype.hasOwnProperty,tP=Object.prototype.propertyIsEnumerable,tC=(0,r.a)((t,e,s)=>e in t?tA(t,e,{enumerable:!0,configurable:!0,writable:!0,value:s}):t[e]=s,"d"),tO=(0,r.a)((t,e)=>{for(var s in e||(e={}))tw.call(e,s)&&tC(t,s,e[s]);if(tS)for(var s of tS(e))tP.call(e,s)&&tC(t,s,e[s]);return t},"l"),tU=(0,r.a)((t,e)=>tb(t,tE(e)),"u"),tT={attribute:!0,type:String,converter:w,reflect:!1,hasChanged:P},tx=(0,r.a)((t=tT,e,s)=>{let{kind:i,metadata:r}=s,n=globalThis.litPropertyMetadata.get(r);if(void 0===n&&globalThis.litPropertyMetadata.set(r,n=new Map),n.set(s.name,t),"accessor"===i){let{name:i}=s;return{set(s){let r=e.get.call(this);e.set.call(this,s),this.requestUpdate(i,r,t)},init(e){return void 0!==e&&this.P(i,void 0,t),e}}}if("setter"===i){let{name:i}=s;return function(s){let r=this[i];e.call(this,s),this.requestUpdate(i,r,t)}}throw Error("Unsupported decorator location: "+i)},"w");function tM(t){return(e,s)=>{let i;return"object"==typeof s?tx(t,e,s):(i=e.hasOwnProperty(s),e.constructor.createProperty(s,i?tU(tO({},t),{wrapped:!0}):t),i?Object.getOwnPropertyDescriptor(e,s):void 0)}}(0,r.a)(tM,"O")}}]);