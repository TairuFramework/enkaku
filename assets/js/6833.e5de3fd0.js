"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["6833"],{2475:function(e,t,r){var n,s;r.d(t,{a:function(){return n}}),(s=n||(n={})).idle="idle",s.loading="loading",s.rendering="rendering",s.streaming="streaming",s.error="error",s.aborted="aborted",s.done="done"},3255:function(e,t,r){r.d(t,{a:function(){return ea},b:function(){return eo},c:function(){return ei}});var n=r(2475),s=r(5650);Date.now().toString().slice(5);var a=BigInt(1e3),o=BigInt(1e6),i=BigInt(1e9);function l(e,t){if(t.length<65535)Array.prototype.push.apply(e,t);else{let r=t.length;for(let n=0;n<r;n+=65535)Array.prototype.push.apply(e,t.slice(n,n+65535))}}function c(e,...t){return e.replace(/%(?:(?<position>\d+)\$)?(?<width>-?\d*\.?\d*)(?<type>[dfs])/g,function(...e){let{width:r,type:n,position:s}=e[e.length-1],a=s?t[Number.parseInt(s)-1]:t.shift(),o=""===r?0:Number.parseInt(r);switch(n){case"d":return a.toString().padStart(o,"0");case"f":{let e=a,[t,n]=r.split(".").map(e=>Number.parseFloat(e));return"number"==typeof n&&n>=0&&(e=e.toFixed(n)),"number"==typeof t&&t>=0?e.toString().padStart(o,"0"):e.toString()}case"s":return o<0?a.toString().padEnd(-o," "):a.toString().padStart(o," ");default:return a}})}function u(){return"u">typeof WorkerGlobalScope&&self instanceof WorkerGlobalScope}function h(){return"u">typeof process&&process.release&&"node"===process.release.name}function d(){return BigInt(Math.floor(1e6*performance.now()))}function f(e){return"number"==typeof e&&(e=BigInt(e)),e<a?`${e}ns`:e<o?`${e/a}\u03BCs`:e<i?`${e/o}ms`:`${e/i}s`}function p(){return u()?d():h()||"u">typeof process&&"function"==typeof process?.hrtime?.bigint?process.hrtime.bigint():"u">typeof performance?d():BigInt(0)}function g(e,t){return t[1]===e[1]?e[0]-t[0]:t[1]-e[1]}function m(e){if(0===e.length)return[];if(1===e.length)return e[0];for(let t=1;t<e.length;t++)if(e[t].length<e[0].length){let r=e[0];e[0]=e[t],e[t]=r}let t=new Map;for(let r of e[0])t.set(r,1);for(let r=1;r<e.length;r++){let n=0;for(let s of e[r]){let e=t.get(s);e===r&&(t.set(s,e+1),n++)}if(0===n)return[]}return e[0].filter(r=>{let n=t.get(r);return void 0!==n&&t.set(r,0),n===e.length})}function S(e,t){let r={},n=t.length;for(let s=0;s<n;s++){let n=t[s],a=n.split("."),o=e,i=a.length;for(let e=0;e<i;e++)if("object"==typeof(o=o[a[e]])){if(null!==o&&"lat"in o&&"lon"in o&&"number"==typeof o.lat&&"number"==typeof o.lon){o=r[n]=o;break}if(!Array.isArray(o)&&null!==o&&e===i-1){o=void 0;break}}else if((null===o||"object"!=typeof o)&&e<i-1){o=void 0;break}"u">typeof o&&(r[n]=o)}return r}function y(e,t){return S(e,[t])[t]}function I(e,t){e.hits=e.hits.map(e=>({...e,document:{...e.document,...t.reduce((e,t)=>{let r=t.split("."),n=r.pop(),s=e;for(let e of r)s[e]=s[e]??{},s=s[e];return s[n]=null,e},e.document)}}))}function b(e){return Array.isArray(e)?e.some(e=>b(e)):e?.constructor?.name==="AsyncFunction"}(0,s.a)(l,"safeArrayPush"),(0,s.a)(c,"sprintf"),(0,s.a)(u,"isInsideWebWorker"),(0,s.a)(h,"isInsideNode"),(0,s.a)(d,"getNanosecondTimeViaPerformance"),(0,s.a)(f,"formatNanoseconds"),(0,s.a)(p,"getNanosecondsTime"),(0,s.a)(g,"sortTokenScorePredicate"),(0,s.a)(m,"intersect"),(0,s.a)(S,"getDocumentProperties"),(0,s.a)(y,"getNested"),(0,s.a)(I,"removeVectorsFromHits"),(0,s.a)(b,"isAsyncFunction");var _=["arabic","armenian","bulgarian","danish","dutch","english","finnish","french","german","greek","hungarian","indian","indonesian","irish","italian","lithuanian","nepali","norwegian","portuguese","romanian","russian","serbian","slovenian","spanish","swedish","tamil","turkish","ukrainian","sanskrit"].join(`
 - `),E={NO_LANGUAGE_WITH_CUSTOM_TOKENIZER:"Do not pass the language option to create when using a custom tokenizer.",LANGUAGE_NOT_SUPPORTED:`Language "%s" is not supported.
Supported languages are:
 - ${_}`,INVALID_STEMMER_FUNCTION_TYPE:"config.stemmer property must be a function.",MISSING_STEMMER:'As of version 1.0.0 @orama/orama does not ship non English stemmers by default. To solve this, please explicitly import and specify the "%s" stemmer from the package @orama/stemmers. See https://docs.orama.com/open-source/text-analysis/stemming for more information.',CUSTOM_STOP_WORDS_MUST_BE_FUNCTION_OR_ARRAY:"Custom stop words array must only contain strings.",UNSUPPORTED_COMPONENT:'Unsupported component "%s".',COMPONENT_MUST_BE_FUNCTION:'The component "%s" must be a function.',COMPONENT_MUST_BE_FUNCTION_OR_ARRAY_FUNCTIONS:'The component "%s" must be a function or an array of functions.',INVALID_SCHEMA_TYPE:'Unsupported schema type "%s" at "%s". Expected "string", "boolean" or "number" or array of them.',DOCUMENT_ID_MUST_BE_STRING:'Document id must be of type "string". Got "%s" instead.',DOCUMENT_ALREADY_EXISTS:'A document with id "%s" already exists.',DOCUMENT_DOES_NOT_EXIST:'A document with id "%s" does not exists.',MISSING_DOCUMENT_PROPERTY:'Missing searchable property "%s".',INVALID_DOCUMENT_PROPERTY:'Invalid document property "%s": expected "%s", got "%s"',UNKNOWN_INDEX:'Invalid property name "%s". Expected a wildcard string ("*") or array containing one of the following properties: %s',INVALID_BOOST_VALUE:"Boost value must be a number greater than, or less than 0.",INVALID_FILTER_OPERATION:"You can only use one operation per filter, you requested %d.",SCHEMA_VALIDATION_FAILURE:'Cannot insert document due schema validation failure on "%s" property.',INVALID_SORT_SCHEMA_TYPE:'Unsupported sort schema type "%s" at "%s". Expected "string" or "number".',CANNOT_SORT_BY_ARRAY:'Cannot configure sort for "%s" because it is an array (%s).',UNABLE_TO_SORT_ON_UNKNOWN_FIELD:'Unable to sort on unknown field "%s". Allowed fields: %s',SORT_DISABLED:"Sort is disabled. Please read the documentation at https://docs.oramasearch for more information.",UNKNOWN_GROUP_BY_PROPERTY:'Unknown groupBy property "%s".',INVALID_GROUP_BY_PROPERTY:'Invalid groupBy property "%s". Allowed types: "%s", but given "%s".',UNKNOWN_FILTER_PROPERTY:'Unknown filter property "%s".',INVALID_VECTOR_SIZE:'Vector size must be a number greater than 0. Got "%s" instead.',INVALID_VECTOR_VALUE:'Vector value must be a number greater than 0. Got "%s" instead.',INVALID_INPUT_VECTOR:`Property "%s" was declared as a %s-dimensional vector, but got a %s-dimensional vector instead.
Input vectors must be of the size declared in the schema, as calculating similarity between vectors of different sizes can lead to unexpected results.`,WRONG_SEARCH_PROPERTY_TYPE:'Property "%s" is not searchable. Only "string" properties are searchable.',FACET_NOT_SUPPORTED:'Facet doens\'t support the type "%s".',INVALID_DISTANCE_SUFFIX:'Invalid distance suffix "%s". Valid suffixes are: cm, m, km, mi, yd, ft.',INVALID_SEARCH_MODE:'Invalid search mode "%s". Valid modes are: "fulltext", "vector", "hybrid".',MISSING_VECTOR_AND_SECURE_PROXY:"No vector was provided and no secure proxy was configured. Please provide a vector or configure an Orama Secure Proxy to perform hybrid search.",MISSING_TERM:'"term" is a required parameter when performing hybrid search. Please provide a search term.',INVALID_VECTOR_INPUT:'Invalid "vector" property. Expected an object with "value" and "property" properties, but got "%s" instead.',PLUGIN_CRASHED:"A plugin crashed during initialization. Please check the error message for more information:",PLUGIN_SECURE_PROXY_NOT_FOUND:`Could not find '@orama/secure-proxy-plugin' installed in your Orama instance.
Please install it before proceeding with creating an answer session.
Read more at https://docs.orama.com/open-source/plugins/plugin-secure-proxy#plugin-secure-proxy
`,PLUGIN_SECURE_PROXY_MISSING_CHAT_MODEL:`Could not find a chat model defined in the secure proxy plugin configuration.
Please provide a chat model before proceeding with creating an answer session.
Read more at https://docs.orama.com/open-source/plugins/plugin-secure-proxy#plugin-secure-proxy
`,ANSWER_SESSION_LAST_MESSAGE_IS_NOT_ASSISTANT:"The last message in the session is not an assistant message. Cannot regenerate non-assistant messages.",PLUGIN_COMPONENT_CONFLICT:'The component "%s" is already defined. The plugin "%s" is trying to redefine it.'};function O(e,...t){let r=Error(c(E[e]??`Unsupported Orama Error code: ${e}`,...t));return r.code=e,"captureStackTrace"in Error.prototype&&Error.captureStackTrace(r),r}function N(e,t){if("string"==typeof t){let r=e.idToInternalId.get(t);if(r)return r;let n=e.idToInternalId.size+1;return e.idToInternalId.set(t,n),e.internalIdToId.push(t),n}return t>e.internalIdToId.length?N(e,t.toString()):t}function w(e,t){if(e.internalIdToId.length<t)throw Error(`Invalid internalId ${t}`);return e.internalIdToId[t-1]}function T(e,t,r,n,s){if(e.some(b))return(async()=>{for(let a of e)await a(t,r,n,s)})();for(let a of e)a(t,r,n,s)}function A(e,t,r,n){if(e.some(b))return(async()=>{for(let s of e)await s(t,r,n)})();for(let s of e)s(t,r,n)}function v(e){return e.documentsStore.count(e.data.docs)}(0,s.a)(O,"createError"),(0,s.a)(N,"getInternalDocumentId"),(0,s.a)(w,"getDocumentIdFromInternalId"),(0,s.a)(T,"runAfterSearch"),(0,s.a)(A,"runBeforeSearch"),(0,s.a)(v,"count");var C="fulltext";function P(e,t){return e[1]-t[1]}function R(e,t){return t[1]-e[1]}function x(e="desc"){return"asc"===e.toLowerCase()?P:R}function D(e,t,r){let n={},s=t.map(([e])=>e),a=e.documentsStore.getMultiple(e.data.docs,s),o=Object.keys(r),i=e.index.getSearchablePropertiesWithTypes(e.data.index);for(let e of o){let t;if("number"===i[e]){let{ranges:n}=r[e],s=n.length,a=Array.from({length:s});for(let e=0;e<s;e++){let t=n[e];a[e]=[`${t.from}-${t.to}`,0]}t=Object.fromEntries(a)}n[e]={count:0,values:t??{}}}let l=a.length;for(let e=0;e<l;e++){let t=a[e];for(let e of o){let s=e.includes(".")?y(t,e):t[e],a=i[e],o=n[e].values;switch(a){case"number":M(r[e].ranges,o)(s);break;case"number[]":{let t=new Set,n=M(r[e].ranges,o,t);for(let e of s)n(e);break}case"boolean":case"enum":case"string":U(o,a)(s);break;case"boolean[]":case"enum[]":case"string[]":{let e=U(o,"boolean[]"===a?"boolean":"string",new Set);for(let t of s)e(t);break}default:throw O("FACET_NOT_SUPPORTED",a)}}}for(let e of o){let t=n[e];if(t.count=Object.keys(t.values).length,"string"===i[e]){let n=r[e],s=x(n.sort);t.values=Object.fromEntries(Object.entries(t.values).sort(s).slice(n.offset??0,n.limit??10))}}return n}function M(e,t,r){return n=>{for(let s of e){let e=`${s.from}-${s.to}`;r?.has(e)||n>=s.from&&n<=s.to&&(void 0===t[e]?t[e]=1:(t[e]++,r?.add(e)))}}}function U(e,t,r){let n="boolean"===t?"false":"";return t=>{let s=t?.toString()??n;r?.has(s)||(e[s]=(e[s]??0)+1,r?.add(s))}}(0,s.a)(P,"sortAsc"),(0,s.a)(R,"sortDesc"),(0,s.a)(x,"sortingPredicateBuilder"),(0,s.a)(D,"getFacets"),(0,s.a)(M,"calculateNumberFacetBuilder"),(0,s.a)(U,"calculateBooleanStringOrEnumFacetBuilder");var k={reducer:(0,s.a)((e,t,r,n)=>(t[n]=r,t),"reducer"),getInitialValue:(0,s.a)(e=>Array.from({length:e}),"getInitialValue")},L=["string","number","boolean"];function V(e,t,r){let n=r.properties,s=n.length,a=e.index.getSearchablePropertiesWithTypes(e.data.index);for(let e=0;e<s;e++){let t=n[e];if(typeof a[t]>"u")throw O("UNKNOWN_GROUP_BY_PROPERTY",t);if(!L.includes(a[t]))throw O("INVALID_GROUP_BY_PROPERTY",t,L.join(", "),a[t])}let o=t.map(([t])=>w(e.internalDocumentIDStore,t)),i=e.documentsStore.getMultiple(e.data.docs,o),l=i.length,c=r.maxResult||Number.MAX_SAFE_INTEGER,u=[],h={};for(let e=0;e<s;e++){let t=n[e],r={property:t,perValue:{}},s=new Set;for(let e=0;e<l;e++){let n=y(i[e],t);if(typeof n>"u")continue;let a="boolean"!=typeof n?n:""+n,o=r.perValue[a]??{indexes:[],count:0};o.count>=c||(o.indexes.push(e),o.count++,r.perValue[a]=o,s.add(n))}u.push(Array.from(s)),h[t]=r}let d=B(u),f=d.length,p=[];for(let e=0;e<f;e++){let t=d[e],r=t.length,s={values:[],indexes:[]},a=[];for(let e=0;e<r;e++){let r=t[e],o=n[e];a.push(h[o].perValue["boolean"!=typeof r?r:""+r].indexes),s.values.push(r)}s.indexes=m(a).sort((e,t)=>e-t),0!==s.indexes.length&&p.push(s)}let g=p.length,S=Array.from({length:g});for(let e=0;e<g;e++){let n=p[e],s=r.reduce||k,a=n.indexes.map(e=>({id:o[e],score:t[e][1],document:i[e]})),l=s.reducer.bind(null,n.values),c=s.getInitialValue(n.indexes.length),u=a.reduce(l,c);S[e]={values:n.values,result:u}}return S}function B(e,t=0){if(t+1===e.length)return e[t].map(e=>[e]);let r=e[t],n=B(e,t+1),s=[];for(let e of r)for(let t of n){let r=[e];l(r,t),s.push(r)}return s}function G(e,t,r){let n,s,{term:a,properties:o}=t,i=e.data.index,l=e.caches.propertiesToSearch;if(!l){let t=e.index.getSearchablePropertiesWithTypes(i);l=(l=e.index.getSearchableProperties(i)).filter(e=>t[e].startsWith("string")),e.caches.propertiesToSearch=l}if(o&&"*"!==o){for(let e of o)if(!l.includes(e))throw O("UNKNOWN_INDEX",e,l.join(", "));l=l.filter(e=>o.includes(e))}if(Object.keys(t.where??{}).length>0&&(n=e.index.searchByWhereClause(i,e.tokenizer,t.where,r)),a||o){let o=v(e);s=e.index.search(i,a||"",e.tokenizer,r,l,t.exact||!1,t.tolerance||0,t.boost||{},Y(t.relevance),o,n)}else s=(n?Array.from(n):Object.keys(e.documentsStore.getAll(e.data.docs))).map(e=>[+e,0]);return s}function F(e,t,r){let n=p();function a(){let s,a=Object.keys(e.data.index.vectorIndexes),o=t.facets&&Object.keys(t.facets).length>0,{limit:i=10,offset:l=0,distinctOn:c,includeVectors:u=!1}=t,h=!0===t.preflight,d=G(e,t,r);if(t.sortBy){if("function"==typeof t.sortBy){let r=d.map(([e])=>e),n=e.documentsStore.getMultiple(e.data.docs,r).map((e,t)=>[d[t][0],d[t][1],e]);n.sort(t.sortBy),d=n.map(([e,t])=>[e,t])}else d=e.sorter.sortBy(e.data.sorting,d,t.sortBy).map(([t,r])=>[N(e.internalDocumentIDStore,t),r])}else d=d.sort(g);h||(s=c?et(e,d,l,i,c):er(e,d,l,i));let f={elapsed:{formatted:"",raw:0},hits:[],count:d.length};if("u">typeof s&&(f.hits=s.filter(Boolean),u||I(f,a)),o){let r=D(e,d,t.facets);f.facets=r}return t.groupBy&&(f.groups=V(e,d,t.groupBy)),f.elapsed=e.formatElapsedTime(p()-n),f}async function o(){e.beforeSearch&&await A(e.beforeSearch,e,t,r);let n=a();return e.afterSearch&&await T(e.afterSearch,e,t,r,n),n}return(0,s.a)(a,"performSearchLogic"),(0,s.a)(o,"executeSearchAsync"),e.beforeSearch?.length||e.afterSearch?.length?o():a()}(0,s.a)(V,"getGroups"),(0,s.a)(B,"calculateCombination"),(0,s.a)(G,"innerFullTextSearch"),(0,s.a)(F,"fullTextSearch");var j={k:1.2,b:.75,d:.5};function Y(e){let t=e??{};return t.k=t.k??j.k,t.b=t.b??j.b,t.d=t.d??j.d,t}function W(e,t,r){let n=t.vector;if(n&&(!("value"in n)||!("property"in n)))throw O("INVALID_VECTOR_INPUT",Object.keys(n).join(", "));let s=e.data.index.vectorIndexes[n.property],a=s.node.size;if(n?.value.length!==a)throw n?.property===void 0||n?.value.length===void 0?O("INVALID_INPUT_VECTOR","undefined",a,"undefined"):O("INVALID_INPUT_VECTOR",n.property,a,n.value.length);let o=e.data.index,i;return Object.keys(t.where??{}).length>0&&(i=e.index.searchByWhereClause(o,e.tokenizer,t.where,r)),s.node.find(n.value,t.similarity??.8,i)}function z(e,t,r="english"){let n=p();function a(){let s=W(e,t,r).sort(g),a=[];t.facets&&Object.keys(t.facets).length>0&&(a=D(e,s,t.facets));let o=t.vector.property,i=t.includeVectors??!1,l=t.limit??10,c=t.offset??0,u=Array.from({length:l});for(let t=0;t<l;t++){let r=s[t+c];if(!r)break;let n=e.data.docs.docs[r[0]];if(n){i||(n[o]=null);let s={id:w(e.internalDocumentIDStore,r[0]),score:r[1],document:n};u[t]=s}}let h=[];t.groupBy&&(h=V(e,s,t.groupBy));let d=p()-n;return{count:s.length,hits:u.filter(Boolean),elapsed:{raw:Number(d),formatted:f(d)},...a?{facets:a}:{},...h?{groups:h}:{}}}async function o(){e.beforeSearch&&await A(e.beforeSearch,e,t,r);let n=a();return e.afterSearch&&await T(e.afterSearch,e,t,r,n),n}return(0,s.a)(a,"performSearchLogic"),(0,s.a)(o,"executeSearchAsync"),e.beforeSearch?.length||e.afterSearch?.length?o():a()}function H(e,t,r){let n=q(G(e,t,r)),s=W(e,t,r),a=t.hybridWeights;return Z(n,s,t.term??"",a)}function X(e,t,r){let n=p();function a(){let s,a=H(e,t,r),o;t.facets&&Object.keys(t.facets).length>0&&(o=D(e,a,t.facets)),t.groupBy&&(s=V(e,a,t.groupBy));let i=er(e,a,t.offset??0,t.limit??10).filter(Boolean),l=p(),c={count:a.length,elapsed:{raw:Number(l-n),formatted:f(l-n)},hits:i,...o?{facets:o}:{},...s?{groups:s}:{}};return t.includeVectors||I(c,Object.keys(e.data.index.vectorIndexes)),c}async function o(){e.beforeSearch&&await A(e.beforeSearch,e,t,r);let n=a();return e.afterSearch&&await T(e.afterSearch,e,t,r,n),n}return(0,s.a)(a,"performSearchLogic"),(0,s.a)(o,"executeSearchAsync"),e.beforeSearch?.length||e.afterSearch?.length?o():a()}function $(e){return e[1]}function q(e){let t=Math.max.apply(Math,e.map($));return e.map(([e,r])=>[e,r/t])}function K(e,t){return e/t}function Q(e,t){return(r,n)=>r*e+n*t}function Z(e,t,r,n){let s=Math.max.apply(Math,e.map($)),a=Math.max.apply(Math,t.map($)),{text:o,vector:i}=n&&n.text&&n.vector?n:J(),l=new Map,c=e.length,u=Q(o,i);for(let t=0;t<c;t++){let[r,n]=e[t],a=u(K(n,s),0);l.set(r,a)}let h=t.length;for(let e=0;e<h;e++){let[r,n]=t[e],s=K(n,a),o=l.get(r)??0;l.set(r,o+u(0,s))}return[...l].sort((e,t)=>t[1]-e[1])}function J(e){return{text:.5,vector:.5}}function ee(e,t,r){let n=t.mode??C;if(n===C)return F(e,t,r);if("vector"===n)return z(e,t);if("hybrid"===n)return X(e,t);throw O("INVALID_SEARCH_MODE",n)}function et(e,t,r,n,s){let a=e.data.docs,o=new Map,i=[],l=new Set,c=t.length,u=0;for(let h=0;h<c;h++){let c=t[h];if(typeof c>"u")continue;let[d,f]=c;if(l.has(d))continue;let p=e.documentsStore.get(a,d),g=y(p,s);if(!(typeof g>"u"||o.has(g))&&(o.set(g,!0),!(++u<=r)&&(i.push({id:w(e.internalDocumentIDStore,d),score:f,document:p}),l.add(d),u>=r+n)))break}return i}function er(e,t,r,n){let s=e.data.docs,a=Array.from({length:n}),o=new Set;for(let i=r;i<n+r;i++){let r=t[i];if(typeof r>"u")break;let[n,l]=r;if(!o.has(n)){let t=e.documentsStore.get(s,n);a[i]={id:w(e.internalDocumentIDStore,n),score:l,document:t},o.add(n)}}return a}(0,s.a)(Y,"applyDefault"),(0,s.a)(W,"innerVectorSearch"),(0,s.a)(z,"searchVector"),(0,s.a)(H,"innerHybridSearch"),(0,s.a)(X,"hybridSearch"),(0,s.a)($,"extractScore"),(0,s.a)(q,"minMaxScoreNormalization"),(0,s.a)(K,"normalizeScore"),(0,s.a)(Q,"hybridScoreBuilder"),(0,s.a)(Z,"mergeAndRankResults"),(0,s.a)(J,"getQueryWeights"),(0,s.a)(ee,"search"),(0,s.a)(et,"fetchDocumentsWithDistinct"),(0,s.a)(er,"fetchDocuments");var en=class{static{(0,s.a)(this,"AnswerSession")}db;proxy=null;config;abortController=null;lastInteractionParams=null;chatModel=null;conversationID;messages=[];events;initPromise;state=[];constructor(e,t){this.db=e,this.config=t,this.init(),this.messages=t.initialMessages||[],this.events=t.events||{},this.conversationID=t.conversationID||this.generateRandomID()}async ask(e){await this.initPromise;let t="";for await(let r of(await this.askStream(e)))t+=r;return t}async askStream(e){return await this.initPromise,this.fetchAnswer(e)}abortAnswer(){this.abortController?.abort(),this.state[this.state.length-1].aborted=!0,this.triggerStateChange()}getMessages(){return this.messages}clearSession(){this.messages=[],this.state=[]}regenerateLast({stream:e=!0}){if(0===this.state.length||0===this.messages.length)throw Error("No messages to regenerate");if(this.messages.at(-1)?.role!=="assistant")throw O("ANSWER_SESSION_LAST_MESSAGE_IS_NOT_ASSISTANT");return this.messages.pop(),this.state.pop(),e?this.askStream(this.lastInteractionParams):this.ask(this.lastInteractionParams)}async *fetchAnswer(e){if(!this.chatModel)throw O("PLUGIN_SECURE_PROXY_MISSING_CHAT_MODEL");this.abortController=new AbortController,this.lastInteractionParams=e;let t=this.generateRandomID();this.messages.push({role:"user",content:e.term??""}),this.state.push({interactionId:t,aborted:!1,loading:!0,query:e.term??"",response:"",sources:null,translatedQuery:null,error:!1,errorMessage:null});let r=this.state.length-1;this.addEmptyAssistantMessage(),this.triggerStateChange();try{let t=await ee(this.db,e);for await(let e of(this.state[r].sources=t,this.triggerStateChange(),this.proxy.chatStream({model:this.chatModel,messages:this.messages})))yield e,this.state[r].response+=e,this.messages.findLast(e=>"assistant"===e.role).content+=e,this.triggerStateChange()}catch(e){"AbortError"===e.name?this.state[r].aborted=!0:(this.state[r].error=!0,this.state[r].errorMessage=e.toString()),this.triggerStateChange()}return this.state[r].loading=!1,this.triggerStateChange(),this.state[r].response}generateRandomID(e=24){return Array.from({length:e},()=>Math.floor(36*Math.random()).toString(36)).join("")}triggerStateChange(){this.events.onStateChange&&this.events.onStateChange(this.state)}async init(){let e=this;async function t(){return await e.db.plugins.find(e=>"orama-secure-proxy"===e.name)}(0,s.a)(t,"getPlugin");let r=await t();if(!r)throw O("PLUGIN_SECURE_PROXY_NOT_FOUND");let n=r.extra;if(this.proxy=n.proxy,this.config.systemPrompt&&this.messages.push({role:"system",content:this.config.systemPrompt}),n?.pluginParams?.chat?.model)this.chatModel=n.pluginParams.chat.model;else throw O("PLUGIN_SECURE_PROXY_MISSING_CHAT_MODEL")}addEmptyAssistantMessage(){this.messages.push({role:"assistant",content:""})}};function es(e){return e&&"object"==typeof e&&"api_key"in e&&"endpoint"in e}(0,s.a)(es,"isOramaClient");var ea=class{static{(0,s.a)(this,"Switch")}invalidClientError="Invalid client. Expected either an OramaClient or an Orama OSS database.";client;clientType;isCloud=!1;isOSS=!1;constructor(e){if(this.client=e,es(e))this.clientType="cloud",this.isCloud=!0;else if("object"==typeof e&&"id"in e&&"tokenizer"in e)this.clientType="oss",this.isOSS=!0;else throw Error(this.invalidClientError)}async search(e,t){return this.isCloud?this.client.search(e,t):ee(this.client,e)}createAnswerSession(e){if(this.isCloud)return this.client.createAnswerSession(e);if(this.isOSS)return new en(this.client,{conversationID:e.conversationID,initialMessages:e.initialMessages,events:e.events,userContext:e.userContext,systemPrompt:e.systemPrompt});throw Error(this.invalidClientError)}},eo=class extends Error{static{(0,s.a)(this,"OramaClientNotInitializedError")}constructor(){super("Orama Client is not initialized")}},ei=class{static{(0,s.a)(this,"ChatService")}constructor(e,t){this.sendQuestion=(e,t,r)=>{if(!this.oramaClient)throw new eo;let a={term:e,related:{howMany:3,format:"question"}};if(!this.answerSession){let e=this.chatStore.state.interactions;this.answerSession=this.oramaClient.createAnswerSession({events:{onStateChange:(0,s.a)(t=>{let s=t.filter(e=>!!e.query);this.chatStore.state.interactions=[...e||[],...s.map((e,s)=>{var o,i,l;let c=t.length-1===s,u=n.a.loading,h=[];return e.aborted?u=n.a.aborted:e.loading&&e.sources?u=n.a.rendering:e.loading&&e.response?u=n.a.streaming:!e.loading&&e.response&&(u=n.a.done),e.sources&&(h=Array.isArray(e.sources)?null===(o=e.sources)||void 0===o?void 0:o.map(e=>e.document):null===(i=e.sources.hits)||void 0===i?void 0:i.map(e=>e.document)),c&&u===n.a.done&&(null===(l=r?.onAnswerGeneratedCallback)||void 0===l||l.call(r,{askParams:a,query:e.query,sources:e.sources,answer:e.response,segment:e.segment,trigger:e.trigger})),{query:e.query,interactionId:e.interactionId,response:e.response,relatedQueries:e.relatedQueries,status:u,latest:c,sources:h}})]},"onStateChange")}}),"cloud"===this.oramaClient.clientType&&t&&this.answerSession.setSystemPromptConfiguration({systemPrompts:t})}return this.answerSession.ask(a).catch(e=>{this.chatStore.state.interactions=this.chatStore.state.interactions.map((e,t)=>t===this.chatStore.state.interactions.length-1?Object.assign(Object.assign({},e),{status:n.a.error}):e),console.error(e)})},this.abortAnswer=()=>{if(!this.answerSession)throw new eo;this.answerSession.abortAnswer()},this.regenerateLatest=async()=>{if(!this.answerSession)throw new eo;this.answerSession.regenerateLast({stream:!1})},this.resetChat=async()=>{if(!this.answerSession)throw new eo;this.chatStore.state.interactions.length<1||(["loading","rendering","streaming"].includes(this.chatStore.state.interactions[this.chatStore.state.interactions.length-1].status)&&this.answerSession.abortAnswer(),this.answerSession.clearSession(),this.chatStore.state.interactions=[])},this.oramaClient=new ea(e),this.chatStore=t}}},6658:function(e,t,r){r.d(t,{a:function(){return y},b:function(){return I},c:function(){return b}});var n=r(6574),s=r(7414),a=r(5650),o=(0,a.a)((e,t,r)=>{let n=e.get(t);n?n.includes(r)||n.push(r):e.set(t,[r])},"appendToMap"),i=(0,a.a)((e,t)=>{let r;return(...n)=>{r&&clearTimeout(r),r=setTimeout(()=>{r=0,e(...n)},t)}},"debounce"),l=(0,a.a)(e=>!("isConnected"in e)||e.isConnected,"isConnected"),c=i(e=>{for(let t of e.keys())e.set(t,e.get(t).filter(l))},2e3),u=(0,a.a)(()=>{if("function"!=typeof s.f)return{};let e=new Map;return{dispose:(0,a.a)(()=>e.clear(),"dispose"),get:(0,a.a)(t=>{let r=(0,s.f)();r&&o(e,t,r)},"get"),set:(0,a.a)(t=>{let r=e.get(t);r&&e.set(t,r.filter(s.g)),c(e)},"set"),reset:(0,a.a)(()=>{e.forEach(e=>e.forEach(s.g)),c(e)},"reset")}},"stencilSubscription"),h=(0,a.a)(e=>"function"==typeof e?e():e,"unwrap"),d=(0,a.a)((e,t=(e,t)=>e!==t)=>{let r=h(e),n=new Map(Object.entries(r??{})),s={dispose:[],get:[],set:[],reset:[]},o=(0,a.a)(()=>{var t;n=new Map(Object.entries(null!==(t=h(e))&&void 0!==t?t:{})),s.reset.forEach(e=>e())},"reset"),i=(0,a.a)(()=>{s.dispose.forEach(e=>e()),o()},"dispose"),l=(0,a.a)(e=>(s.get.forEach(t=>t(e)),n.get(e)),"get"),c=(0,a.a)((e,r)=>{let a=n.get(e);t(r,a,e)&&(n.set(e,r),s.set.forEach(t=>t(e,r,a)))},"set"),u=typeof Proxy>"u"?{}:new Proxy(r,{get:(e,t)=>l(t),ownKeys:e=>Array.from(n.keys()),getOwnPropertyDescriptor:()=>({enumerable:!0,configurable:!0}),has:(e,t)=>n.has(t),set:(e,t,r)=>(c(t,r),!0)}),d=(0,a.a)((e,t)=>(s[e].push(t),()=>{f(s[e],t)}),"on");return{state:u,get:l,set:c,on:d,onChange:(0,a.a)((t,r)=>{let n=d("set",(e,n)=>{e===t&&r(n)}),s=d("reset",()=>r(h(e)[t]));return()=>{n(),s()}},"onChange"),use:(0,a.a)((...e)=>{let t=e.reduce((e,t)=>(t.set&&e.push(d("set",t.set)),t.get&&e.push(d("get",t.get)),t.reset&&e.push(d("reset",t.reset)),t.dispose&&e.push(d("dispose",t.dispose)),e),[]);return()=>t.forEach(e=>e())},"use"),dispose:i,reset:o,forceUpdate:(0,a.a)(e=>{let t=n.get(e);s.set.forEach(r=>r(e,t,t))},"forceUpdate")}},"createObservableMap"),f=(0,a.a)((e,t)=>{let r=e.indexOf(t);r>=0&&(e[r]=e[e.length-1],e.length--)},"removeFromArray"),p=(0,a.a)((e,t)=>{let r=d(e,t);return r.use(u()),r},"createStore"),g={global:{open:!1,currentTask:"search",currentTerm:""},search:{count:0,facets:[],facetProperty:"",results:[],resultMap:{},highlightedIndex:-1,loading:!1,error:!1,searchService:null,searchParams:null},chat:{chatService:null,interactions:[],sourceBaseURL:"",linksTarget:"_blank",linksRel:"noopener noreferrer",prompt:"",sourcesMap:{title:"title",description:"description",path:"path"}}},m=new Map,S=(0,a.a)((e,t)=>{let r=m.get(e);if(!r)throw Error("Invalid parent component Id");let n=r[t];if(!n)throw Error("Store not initialized");return n},"getParentComponentStore"),y=(0,a.a)((e,t)=>{let r=g[e];if(!r)throw Error("Invalid store name");let n=p(r);return m.has(t)?m.get(t)[e]=n:m.set(t,{[e]:n}),n},"initStore"),I=(0,a.a)(e=>{m.delete(e)},"removeAllStores");function b(e,t){let r=(0,n.i)(t);if(!r)throw Error("Failed to get store");return S(r.id,e)}(0,a.a)(b,"getStore")}}]);