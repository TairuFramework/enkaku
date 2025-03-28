"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["2998"],{7223:function(e,t,n){n.d(t,{Z:()=>C});var r=n("5367");n("3800");var l=n("620"),o=n("4867");function a(e){let{children:t,className:n}=e;return(0,r.jsx)("article",{className:n,children:t})}var s=n("4248");function i(e){let{className:t}=e,{metadata:n,isBlogPostPage:a}=(0,o.nO)(),{permalink:i,title:c}=n;return(0,r.jsx)(a?"h1":"h2",{className:(0,l.Z)("title_rbtK",t),children:a?c:(0,r.jsx)(s.Z,{to:i,children:c})})}var c=n("4510"),u=n("1152"),d=n("9287");function m(e){let{readingTime:t}=e,n=function(){let{selectMessage:e}=(0,u.c)();return t=>{let n=Math.ceil(t);return e(n,(0,c.I)({id:"theme.blog.post.readingTime.plurals",description:'Pluralized label for "{readingTime} min read". Use as much plural forms (separated by "|") as your language support (see https://www.unicode.org/cldr/cldr-aux/charts/34/supplemental/language_plural_rules.html)',message:"One min read|{readingTime} min read"},{readingTime:n}))}}();return(0,r.jsx)(r.Fragment,{children:n(t)})}function h(e){let{date:t,formattedDate:n}=e;return(0,r.jsx)("time",{dateTime:t,children:n})}function g(){return(0,r.jsx)(r.Fragment,{children:" \xb7 "})}function x(e){let{className:t}=e,{metadata:n}=(0,o.nO)(),{date:a,readingTime:s}=n,i=(0,d.P)({day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});return(0,r.jsxs)("div",{className:(0,l.Z)("container_Jq78","margin-vert--md",t),children:[(0,r.jsx)(h,{date:a,formattedDate:i.format(new Date(a))}),void 0!==s&&(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(g,{}),(0,r.jsx)(m,{readingTime:s})]})]})}var f=n("2583");let p={authorCol:"authorCol_Hc4K",imageOnlyAuthorRow:"imageOnlyAuthorRow_YEex",imageOnlyAuthorCol:"imageOnlyAuthorCol_gOL2"};function j(e){let{className:t}=e,{metadata:{authors:n},assets:a}=(0,o.nO)();if(0===n.length)return null;let s=n.every(e=>{let{name:t}=e;return!t}),i=1===n.length;return(0,r.jsx)("div",{className:(0,l.Z)("margin-top--md margin-bottom--sm",s?p.imageOnlyAuthorRow:"row",t),children:n.map((e,t)=>(0,r.jsx)("div",{className:(0,l.Z)(!s&&(i?"col col--12":"col col--6"),s?p.imageOnlyAuthorCol:p.authorCol),children:(0,r.jsx)(f.Z,{author:{...e,imageURL:a.authorsImageUrls[t]??e.imageURL}})},t))})}function v(){return(0,r.jsxs)("header",{children:[(0,r.jsx)(i,{}),(0,r.jsx)(x,{}),(0,r.jsx)(j,{})]})}var b=n("3609"),Z=n("5161");function N(e){let{children:t,className:n}=e,{isBlogPostPage:a}=(0,o.nO)();return(0,r.jsx)("div",{id:a?b.blogPostContainerID:void 0,className:(0,l.Z)("markdown",n),children:(0,r.jsx)(Z.Z,{children:t})})}var y=n("2175"),_=n("6522"),w=n("1508");function O(){return(0,r.jsx)("b",{children:(0,r.jsx)(c.Z,{id:"theme.blog.post.readMore",description:"The label used in blog post item excerpts to link to full blog posts",children:"Read more"})})}function L(e){let{blogPostTitle:t,...n}=e;return(0,r.jsx)(s.Z,{"aria-label":(0,c.I)({message:"Read more about {title}",id:"theme.blog.post.readMoreLabel",description:"The ARIA label for the link to full blog posts from excerpts"},{title:t}),...n,children:(0,r.jsx)(O,{})})}function k(){let{metadata:e,isBlogPostPage:t}=(0,o.nO)(),{tags:n,title:a,editUrl:s,hasTruncateMarker:i,lastUpdatedBy:c,lastUpdatedAt:u}=e,d=!t&&i,m=n.length>0;if(!(m||d||s))return null;if(!t)return(0,r.jsxs)("footer",{className:"row docusaurus-mt-lg",children:[m&&(0,r.jsx)("div",{className:(0,l.Z)("col",{"col--9":d}),children:(0,r.jsx)(w.Z,{tags:n})}),d&&(0,r.jsx)("div",{className:(0,l.Z)("col text--right",{"col--3":m}),children:(0,r.jsx)(L,{blogPostTitle:a,to:e.permalink})})]});{let e=!!(s||u||c);return(0,r.jsxs)("footer",{className:"docusaurus-mt-lg",children:[m&&(0,r.jsx)("div",{className:(0,l.Z)("row","margin-top--sm",y.k.blog.blogFooterEditMetaRow),children:(0,r.jsx)("div",{className:"col",children:(0,r.jsx)(w.Z,{tags:n})})}),e&&(0,r.jsx)(_.Z,{className:(0,l.Z)("margin-top--sm",y.k.blog.blogFooterEditMetaRow),editUrl:s,lastUpdatedAt:u,lastUpdatedBy:c})]})}}function C(e){let{children:t,className:n}=e,s=function(){let{isBlogPostPage:e}=(0,o.nO)();return e?void 0:"margin-bottom--xl"}();return(0,r.jsxs)(a,{className:(0,l.Z)(s,n),children:[(0,r.jsx)(v,{}),(0,r.jsx)(N,{children:t}),(0,r.jsx)(k,{})]})}},5132:function(e,t,n){n.r(t),n.d(t,{default:()=>v});var r=n("5367");n("3800");var l=n("620"),o=n("6387"),a=n("2175"),s=n("4867"),i=n("7038"),c=n("7223"),u=n("4510"),d=n("4941");function m(e){let{nextItem:t,prevItem:n}=e;return(0,r.jsxs)("nav",{className:"pagination-nav docusaurus-mt-lg","aria-label":(0,u.I)({id:"theme.blog.post.paginator.navAriaLabel",message:"Blog post page navigation",description:"The ARIA label for the blog posts pagination"}),children:[n&&(0,r.jsx)(d.Z,{...n,subLabel:(0,r.jsx)(u.Z,{id:"theme.blog.post.paginator.newerPost",description:"The blog post button label to navigate to the newer/previous post",children:"Newer post"})}),t&&(0,r.jsx)(d.Z,{...t,subLabel:(0,r.jsx)(u.Z,{id:"theme.blog.post.paginator.olderPost",description:"The blog post button label to navigate to the older/next post",children:"Older post"}),isNext:!0})]})}function h(){let{assets:e,metadata:t}=(0,s.nO)(),{title:n,description:l,date:a,tags:i,authors:c,frontMatter:u}=t,{keywords:d}=u,m=e.image??u.image;return(0,r.jsxs)(o.d,{title:u.title_meta??n,description:l,keywords:d,image:m,children:[(0,r.jsx)("meta",{property:"og:type",content:"article"}),(0,r.jsx)("meta",{property:"article:published_time",content:a}),c.some(e=>e.url)&&(0,r.jsx)("meta",{property:"article:author",content:c.map(e=>e.url).filter(Boolean).join(",")}),i.length>0&&(0,r.jsx)("meta",{property:"article:tag",content:i.map(e=>e.label).join(",")})]})}var g=n("7903");function x(){let e=(0,s.iZ)();return(0,r.jsx)(g.Z,{children:(0,r.jsx)("script",{type:"application/ld+json",children:JSON.stringify(e)})})}var f=n("9975"),p=n("3003");function j(e){let{sidebar:t,children:n}=e,{metadata:l,toc:o}=(0,s.nO)(),{nextItem:a,prevItem:u,frontMatter:d}=l,{hide_table_of_contents:h,toc_min_heading_level:g,toc_max_heading_level:x}=d;return(0,r.jsxs)(i.Z,{sidebar:t,toc:!h&&o.length>0?(0,r.jsx)(f.Z,{toc:o,minHeadingLevel:g,maxHeadingLevel:x}):void 0,children:[(0,r.jsx)(p.Z,{metadata:l}),(0,r.jsx)(c.Z,{children:n}),(a||u)&&(0,r.jsx)(m,{nextItem:a,prevItem:u})]})}function v(e){let t=e.content;return(0,r.jsx)(s.n4,{content:e.content,isBlogPostPage:!0,children:(0,r.jsxs)(o.FG,{className:(0,l.Z)(a.k.wrapper.blogPages,a.k.page.blogPostPage),children:[(0,r.jsx)(h,{}),(0,r.jsx)(x,{}),(0,r.jsx)(j,{sidebar:e.sidebar,children:(0,r.jsx)(t,{})})]})})}},3003:function(e,t,n){n.d(t,{Z:()=>d});var r=n("5367");n("3800");var l=n("620"),o=n("1873"),a=n("2175"),s=n("8374");function i(e){let{className:t}=e;return(0,r.jsx)(s.Z,{type:"caution",title:(0,r.jsx)(o.ht,{}),className:(0,l.Z)(t,a.k.common.draftBanner),children:(0,r.jsx)(o.xo,{})})}function c(e){let{className:t}=e;return(0,r.jsx)(s.Z,{type:"caution",title:(0,r.jsx)(o.cI,{}),className:(0,l.Z)(t,a.k.common.unlistedBanner),children:(0,r.jsx)(o.eU,{})})}function u(e){return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(o.T$,{}),(0,r.jsx)(c,{...e})]})}function d(e){let{metadata:t}=e,{unlisted:n,frontMatter:l}=t;return(0,r.jsxs)(r.Fragment,{children:[(n||l.unlisted)&&(0,r.jsx)(u,{}),l.draft&&(0,r.jsx)(i,{})]})}},9975:function(e,t,n){n.d(t,{Z:()=>a});var r=n("5367");n("3800");var l=n("620"),o=n("7165");function a(e){let{className:t,...n}=e;return(0,r.jsx)("div",{className:(0,l.Z)("tableOfContents_sfxx","thin-scrollbar",t),children:(0,r.jsx)(o.Z,{...n,linkClassName:"table-of-contents__link toc-highlight",linkActiveClassName:"table-of-contents__link--active"})})}},7165:function(e,t,n){n.d(t,{Z:()=>c});var r=n("5367"),l=n("3800"),o=n("3680");function a(e){let t=e.getBoundingClientRect();return t.top===t.bottom?a(e.parentNode):t}var s=n("4248");let i=l.memo(function e(t){let{toc:n,className:l,linkClassName:o,isChild:a}=t;return n.length?(0,r.jsx)("ul",{className:a?void 0:l,children:n.map(t=>(0,r.jsxs)("li",{children:[(0,r.jsx)(s.Z,{to:`#${t.id}`,className:o??void 0,dangerouslySetInnerHTML:{__html:t.value}}),(0,r.jsx)(e,{isChild:!0,toc:t.children,className:l,linkClassName:o})]},t.id))}):null});function c(e){let{toc:t,className:n="table-of-contents table-of-contents__left-border",linkClassName:s="table-of-contents__link",linkActiveClassName:c,minHeadingLevel:u,maxHeadingLevel:d,...m}=e,h=(0,o.L)(),g=u??h.tableOfContents.minHeadingLevel,x=d??h.tableOfContents.maxHeadingLevel,f=function(e){let{toc:t,minHeadingLevel:n,maxHeadingLevel:r}=e;return(0,l.useMemo)(()=>(function e(t){let{toc:n,minHeadingLevel:r,maxHeadingLevel:l}=t;return n.flatMap(t=>{let n=e({toc:t.children,minHeadingLevel:r,maxHeadingLevel:l});return t.level>=r&&t.level<=l?[{...t,children:n}]:n})})({toc:function(e){let t=e.map(e=>({...e,parentIndex:-1,children:[]})),n=Array(7).fill(-1);t.forEach((e,t)=>{let r=n.slice(2,e.level);e.parentIndex=Math.max(...r),n[e.level]=t});let r=[];return t.forEach(e=>{let{parentIndex:n,...l}=e;n>=0?t[n].children.push(l):r.push(l)}),r}(t),minHeadingLevel:n,maxHeadingLevel:r}),[t,n,r])}({toc:t,minHeadingLevel:g,maxHeadingLevel:x});return!function(e){let t=(0,l.useRef)(void 0),n=function(){let e=(0,l.useRef)(0),{navbar:{hideOnScroll:t}}=(0,o.L)();return(0,l.useEffect)(()=>{e.current=t?0:document.querySelector(".navbar").clientHeight},[t]),e}();(0,l.useEffect)(()=>{if(!e)return()=>{};let{linkClassName:r,linkActiveClassName:l,minHeadingLevel:o,maxHeadingLevel:s}=e;function i(){let e=Array.from(document.getElementsByClassName(r)),i=function(e,t){let{anchorTopOffset:n}=t,r=e.find(e=>a(e).top>=n);if(r){var l;return(l=a(r)).top>0&&l.bottom<window.innerHeight/2?r:e[e.indexOf(r)-1]??null}return e[e.length-1]??null}(function(e){let{minHeadingLevel:t,maxHeadingLevel:n}=e,r=[];for(let e=t;e<=n;e+=1)r.push(`h${e}.anchor`);return Array.from(document.querySelectorAll(r.join()))}({minHeadingLevel:o,maxHeadingLevel:s}),{anchorTopOffset:n.current}),c=e.find(e=>i&&i.id===decodeURIComponent(e.href.substring(e.href.indexOf("#")+1)));e.forEach(e=>{e===c?(t.current&&t.current!==e&&t.current.classList.remove(l),e.classList.add(l),t.current=e):e.classList.remove(l)})}return document.addEventListener("scroll",i),document.addEventListener("resize",i),i(),()=>{document.removeEventListener("scroll",i),document.removeEventListener("resize",i)}},[e,n])}((0,l.useMemo)(()=>{if(s&&c)return{linkClassName:s,linkActiveClassName:c,minHeadingLevel:g,maxHeadingLevel:x}},[s,c,g,x])),(0,r.jsx)(i,{toc:f,className:n,linkClassName:s,...m})}}}]);