"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["9914"],{287:function(e,t,n){n.r(t),n.d(t,{default:()=>en});var a=n("5367"),i=n("3800"),o=n("620"),r=n("6504"),l=n("4708"),s=n("2502"),d=n("5905"),c=n("9049"),u=n("3520"),b=n("8594");let m={backToTopButton:"backToTopButton_bI2l",backToTopButtonShow:"backToTopButtonShow_BsCK"};function h(){let{shown:e,scrollToTop:t}=function(e){let{threshold:t}=e,[n,a]=(0,i.useState)(!1),o=(0,i.useRef)(!1),{startScroll:r,cancelScroll:l}=(0,u.Ct)();return(0,u.RF)((e,n)=>{let{scrollY:i}=e,r=n?.scrollY;r&&(o.current?o.current=!1:i>=r?(l(),a(!1)):i<t?a(!1):i+window.innerHeight<document.documentElement.scrollHeight&&a(!0))}),(0,b.S)(e=>{e.location.hash&&(o.current=!0,a(!1))}),{shown:n,scrollToTop:()=>r(0)}}({threshold:300});return(0,a.jsx)("button",{"aria-label":(0,c.I)({id:"theme.BackToTopButton.buttonAriaLabel",message:"Scroll back to top",description:"The ARIA label for the back to top button"}),className:(0,o.Z)("clean-btn",l.k.common.backToTopButton,m.backToTopButton,e&&m.backToTopButtonShow),type:"button",onClick:t})}var p=n("5056"),x=n("5569"),f=n("1549"),j=n("5078"),_=n("7934");function g(e){return(0,a.jsx)("svg",{width:"20",height:"20","aria-hidden":"true",...e,children:(0,a.jsxs)("g",{fill:"#7a7a7a",children:[(0,a.jsx)("path",{d:"M9.992 10.023c0 .2-.062.399-.172.547l-4.996 7.492a.982.982 0 01-.828.454H1c-.55 0-1-.453-1-1 0-.2.059-.403.168-.551l4.629-6.942L.168 3.078A.939.939 0 010 2.528c0-.548.45-.997 1-.997h2.996c.352 0 .649.18.828.45L9.82 9.472c.11.148.172.347.172.55zm0 0"}),(0,a.jsx)("path",{d:"M19.98 10.023c0 .2-.058.399-.168.547l-4.996 7.492a.987.987 0 01-.828.454h-3c-.547 0-.996-.453-.996-1 0-.2.059-.403.168-.551l4.625-6.942-4.625-6.945a.939.939 0 01-.168-.55 1 1 0 01.996-.997h3c.348 0 .649.18.828.45l4.996 7.492c.11.148.168.347.168.55zm0 0"})]})})}function k(e){let{onClick:t}=e;return(0,a.jsx)("button",{type:"button",title:(0,c.I)({id:"theme.docs.sidebar.collapseButtonTitle",message:"Collapse sidebar",description:"The title attribute for collapse button of doc sidebar"}),"aria-label":(0,c.I)({id:"theme.docs.sidebar.collapseButtonAriaLabel",message:"Collapse sidebar",description:"The title attribute for collapse button of doc sidebar"}),className:(0,o.Z)("button button--secondary button--outline","collapseSidebarButton_pktG"),onClick:t,children:(0,a.jsx)(g,{className:"collapseSidebarButtonIcon_deys"})})}var v=n("8094"),C=n("1417"),N=n("9776"),I=n("2830"),S=n("1195"),T=n("6088"),Z=n("9396");function L(e){let{collapsed:t,categoryLabel:n,onClick:i}=e;return(0,a.jsx)("button",{"aria-label":t?(0,c.I)({id:"theme.DocSidebarItem.expandCategoryAriaLabel",message:"Expand sidebar category '{label}'",description:"The ARIA label to expand the sidebar category"},{label:n}):(0,c.I)({id:"theme.DocSidebarItem.collapseCategoryAriaLabel",message:"Collapse sidebar category '{label}'",description:"The ARIA label to collapse the sidebar category"},{label:n}),"aria-expanded":!t,type:"button",className:"clean-btn menu__caret",onClick:i})}function y(e){let{item:t,onItemClick:n,activePath:r,level:d,index:c,...u}=e,{items:b,label:m,collapsible:h,className:p,href:x}=t,{docs:{sidebar:{autoCollapseCategories:f}}}=(0,j.L)(),_=function(e){let t=(0,Z.default)();return(0,i.useMemo)(()=>e.href&&!e.linkUnlisted?e.href:!t&&e.collapsible?(0,s.LM)(e):void 0,[e,t])}(t),g=(0,s._F)(t,r),k=(0,S.Mg)(x,r),{collapsed:v,setCollapsed:y}=(0,I.u)({initialState:()=>!!h&&!g&&t.collapsed}),{expandedItem:w,setExpandedItem:A}=(0,C.f)(),B=function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:!v;A(e?null:c),y(e)};return!function(e){let{isActive:t,collapsed:n,updateCollapsed:a}=e,o=(0,N.D9)(t);(0,i.useEffect)(()=>{t&&!o&&n&&a(!1)},[t,o,n,a])}({isActive:g,collapsed:v,updateCollapsed:B}),(0,i.useEffect)(()=>{h&&null!=w&&w!==c&&f&&y(!0)},[h,w,c,y,f]),(0,a.jsxs)("li",{className:(0,o.Z)(l.k.docs.docSidebarItemCategory,l.k.docs.docSidebarItemCategoryLevel(d),"menu__list-item",{"menu__list-item--collapsed":v},p),children:[(0,a.jsxs)("div",{className:(0,o.Z)("menu__list-item-collapsible",{"menu__list-item-collapsible--active":k}),children:[(0,a.jsx)(T.Z,{className:(0,o.Z)("menu__link",{"menu__link--sublist":h,"menu__link--sublist-caret":!x&&h,"menu__link--active":g}),onClick:h?e=>{n?.(t),x?B(!1):(e.preventDefault(),B())}:()=>{n?.(t)},"aria-current":k?"page":void 0,role:h&&!x?"button":void 0,"aria-expanded":h&&!x?!v:void 0,href:h?_??"#":_,...u,children:m}),x&&h&&(0,a.jsx)(L,{collapsed:v,categoryLabel:m,onClick:e=>{e.preventDefault(),B()}})]}),(0,a.jsx)(I.z,{lazy:!0,as:"ul",className:"menu__list",collapsed:v,children:(0,a.jsx)(F,{items:b,tabIndex:v?-1:0,onItemClick:n,activePath:r,level:d+1})})]})}var w=n("5900"),A=n("6934");let B={menuExternalLink:"menuExternalLink_SN5o"};function H(e){let{item:t,onItemClick:n,activePath:i,level:r,index:d,...c}=e,{href:u,label:b,className:m,autoAddBaseUrl:h}=t,p=(0,s._F)(t,i),x=(0,w.Z)(u);return(0,a.jsx)("li",{className:(0,o.Z)(l.k.docs.docSidebarItemLink,l.k.docs.docSidebarItemLinkLevel(r),"menu__list-item",m),children:(0,a.jsxs)(T.Z,{className:(0,o.Z)("menu__link",!x&&B.menuExternalLink,{"menu__link--active":p}),autoAddBaseUrl:h,"aria-current":p?"page":void 0,to:u,...x&&{onClick:n?()=>n(t):void 0},...c,children:[b,!x&&(0,a.jsx)(A.Z,{})]})},b)}let E={menuHtmlItem:"menuHtmlItem_qq6F"};function M(e){let{item:t,level:n,index:i}=e,{value:r,defaultStyle:s,className:d}=t;return(0,a.jsx)("li",{className:(0,o.Z)(l.k.docs.docSidebarItemLink,l.k.docs.docSidebarItemLinkLevel(n),s&&[E.menuHtmlItem,"menu__list-item"],d),dangerouslySetInnerHTML:{__html:r}},i)}function W(e){let{item:t,...n}=e;switch(t.type){case"category":return(0,a.jsx)(y,{item:t,...n});case"html":return(0,a.jsx)(M,{item:t,...n});default:return(0,a.jsx)(H,{item:t,...n})}}let F=(0,i.memo)(function(e){let{items:t,...n}=e,i=(0,s.f)(t,n.activePath);return(0,a.jsx)(C.D,{children:i.map((e,t)=>(0,a.jsx)(W,{item:e,index:t,...n},t))})}),R={menu:"menu_xbNC",menuWithAnnouncementBar:"menuWithAnnouncementBar_w6H2"};function D(e){let{path:t,sidebar:n,className:r}=e,s=function(){let{isActive:e}=(0,v.n)(),[t,n]=(0,i.useState)(e);return(0,u.RF)(t=>{let{scrollY:a}=t;e&&n(0===a)},[e]),e&&t}();return(0,a.jsx)("nav",{"aria-label":(0,c.I)({id:"theme.docs.sidebar.navAriaLabel",message:"Docs sidebar",description:"The ARIA label for the sidebar navigation"}),className:(0,o.Z)("menu thin-scrollbar",R.menu,s&&R.menuWithAnnouncementBar,r),children:(0,a.jsx)("ul",{className:(0,o.Z)(l.k.docs.docSidebarMenu,"menu__list"),children:(0,a.jsx)(F,{items:n,activePath:t,level:1})})})}let V={sidebar:"sidebar_UJU3",sidebarWithHideableNavbar:"sidebarWithHideableNavbar_g3Lw",sidebarHidden:"sidebarHidden_m0oC",sidebarLogo:"sidebarLogo_UBY2"},P=i.memo(function(e){let{path:t,sidebar:n,onCollapse:i,isHidden:r}=e,{navbar:{hideOnScroll:l},docs:{sidebar:{hideable:s}}}=(0,j.L)();return(0,a.jsxs)("div",{className:(0,o.Z)(V.sidebar,l&&V.sidebarWithHideableNavbar,r&&V.sidebarHidden),children:[l&&(0,a.jsx)(_.Z,{tabIndex:-1,className:V.sidebarLogo}),(0,a.jsx)(D,{path:t,sidebar:n}),s&&(0,a.jsx)(k,{onClick:i})]})});var U=n("5808"),z=n("6081");let G=e=>{let{sidebar:t,path:n}=e,i=(0,z.e)();return(0,a.jsx)("ul",{className:(0,o.Z)(l.k.docs.docSidebarMenu,"menu__list"),children:(0,a.jsx)(F,{items:t,activePath:n,onItemClick:e=>{"category"===e.type&&e.href&&i.toggle(),"link"===e.type&&i.toggle()},level:1})})},Y=i.memo(function(e){return(0,a.jsx)(U.Zo,{component:G,props:e})});function q(e){let t=(0,f.i)();return(0,a.jsxs)(a.Fragment,{children:[("desktop"===t||"ssr"===t)&&(0,a.jsx)(P,{...e}),"mobile"===t&&(0,a.jsx)(Y,{...e})]})}function K(e){let{toggleSidebar:t}=e;return(0,a.jsx)("div",{className:"expandButton_QZnp",title:(0,c.I)({id:"theme.docs.sidebar.expandButtonTitle",message:"Expand sidebar",description:"The ARIA label and title attribute for expand button of doc sidebar"}),"aria-label":(0,c.I)({id:"theme.docs.sidebar.expandButtonAriaLabel",message:"Expand sidebar",description:"The ARIA label and title attribute for expand button of doc sidebar"}),tabIndex:0,role:"button",onKeyDown:t,onClick:t,children:(0,a.jsx)(g,{className:"expandButtonIcon_a90w"})})}let Q={docSidebarContainer:"docSidebarContainer_sLI0",docSidebarContainerHidden:"docSidebarContainerHidden__E2Z",sidebarViewport:"sidebarViewport_HeVp"};function J(e){let{children:t}=e,n=(0,d.V)();return(0,a.jsx)(i.Fragment,{children:t},n?.name??"noSidebar")}function O(e){let{sidebar:t,hiddenSidebarContainer:n,setHiddenSidebarContainer:r}=e,{pathname:s}=(0,x.TH)(),[d,c]=(0,i.useState)(!1),u=(0,i.useCallback)(()=>{d&&c(!1),!d&&(0,p.n)()&&c(!0),r(e=>!e)},[r,d]);return(0,a.jsx)("aside",{className:(0,o.Z)(l.k.docs.docSidebarContainer,Q.docSidebarContainer,n&&Q.docSidebarContainerHidden),onTransitionEnd:e=>{e.currentTarget.classList.contains(Q.docSidebarContainer)&&n&&c(!0)},children:(0,a.jsx)(J,{children:(0,a.jsxs)("div",{className:(0,o.Z)(Q.sidebarViewport,d&&Q.sidebarViewportHidden),children:[(0,a.jsx)(q,{sidebar:t,path:s,onCollapse:u,isHidden:d}),d&&(0,a.jsx)(K,{toggleSidebar:u})]})})})}let X={docMainContainer:"docMainContainer_NMG_",docMainContainerEnhanced:"docMainContainerEnhanced_WVPN",docItemWrapperEnhanced:"docItemWrapperEnhanced_boNb"};function $(e){let{hiddenSidebarContainer:t,children:n}=e,i=(0,d.V)();return(0,a.jsx)("main",{className:(0,o.Z)(X.docMainContainer,(t||!i)&&X.docMainContainerEnhanced),children:(0,a.jsx)("div",{className:(0,o.Z)("container padding-top--md padding-bottom--lg",X.docItemWrapper,t&&X.docItemWrapperEnhanced),children:n})})}function ee(e){let{children:t}=e,n=(0,d.V)(),[o,r]=(0,i.useState)(!1);return(0,a.jsxs)("div",{className:"docsWrapper_Qu4j",children:[(0,a.jsx)(h,{}),(0,a.jsxs)("div",{className:"docRoot_gLyC",children:[n&&(0,a.jsx)(O,{sidebar:n.items,hiddenSidebarContainer:o,setHiddenSidebarContainer:r}),(0,a.jsx)($,{hiddenSidebarContainer:o,children:t})]})]})}var et=n("7967");function en(e){let t=(0,s.SN)(e);if(!t)return(0,a.jsx)(et.Z,{});let{docElement:n,sidebarName:i,sidebarItems:c}=t;return(0,a.jsx)(r.FG,{className:(0,o.Z)(l.k.page.docsDocPage),children:(0,a.jsx)(d.b,{name:i,items:c,children:(0,a.jsx)(ee,{children:n})})})}},7967:function(e,t,n){n.d(t,{Z:function(){return l}});var a=n(5367);n(3800);var i=n(620),o=n(9049),r=n(5161);function l(e){let{className:t}=e;return(0,a.jsx)("main",{className:(0,i.Z)("container margin-vert--xl",t),children:(0,a.jsx)("div",{className:"row",children:(0,a.jsxs)("div",{className:"col col--6 col--offset-3",children:[(0,a.jsx)(r.Z,{as:"h1",className:"hero__title",children:(0,a.jsx)(o.Z,{id:"theme.NotFound.title",description:"The title of the 404 page",children:"Page Not Found"})}),(0,a.jsx)("p",{children:(0,a.jsx)(o.Z,{id:"theme.NotFound.p1",description:"The first paragraph of the 404 page",children:"We could not find what you were looking for."})}),(0,a.jsx)("p",{children:(0,a.jsx)(o.Z,{id:"theme.NotFound.p2",description:"The 2nd paragraph of the 404 page",children:"Please contact the owner of the site that linked you to the original URL and let them know their link is broken."})})]})})})}}}]);