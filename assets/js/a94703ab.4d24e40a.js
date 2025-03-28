"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["9914"],{9184:function(e,t,n){n.r(t),n.d(t,{default:()=>en});var a=n("5367"),i=n("3800"),o=n("620"),r=n("6387"),l=n("2175"),s=n("4288"),d=n("9148"),c=n("4510"),u=n("8928"),m=n("9706");let b={backToTopButton:"backToTopButton_oHCd",backToTopButtonShow:"backToTopButtonShow_xZ8q"};function h(){let{shown:e,scrollToTop:t}=function(e){let{threshold:t}=e,[n,a]=(0,i.useState)(!1),o=(0,i.useRef)(!1),{startScroll:r,cancelScroll:l}=(0,u.Ct)();return(0,u.RF)((e,n)=>{let{scrollY:i}=e,r=n?.scrollY;r&&(o.current?o.current=!1:i>=r?(l(),a(!1)):i<t?a(!1):i+window.innerHeight<document.documentElement.scrollHeight&&a(!0))}),(0,m.S)(e=>{e.location.hash&&(o.current=!0,a(!1))}),{shown:n,scrollToTop:()=>r(0)}}({threshold:300});return(0,a.jsx)("button",{"aria-label":(0,c.I)({id:"theme.BackToTopButton.buttonAriaLabel",message:"Scroll back to top",description:"The ARIA label for the back to top button"}),className:(0,o.Z)("clean-btn",l.k.common.backToTopButton,b.backToTopButton,e&&b.backToTopButtonShow),type:"button",onClick:t})}var p=n("198"),x=n("5569"),f=n("4992"),j=n("3680"),k=n("135");function _(e){return(0,a.jsx)("svg",{width:"20",height:"20","aria-hidden":"true",...e,children:(0,a.jsxs)("g",{fill:"#7a7a7a",children:[(0,a.jsx)("path",{d:"M9.992 10.023c0 .2-.062.399-.172.547l-4.996 7.492a.982.982 0 01-.828.454H1c-.55 0-1-.453-1-1 0-.2.059-.403.168-.551l4.629-6.942L.168 3.078A.939.939 0 010 2.528c0-.548.45-.997 1-.997h2.996c.352 0 .649.18.828.45L9.82 9.472c.11.148.172.347.172.55zm0 0"}),(0,a.jsx)("path",{d:"M19.98 10.023c0 .2-.058.399-.168.547l-4.996 7.492a.987.987 0 01-.828.454h-3c-.547 0-.996-.453-.996-1 0-.2.059-.403.168-.551l4.625-6.942-4.625-6.945a.939.939 0 01-.168-.55 1 1 0 01.996-.997h3c.348 0 .649.18.828.45l4.996 7.492c.11.148.168.347.168.55zm0 0"})]})})}function g(e){let{onClick:t}=e;return(0,a.jsx)("button",{type:"button",title:(0,c.I)({id:"theme.docs.sidebar.collapseButtonTitle",message:"Collapse sidebar",description:"The title attribute for collapse button of doc sidebar"}),"aria-label":(0,c.I)({id:"theme.docs.sidebar.collapseButtonAriaLabel",message:"Collapse sidebar",description:"The title attribute for collapse button of doc sidebar"}),className:(0,o.Z)("button button--secondary button--outline","collapseSidebarButton_El7U"),onClick:t,children:(0,a.jsx)(_,{className:"collapseSidebarButtonIcon_WZJP"})})}var v=n("9943"),C=n("9491"),S=n("1487"),N=n("7976"),I=n("2730"),T=n("4248"),Z=n("1896");function L(e){let{collapsed:t,categoryLabel:n,onClick:i}=e;return(0,a.jsx)("button",{"aria-label":t?(0,c.I)({id:"theme.DocSidebarItem.expandCategoryAriaLabel",message:"Expand sidebar category '{label}'",description:"The ARIA label to expand the sidebar category"},{label:n}):(0,c.I)({id:"theme.DocSidebarItem.collapseCategoryAriaLabel",message:"Collapse sidebar category '{label}'",description:"The ARIA label to collapse the sidebar category"},{label:n}),"aria-expanded":!t,type:"button",className:"clean-btn menu__caret",onClick:i})}function y(e){let{item:t,onItemClick:n,activePath:r,level:d,index:c,...u}=e,{items:m,label:b,collapsible:h,className:p,href:x}=t,{docs:{sidebar:{autoCollapseCategories:f}}}=(0,j.L)(),k=function(e){let t=(0,Z.default)();return(0,i.useMemo)(()=>e.href&&!e.linkUnlisted?e.href:!t&&e.collapsible?(0,s.LM)(e):void 0,[e,t])}(t),_=(0,s._F)(t,r),g=(0,I.Mg)(x,r),{collapsed:v,setCollapsed:y}=(0,N.u)({initialState:()=>!!h&&!_&&t.collapsed}),{expandedItem:A,setExpandedItem:H}=(0,C.f)(),B=function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:!v;H(e?null:c),y(e)};return!function(e){let{isActive:t,collapsed:n,updateCollapsed:a}=e,o=(0,S.D9)(t);(0,i.useEffect)(()=>{t&&!o&&n&&a(!1)},[t,o,n,a])}({isActive:_,collapsed:v,updateCollapsed:B}),(0,i.useEffect)(()=>{h&&null!=A&&A!==c&&f&&y(!0)},[h,A,c,y,f]),(0,a.jsxs)("li",{className:(0,o.Z)(l.k.docs.docSidebarItemCategory,l.k.docs.docSidebarItemCategoryLevel(d),"menu__list-item",{"menu__list-item--collapsed":v},p),children:[(0,a.jsxs)("div",{className:(0,o.Z)("menu__list-item-collapsible",{"menu__list-item-collapsible--active":g}),children:[(0,a.jsx)(T.Z,{className:(0,o.Z)("menu__link",{"menu__link--sublist":h,"menu__link--sublist-caret":!x&&h,"menu__link--active":_}),onClick:h?e=>{n?.(t),x?B(!1):(e.preventDefault(),B())}:()=>{n?.(t)},"aria-current":g?"page":void 0,role:h&&!x?"button":void 0,"aria-expanded":h&&!x?!v:void 0,href:h?k??"#":k,...u,children:b}),x&&h&&(0,a.jsx)(L,{collapsed:v,categoryLabel:b,onClick:e=>{e.preventDefault(),B()}})]}),(0,a.jsx)(N.z,{lazy:!0,as:"ul",className:"menu__list",collapsed:v,children:(0,a.jsx)(R,{items:m,tabIndex:v?-1:0,onItemClick:n,activePath:r,level:d+1})})]})}var A=n("2023"),H=n("7765");let B={menuExternalLink:"menuExternalLink_H9YM"};function w(e){let{item:t,onItemClick:n,activePath:i,level:r,index:d,...c}=e,{href:u,label:m,className:b,autoAddBaseUrl:h}=t,p=(0,s._F)(t,i),x=(0,A.Z)(u);return(0,a.jsx)("li",{className:(0,o.Z)(l.k.docs.docSidebarItemLink,l.k.docs.docSidebarItemLinkLevel(r),"menu__list-item",b),children:(0,a.jsxs)(T.Z,{className:(0,o.Z)("menu__link",!x&&B.menuExternalLink,{"menu__link--active":p}),autoAddBaseUrl:h,"aria-current":p?"page":void 0,to:u,...x&&{onClick:n?()=>n(t):void 0},...c,children:[m,!x&&(0,a.jsx)(H.Z,{})]})},m)}let E={menuHtmlItem:"menuHtmlItem_t1NU"};function M(e){let{item:t,level:n,index:i}=e,{value:r,defaultStyle:s,className:d}=t;return(0,a.jsx)("li",{className:(0,o.Z)(l.k.docs.docSidebarItemLink,l.k.docs.docSidebarItemLinkLevel(n),s&&[E.menuHtmlItem,"menu__list-item"],d),dangerouslySetInnerHTML:{__html:r}},i)}function W(e){let{item:t,...n}=e;switch(t.type){case"category":return(0,a.jsx)(y,{item:t,...n});case"html":return(0,a.jsx)(M,{item:t,...n});default:return(0,a.jsx)(w,{item:t,...n})}}let R=(0,i.memo)(function(e){let{items:t,...n}=e,i=(0,s.f)(t,n.activePath);return(0,a.jsx)(C.D,{children:i.map((e,t)=>(0,a.jsx)(W,{item:e,index:t,...n},t))})}),F={menu:"menu_FW4V",menuWithAnnouncementBar:"menuWithAnnouncementBar_mksJ"};function P(e){let{path:t,sidebar:n,className:r}=e,s=function(){let{isActive:e}=(0,v.n)(),[t,n]=(0,i.useState)(e);return(0,u.RF)(t=>{let{scrollY:a}=t;e&&n(0===a)},[e]),e&&t}();return(0,a.jsx)("nav",{"aria-label":(0,c.I)({id:"theme.docs.sidebar.navAriaLabel",message:"Docs sidebar",description:"The ARIA label for the sidebar navigation"}),className:(0,o.Z)("menu thin-scrollbar",F.menu,s&&F.menuWithAnnouncementBar,r),children:(0,a.jsx)("ul",{className:(0,o.Z)(l.k.docs.docSidebarMenu,"menu__list"),children:(0,a.jsx)(R,{items:n,activePath:t,level:1})})})}let D={sidebar:"sidebar_tZHx",sidebarWithHideableNavbar:"sidebarWithHideableNavbar_rYML",sidebarHidden:"sidebarHidden_hK5v",sidebarLogo:"sidebarLogo_gELV"},V=i.memo(function(e){let{path:t,sidebar:n,onCollapse:i,isHidden:r}=e,{navbar:{hideOnScroll:l},docs:{sidebar:{hideable:s}}}=(0,j.L)();return(0,a.jsxs)("div",{className:(0,o.Z)(D.sidebar,l&&D.sidebarWithHideableNavbar,r&&D.sidebarHidden),children:[l&&(0,a.jsx)(k.Z,{tabIndex:-1,className:D.sidebarLogo}),(0,a.jsx)(P,{path:t,sidebar:n}),s&&(0,a.jsx)(g,{onClick:i})]})});var U=n("2908"),z=n("5559");let Y=e=>{let{sidebar:t,path:n}=e,i=(0,z.e)();return(0,a.jsx)("ul",{className:(0,o.Z)(l.k.docs.docSidebarMenu,"menu__list"),children:(0,a.jsx)(R,{items:t,activePath:n,onItemClick:e=>{"category"===e.type&&e.href&&i.toggle(),"link"===e.type&&i.toggle()},level:1})})},K=i.memo(function(e){return(0,a.jsx)(U.Zo,{component:Y,props:e})});function q(e){let t=(0,f.i)();return(0,a.jsxs)(a.Fragment,{children:[("desktop"===t||"ssr"===t)&&(0,a.jsx)(V,{...e}),"mobile"===t&&(0,a.jsx)(K,{...e})]})}function G(e){let{toggleSidebar:t}=e;return(0,a.jsx)("div",{className:"expandButton_Kk1l",title:(0,c.I)({id:"theme.docs.sidebar.expandButtonTitle",message:"Expand sidebar",description:"The ARIA label and title attribute for expand button of doc sidebar"}),"aria-label":(0,c.I)({id:"theme.docs.sidebar.expandButtonAriaLabel",message:"Expand sidebar",description:"The ARIA label and title attribute for expand button of doc sidebar"}),tabIndex:0,role:"button",onKeyDown:t,onClick:t,children:(0,a.jsx)(_,{className:"expandButtonIcon_SjX5"})})}let J={docSidebarContainer:"docSidebarContainer_Qh7b",docSidebarContainerHidden:"docSidebarContainerHidden_sGS3",sidebarViewport:"sidebarViewport_ZghP"};function X(e){let{children:t}=e,n=(0,d.V)();return(0,a.jsx)(i.Fragment,{children:t},n?.name??"noSidebar")}function Q(e){let{sidebar:t,hiddenSidebarContainer:n,setHiddenSidebarContainer:r}=e,{pathname:s}=(0,x.TH)(),[d,c]=(0,i.useState)(!1),u=(0,i.useCallback)(()=>{d&&c(!1),!d&&(0,p.n)()&&c(!0),r(e=>!e)},[r,d]);return(0,a.jsx)("aside",{className:(0,o.Z)(l.k.docs.docSidebarContainer,J.docSidebarContainer,n&&J.docSidebarContainerHidden),onTransitionEnd:e=>{e.currentTarget.classList.contains(J.docSidebarContainer)&&n&&c(!0)},children:(0,a.jsx)(X,{children:(0,a.jsxs)("div",{className:(0,o.Z)(J.sidebarViewport,d&&J.sidebarViewportHidden),children:[(0,a.jsx)(q,{sidebar:t,path:s,onCollapse:u,isHidden:d}),d&&(0,a.jsx)(G,{toggleSidebar:u})]})})})}let O={docMainContainer:"docMainContainer_Rqki",docMainContainerEnhanced:"docMainContainerEnhanced_A0aR",docItemWrapperEnhanced:"docItemWrapperEnhanced_CXB7"};function $(e){let{hiddenSidebarContainer:t,children:n}=e,i=(0,d.V)();return(0,a.jsx)("main",{className:(0,o.Z)(O.docMainContainer,(t||!i)&&O.docMainContainerEnhanced),children:(0,a.jsx)("div",{className:(0,o.Z)("container padding-top--md padding-bottom--lg",O.docItemWrapper,t&&O.docItemWrapperEnhanced),children:n})})}function ee(e){let{children:t}=e,n=(0,d.V)(),[o,r]=(0,i.useState)(!1);return(0,a.jsxs)("div",{className:"docsWrapper_smHy",children:[(0,a.jsx)(h,{}),(0,a.jsxs)("div",{className:"docRoot_PLfL",children:[n&&(0,a.jsx)(Q,{sidebar:n.items,hiddenSidebarContainer:o,setHiddenSidebarContainer:r}),(0,a.jsx)($,{hiddenSidebarContainer:o,children:t})]})]})}var et=n("6757");function en(e){let t=(0,s.SN)(e);if(!t)return(0,a.jsx)(et.Z,{});let{docElement:n,sidebarName:i,sidebarItems:c}=t;return(0,a.jsx)(r.FG,{className:(0,o.Z)(l.k.page.docsDocPage),children:(0,a.jsx)(d.b,{name:i,items:c,children:(0,a.jsx)(ee,{children:n})})})}},6757:function(e,t,n){n.d(t,{Z:function(){return l}});var a=n(5367);n(3800);var i=n(620),o=n(4510),r=n(4922);function l(e){let{className:t}=e;return(0,a.jsx)("main",{className:(0,i.Z)("container margin-vert--xl",t),children:(0,a.jsx)("div",{className:"row",children:(0,a.jsxs)("div",{className:"col col--6 col--offset-3",children:[(0,a.jsx)(r.Z,{as:"h1",className:"hero__title",children:(0,a.jsx)(o.Z,{id:"theme.NotFound.title",description:"The title of the 404 page",children:"Page Not Found"})}),(0,a.jsx)("p",{children:(0,a.jsx)(o.Z,{id:"theme.NotFound.p1",description:"The first paragraph of the 404 page",children:"We could not find what you were looking for."})}),(0,a.jsx)("p",{children:(0,a.jsx)(o.Z,{id:"theme.NotFound.p2",description:"The 2nd paragraph of the 404 page",children:"Please contact the owner of the site that linked you to the original URL and let them know their link is broken."})})]})})})}}}]);