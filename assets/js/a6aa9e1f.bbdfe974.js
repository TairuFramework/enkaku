"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["8514"],{484:function(e,t,r){r.r(t),r.d(t,{default:()=>j});var n=r("651");r("2379");var l=r("620"),a=r("4823"),i=r("2324"),s=r("3160"),o=r("8989"),c=r("332"),d=r("4231"),u=r("2859"),m=r("9522"),g=r("2409");function h(e){let t=(0,g.CS)(e);return(0,n.jsx)(m.Z,{children:(0,n.jsx)("script",{type:"application/ld+json",children:JSON.stringify(t)})})}function x(e){let{metadata:t}=e,{siteConfig:{title:r}}=(0,a.Z)(),{blogDescription:l,blogTitle:s,permalink:o}=t;return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(i.d,{title:"/"===o?r:s,description:l}),(0,n.jsx)(d.Z,{tag:"blog_posts_list"})]})}function p(e){let{metadata:t,items:r,sidebar:l}=e;return(0,n.jsxs)(o.Z,{sidebar:l,children:[(0,n.jsx)(u.Z,{items:r}),(0,n.jsx)(c.Z,{metadata:t})]})}function j(e){return(0,n.jsxs)(i.FG,{className:(0,l.Z)(s.k.wrapper.blogPages,s.k.page.blogListPage),children:[(0,n.jsx)(x,{...e}),(0,n.jsx)(h,{...e}),(0,n.jsx)(p,{...e})]})}},332:function(e,t,r){r.d(t,{Z:function(){return i}});var n=r(651);r(2379);var l=r(9894),a=r(889);function i(e){let{metadata:t}=e,{previousPage:r,nextPage:i}=t;return(0,n.jsxs)("nav",{className:"pagination-nav","aria-label":(0,l.I)({id:"theme.blog.paginator.navAriaLabel",message:"Blog list page navigation",description:"The ARIA label for the blog pagination"}),children:[r&&(0,n.jsx)(a.Z,{permalink:r,title:(0,n.jsx)(l.Z,{id:"theme.blog.paginator.newerEntries",description:"The label used to navigate to the newer blog posts page (previous page)",children:"Newer entries"})}),i&&(0,n.jsx)(a.Z,{permalink:i,title:(0,n.jsx)(l.Z,{id:"theme.blog.paginator.olderEntries",description:"The label used to navigate to the older blog posts page (next page)",children:"Older entries"}),isNext:!0})]})}},5462:function(e,t,r){r.d(t,{Z:()=>U});var n=r("651");r("2379");var l=r("620"),a=r("2409");function i(e){let{children:t,className:r}=e;return(0,n.jsx)("article",{className:r,children:t})}var s=r("6329");let o="title_DyBS";function c(e){let{className:t}=e,{metadata:r,isBlogPostPage:i}=(0,a.nO)(),{permalink:c,title:d}=r;return(0,n.jsx)(i?"h1":"h2",{className:(0,l.Z)(o,t),children:i?d:(0,n.jsx)(s.Z,{to:c,children:d})})}var d=r("9894"),u=r("9901"),m=r("1344");let g="container_RJTi";function h(e){let{readingTime:t}=e,r=function(){let{selectMessage:e}=(0,u.c)();return t=>{let r=Math.ceil(t);return e(r,(0,d.I)({id:"theme.blog.post.readingTime.plurals",description:'Pluralized label for "{readingTime} min read". Use as much plural forms (separated by "|") as your language support (see https://www.unicode.org/cldr/cldr-aux/charts/34/supplemental/language_plural_rules.html)',message:"One min read|{readingTime} min read"},{readingTime:r}))}}();return(0,n.jsx)(n.Fragment,{children:r(t)})}function x(e){let{date:t,formattedDate:r}=e;return(0,n.jsx)("time",{dateTime:t,children:r})}function p(){return(0,n.jsx)(n.Fragment,{children:" \xb7 "})}function j(e){let t,{className:r}=e,{metadata:i}=(0,a.nO)(),{date:s,readingTime:o}=i,c=(0,m.P)({day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});return(0,n.jsxs)("div",{className:(0,l.Z)(g,"margin-vert--md",r),children:[(0,n.jsx)(x,{date:s,formattedDate:(t=s,c.format(new Date(t)))}),void 0!==o&&(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(p,{}),(0,n.jsx)(h,{readingTime:o})]})]})}var f=r("4198");let b={authorCol:"authorCol_vtwt",imageOnlyAuthorRow:"imageOnlyAuthorRow_ALdT",imageOnlyAuthorCol:"imageOnlyAuthorCol_hUpQ"};function v(e){let{className:t}=e,{metadata:{authors:r},assets:i}=(0,a.nO)();if(0===r.length)return null;let s=r.every(e=>{let{name:t}=e;return!t}),o=1===r.length;return(0,n.jsx)("div",{className:(0,l.Z)("margin-top--md margin-bottom--sm",s?b.imageOnlyAuthorRow:"row",t),children:r.map((e,t)=>(0,n.jsx)("div",{className:(0,l.Z)(!s&&(o?"col col--12":"col col--6"),s?b.imageOnlyAuthorCol:b.authorCol),children:(0,n.jsx)(f.Z,{author:{...e,imageURL:i.authorsImageUrls[t]??e.imageURL}})},t))})}function Z(){return(0,n.jsxs)("header",{children:[(0,n.jsx)(c,{}),(0,n.jsx)(j,{}),(0,n.jsx)(v,{})]})}var w=r("1121"),N=r("9119");function k(e){let{children:t,className:r}=e,{isBlogPostPage:i}=(0,a.nO)();return(0,n.jsx)("div",{id:i?w.blogPostContainerID:void 0,className:(0,l.Z)("markdown",r),children:(0,n.jsx)(N.Z,{children:t})})}var y=r("3160"),O=r("6043"),T=r("700");function A(){return(0,n.jsx)("b",{children:(0,n.jsx)(d.Z,{id:"theme.blog.post.readMore",description:"The label used in blog post item excerpts to link to full blog posts",children:"Read more"})})}function C(e){let{blogPostTitle:t,...r}=e;return(0,n.jsx)(s.Z,{"aria-label":(0,d.I)({message:"Read more about {title}",id:"theme.blog.post.readMoreLabel",description:"The ARIA label for the link to full blog posts from excerpts"},{title:t}),...r,children:(0,n.jsx)(A,{})})}function R(){let{metadata:e,isBlogPostPage:t}=(0,a.nO)(),{tags:r,title:i,editUrl:s,hasTruncateMarker:o,lastUpdatedBy:c,lastUpdatedAt:d}=e,u=!t&&o,m=r.length>0;if(!(m||u||s))return null;if(!t)return(0,n.jsxs)("footer",{className:"row docusaurus-mt-lg",children:[m&&(0,n.jsx)("div",{className:(0,l.Z)("col",{"col--9":u}),children:(0,n.jsx)(T.Z,{tags:r})}),u&&(0,n.jsx)("div",{className:(0,l.Z)("col text--right",{"col--3":m}),children:(0,n.jsx)(C,{blogPostTitle:i,to:e.permalink})})]});{let e=!!(s||d||c);return(0,n.jsxs)("footer",{className:"docusaurus-mt-lg",children:[m&&(0,n.jsx)("div",{className:(0,l.Z)("row","margin-top--sm",y.k.blog.blogFooterEditMetaRow),children:(0,n.jsx)("div",{className:"col",children:(0,n.jsx)(T.Z,{tags:r})})}),e&&(0,n.jsx)(O.Z,{className:(0,l.Z)("margin-top--sm",y.k.blog.blogFooterEditMetaRow),editUrl:s,lastUpdatedAt:d,lastUpdatedBy:c})]})}}function U(e){let{children:t,className:r}=e,s=function(){let{isBlogPostPage:e}=(0,a.nO)();return e?void 0:"margin-bottom--xl"}();return(0,n.jsxs)(i,{className:(0,l.Z)(s,r),children:[(0,n.jsx)(Z,{}),(0,n.jsx)(k,{children:t}),(0,n.jsx)(R,{})]})}},2859:function(e,t,r){r.d(t,{Z:function(){return i}});var n=r(651);r(2379);var l=r(2409),a=r(5462);function i(e){let{items:t,component:r=a.Z}=e;return(0,n.jsx)(n.Fragment,{children:t.map(e=>{let{content:t}=e;return(0,n.jsx)(l.n4,{content:t,children:(0,n.jsx)(r,{children:(0,n.jsx)(t,{})})},t.metadata.permalink)})})}}}]);