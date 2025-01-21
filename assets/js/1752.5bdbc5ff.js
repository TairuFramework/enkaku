"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([["1752"],{340:function(t,e,n){n.d(e,{diagram:function(){return B}});var i=n(2834),r=n(1508),s=n(7374),a=n(3397),l=n(3088),o=function(){var t=(0,i.eW)(function(t,e,n,i){for(n=n||{},i=t.length;i--;n[t[i]]=e);return n},"o"),e=[6,8,10,11,12,14,16,17,20,21],n=[1,9],r=[1,10],s=[1,11],a=[1,12],l=[1,13],o=[1,16],c=[1,17],h={trace:(0,i.eW)(function(){},"trace"),yy:{},symbols_:{error:2,start:3,timeline:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NEWLINE:10,title:11,acc_title:12,acc_title_value:13,acc_descr:14,acc_descr_value:15,acc_descr_multiline_value:16,section:17,period_statement:18,event_statement:19,period:20,event:21,$accept:0,$end:1},terminals_:{2:"error",4:"timeline",6:"EOF",8:"SPACE",10:"NEWLINE",11:"title",12:"acc_title",13:"acc_title_value",14:"acc_descr",15:"acc_descr_value",16:"acc_descr_multiline_value",17:"section",20:"period",21:"event"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,1],[18,1],[19,1]],performAction:(0,i.eW)(function(t,e,n,i,r,s,a){var l=s.length-1;switch(r){case 1:return s[l-1];case 2:case 6:case 7:this.$=[];break;case 3:s[l-1].push(s[l]),this.$=s[l-1];break;case 4:case 5:this.$=s[l];break;case 8:i.getCommonDb().setDiagramTitle(s[l].substr(6)),this.$=s[l].substr(6);break;case 9:this.$=s[l].trim(),i.getCommonDb().setAccTitle(this.$);break;case 10:case 11:this.$=s[l].trim(),i.getCommonDb().setAccDescription(this.$);break;case 12:i.addSection(s[l].substr(8)),this.$=s[l].substr(8);break;case 15:i.addTask(s[l],0,""),this.$=s[l];break;case 16:i.addEvent(s[l].substr(2)),this.$=s[l]}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(e,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:n,12:r,14:s,16:a,17:l,18:14,19:15,20:o,21:c},t(e,[2,7],{1:[2,1]}),t(e,[2,3]),{9:18,11:n,12:r,14:s,16:a,17:l,18:14,19:15,20:o,21:c},t(e,[2,5]),t(e,[2,6]),t(e,[2,8]),{13:[1,19]},{15:[1,20]},t(e,[2,11]),t(e,[2,12]),t(e,[2,13]),t(e,[2,14]),t(e,[2,15]),t(e,[2,16]),t(e,[2,4]),t(e,[2,9]),t(e,[2,10])],defaultActions:{},parseError:(0,i.eW)(function(t,e){if(e.recoverable)this.trace(t);else{var n=Error(t);throw n.hash=e,n}},"parseError"),parse:(0,i.eW)(function(t){var e=this,n=[0],r=[],s=[null],a=[],l=this.table,o="",c=0,h=0,d=0,u=a.slice.call(arguments,1),p=Object.create(this.lexer),y={yy:{}};for(var g in this.yy)Object.prototype.hasOwnProperty.call(this.yy,g)&&(y.yy[g]=this.yy[g]);p.setInput(t,y.yy),y.yy.lexer=p,y.yy.parser=this,void 0===p.yylloc&&(p.yylloc={});var f=p.yylloc;a.push(f);var m=p.options&&p.options.ranges;function x(){var t;return"number"!=typeof(t=r.pop()||p.lex()||1)&&(t instanceof Array&&(t=(r=t).pop()),t=e.symbols_[t]||t),t}"function"==typeof y.yy.parseError?this.parseError=y.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError,(0,i.eW)(function(t){n.length=n.length-2*t,s.length=s.length-t,a.length=a.length-t},"popStack"),(0,i.eW)(x,"lex");for(var b,_,k,v,w,W,S,$,E,M={};;){if(k=n[n.length-1],this.defaultActions[k]?v=this.defaultActions[k]:(null==b&&(b=x()),v=l[k]&&l[k][b]),void 0===v||!v.length||!v[0]){var I="";for(W in E=[],l[k])this.terminals_[W]&&W>2&&E.push("'"+this.terminals_[W]+"'");I=p.showPosition?"Parse error on line "+(c+1)+":\n"+p.showPosition()+"\nExpecting "+E.join(", ")+", got '"+(this.terminals_[b]||b)+"'":"Parse error on line "+(c+1)+": Unexpected "+(1==b?"end of input":"'"+(this.terminals_[b]||b)+"'"),this.parseError(I,{text:p.match,token:this.terminals_[b]||b,line:p.yylineno,loc:f,expected:E})}if(v[0]instanceof Array&&v.length>1)throw Error("Parse Error: multiple actions possible at state: "+k+", token: "+b);switch(v[0]){case 1:n.push(b),s.push(p.yytext),a.push(p.yylloc),n.push(v[1]),b=null,_?(b=_,_=null):(h=p.yyleng,o=p.yytext,c=p.yylineno,f=p.yylloc,d>0&&d--);break;case 2:if(S=this.productions_[v[1]][1],M.$=s[s.length-S],M._$={first_line:a[a.length-(S||1)].first_line,last_line:a[a.length-1].last_line,first_column:a[a.length-(S||1)].first_column,last_column:a[a.length-1].last_column},m&&(M._$.range=[a[a.length-(S||1)].range[0],a[a.length-1].range[1]]),void 0!==(w=this.performAction.apply(M,[o,h,c,y.yy,v[1],s,a].concat(u))))return w;S&&(n=n.slice(0,-1*S*2),s=s.slice(0,-1*S),a=a.slice(0,-1*S)),n.push(this.productions_[v[1]][0]),s.push(M.$),a.push(M._$),$=l[n[n.length-2]][n[n.length-1]],n.push($);break;case 3:return!0}}return!0},"parse")},d={EOF:1,parseError:(0,i.eW)(function(t,e){if(this.yy.parser)this.yy.parser.parseError(t,e);else throw Error(t)},"parseError"),setInput:(0,i.eW)(function(t,e){return this.yy=e||this.yy||{},this._input=t,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:(0,i.eW)(function(){var t=this._input[0];return this.yytext+=t,this.yyleng++,this.offset++,this.match+=t,this.matched+=t,t.match(/(?:\r\n?|\n).*/g)?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),t},"input"),unput:(0,i.eW)(function(t){var e=t.length,n=t.split(/(?:\r\n?|\n)/g);this._input=t+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-e),this.offset-=e;var i=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),n.length-1&&(this.yylineno-=n.length-1);var r=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:n?(n.length===i.length?this.yylloc.first_column:0)+i[i.length-n.length].length-n[0].length:this.yylloc.first_column-e},this.options.ranges&&(this.yylloc.range=[r[0],r[0]+this.yyleng-e]),this.yyleng=this.yytext.length,this},"unput"),more:(0,i.eW)(function(){return this._more=!0,this},"more"),reject:(0,i.eW)(function(){return this.options.backtrack_lexer?(this._backtrack=!0,this):this.parseError("Lexical error on line "+(this.yylineno+1)+". You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},"reject"),less:(0,i.eW)(function(t){this.unput(this.match.slice(t))},"less"),pastInput:(0,i.eW)(function(){var t=this.matched.substr(0,this.matched.length-this.match.length);return(t.length>20?"...":"")+t.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:(0,i.eW)(function(){var t=this.match;return t.length<20&&(t+=this._input.substr(0,20-t.length)),(t.substr(0,20)+(t.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:(0,i.eW)(function(){var t=this.pastInput(),e=Array(t.length+1).join("-");return t+this.upcomingInput()+"\n"+e+"^"},"showPosition"),test_match:(0,i.eW)(function(t,e){var n,i,r;if(this.options.backtrack_lexer&&(r={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(r.yylloc.range=this.yylloc.range.slice(0))),(i=t[0].match(/(?:\r\n?|\n).*/g))&&(this.yylineno+=i.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:i?i[i.length-1].length-i[i.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+t[0].length},this.yytext+=t[0],this.match+=t[0],this.matches=t,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(t[0].length),this.matched+=t[0],n=this.performAction.call(this,this.yy,this,e,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),n)return n;if(this._backtrack)for(var s in r)this[s]=r[s];return!1},"test_match"),next:(0,i.eW)(function(){if(this.done)return this.EOF;this._input||(this.done=!0),this._more||(this.yytext="",this.match="");for(var t,e,n,i,r=this._currentRules(),s=0;s<r.length;s++)if((n=this._input.match(this.rules[r[s]]))&&(!e||n[0].length>e[0].length)){if(e=n,i=s,this.options.backtrack_lexer){if(!1!==(t=this.test_match(n,r[s])))return t;if(!this._backtrack)return!1;e=!1;continue}if(!this.options.flex)break}return e?!1!==(t=this.test_match(e,r[i]))&&t:""===this._input?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+". Unrecognized text.\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:(0,i.eW)(function(){var t=this.next();return t||this.lex()},"lex"),begin:(0,i.eW)(function(t){this.conditionStack.push(t)},"begin"),popState:(0,i.eW)(function(){return this.conditionStack.length-1>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:(0,i.eW)(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:(0,i.eW)(function(t){return(t=this.conditionStack.length-1-Math.abs(t||0))>=0?this.conditionStack[t]:"INITIAL"},"topState"),pushState:(0,i.eW)(function(t){this.begin(t)},"pushState"),stateStackSize:(0,i.eW)(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:(0,i.eW)(function(t,e,n,i){switch(n){case 0:case 1:case 3:case 4:break;case 2:return 10;case 5:return 4;case 6:return 11;case 7:return this.begin("acc_title"),12;case 8:return this.popState(),"acc_title_value";case 9:return this.begin("acc_descr"),14;case 10:return this.popState(),"acc_descr_value";case 11:this.begin("acc_descr_multiline");break;case 12:this.popState();break;case 13:return"acc_descr_multiline_value";case 14:return 17;case 15:return 21;case 16:return 20;case 17:return 6;case 18:return"INVALID"}},"anonymous"),rules:[/^(?:%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:#[^\n]*)/i,/^(?:timeline\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:section\s[^:\n]+)/i,/^(?::\s[^:\n]+)/i,/^(?:[^#:\n]+)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[12,13],inclusive:!1},acc_descr:{rules:[10],inclusive:!1},acc_title:{rules:[8],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,9,11,14,15,16,17,18],inclusive:!0}}};function u(){this.yy={}}return h.lexer=d,(0,i.eW)(u,"Parser"),u.prototype=h,h.Parser=u,new u}();o.parser=o;var c={};(0,i.r2)(c,{addEvent:()=>k,addSection:()=>m,addTask:()=>_,addTaskOrg:()=>v,clear:()=>f,default:()=>W,getCommonDb:()=>g,getSections:()=>x,getTasks:()=>b});var h="",d=0,u=[],p=[],y=[],g=(0,i.eW)(()=>i.LJ,"getCommonDb"),f=(0,i.eW)(function(){u.length=0,p.length=0,h="",y.length=0,(0,i.ZH)()},"clear"),m=(0,i.eW)(function(t){h=t,u.push(t)},"addSection"),x=(0,i.eW)(function(){return u},"getSections"),b=(0,i.eW)(function(){let t=w(),e=0;for(;!t&&e<100;)t=w(),e++;return p.push(...y),p},"getTasks"),_=(0,i.eW)(function(t,e,n){let i={id:d++,section:h,type:h,task:t,score:e||0,events:n?[n]:[]};y.push(i)},"addTask"),k=(0,i.eW)(function(t){y.find(t=>t.id===d-1).events.push(t)},"addEvent"),v=(0,i.eW)(function(t){let e={section:h,type:h,description:t,task:t,classes:[]};p.push(e)},"addTaskOrg"),w=(0,i.eW)(function(){let t=(0,i.eW)(function(t){return y[t].processed},"compileTask"),e=!0;for(let[n,i]of y.entries())t(n),e=e&&i.processed;return e},"compileTasks"),W={clear:f,getCommonDb:g,addSection:m,getSections:x,getTasks:b,addTask:_,addTaskOrg:v,addEvent:k},S=(0,i.eW)(function(t,e){let n=t.append("rect");return n.attr("x",e.x),n.attr("y",e.y),n.attr("fill",e.fill),n.attr("stroke",e.stroke),n.attr("width",e.width),n.attr("height",e.height),n.attr("rx",e.rx),n.attr("ry",e.ry),void 0!==e.class&&n.attr("class",e.class),n},"drawRect"),$=(0,i.eW)(function(t,e){let n=t.append("circle").attr("cx",e.cx).attr("cy",e.cy).attr("class","face").attr("r",15).attr("stroke-width",2).attr("overflow","visible"),s=t.append("g");function a(t){let n=(0,r.Nb1)().startAngle(Math.PI/2).endAngle(Math.PI/2*3).innerRadius(7.5).outerRadius(15/2.2);t.append("path").attr("class","mouth").attr("d",n).attr("transform","translate("+e.cx+","+(e.cy+2)+")")}function l(t){let n=(0,r.Nb1)().startAngle(3*Math.PI/2).endAngle(Math.PI/2*5).innerRadius(7.5).outerRadius(15/2.2);t.append("path").attr("class","mouth").attr("d",n).attr("transform","translate("+e.cx+","+(e.cy+7)+")")}function o(t){t.append("line").attr("class","mouth").attr("stroke",2).attr("x1",e.cx-5).attr("y1",e.cy+7).attr("x2",e.cx+5).attr("y2",e.cy+7).attr("class","mouth").attr("stroke-width","1px").attr("stroke","#666")}return s.append("circle").attr("cx",e.cx-5).attr("cy",e.cy-5).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666"),s.append("circle").attr("cx",e.cx+5).attr("cy",e.cy-5).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666"),(0,i.eW)(a,"smile"),(0,i.eW)(l,"sad"),(0,i.eW)(o,"ambivalent"),e.score>3?a(s):e.score<3?l(s):o(s),n},"drawFace"),E=(0,i.eW)(function(t,e){let n=e.text.replace(/<br\s*\/?>/gi," "),i=t.append("text");i.attr("x",e.x),i.attr("y",e.y),i.attr("class","legend"),i.style("text-anchor",e.anchor),void 0!==e.class&&i.attr("class",e.class);let r=i.append("tspan");return r.attr("x",e.x+2*e.textMargin),r.text(n),i},"drawText"),M=-1,I=(0,i.eW)(function(){return{x:0,y:0,width:100,anchor:"start",height:100,rx:0,ry:0}},"getNoteRect"),T=function(){function t(t,e,n,i,s,a,l,o){r(e.append("text").attr("x",n+s/2).attr("y",i+a/2+5).style("font-color",o).style("text-anchor","middle").text(t),l)}function e(t,e,n,i,s,a,l,o,c){let{taskFontSize:h,taskFontFamily:d}=o,u=t.split(/<br\s*\/?>/gi);for(let t=0;t<u.length;t++){let o=t*h-h*(u.length-1)/2,p=e.append("text").attr("x",n+s/2).attr("y",i).attr("fill",c).style("text-anchor","middle").style("font-size",h).style("font-family",d);p.append("tspan").attr("x",n+s/2).attr("dy",o).text(u[t]),p.attr("y",i+a/2).attr("dominant-baseline","central").attr("alignment-baseline","central"),r(p,l)}}function n(t,n,i,s,a,l,o,c){let h=n.append("switch"),d=h.append("foreignObject").attr("x",i).attr("y",s).attr("width",a).attr("height",l).attr("position","fixed").append("xhtml:div").style("display","table").style("height","100%").style("width","100%");d.append("div").attr("class","label").style("display","table-cell").style("text-align","center").style("vertical-align","middle").text(t),e(t,h,i,s,a,l,o,c),r(d,o)}function r(t,e){for(let n in e)n in e&&t.attr(n,e[n])}return(0,i.eW)(t,"byText"),(0,i.eW)(e,"byTspan"),(0,i.eW)(n,"byFo"),(0,i.eW)(r,"_setTextAttrs"),function(i){return"fo"===i.textPlacement?n:"old"===i.textPlacement?t:e}}(),A=(0,i.eW)(function(t){t.append("defs").append("marker").attr("id","arrowhead").attr("refX",5).attr("refY",2).attr("markerWidth",6).attr("markerHeight",4).attr("orient","auto").append("path").attr("d","M 0,0 V 4 L6,2 Z")},"initGraphics");function N(t,e){t.each(function(){var t,n=(0,r.Ys)(this),i=n.text().split(/(\s+|<br>)/).reverse(),s=[],a=n.attr("y"),l=parseFloat(n.attr("dy")),o=n.text(null).append("tspan").attr("x",0).attr("y",a).attr("dy",l+"em");for(let r=0;r<i.length;r++)t=i[i.length-1-r],s.push(t),o.text(s.join(" ").trim()),(o.node().getComputedTextLength()>e||"<br>"===t)&&(s.pop(),o.text(s.join(" ").trim()),s="<br>"===t?[""]:[t],o=n.append("tspan").attr("x",0).attr("y",a).attr("dy","1.1em").text(t))})}(0,i.eW)(N,"wrap");var C=(0,i.eW)(function(t,e,n,i){let r=n%12-1,s=t.append("g");e.section=r,s.attr("class",(e.class?e.class+" ":"")+"timeline-node section-"+r);let a=s.append("g"),l=s.append("g"),o=l.append("text").text(e.descr).attr("dy","1em").attr("alignment-baseline","middle").attr("dominant-baseline","middle").attr("text-anchor","middle").call(N,e.width).node().getBBox(),c=i.fontSize?.replace?i.fontSize.replace("px",""):i.fontSize;return e.height=o.height+.55*c+e.padding,e.height=Math.max(e.height,e.maxHeight),e.width=e.width+2*e.padding,l.attr("transform","translate("+e.width/2+", "+e.padding/2+")"),L(a,e,r,i),e},"drawNode"),H=(0,i.eW)(function(t,e,n){let i=t.append("g"),r=i.append("text").text(e.descr).attr("dy","1em").attr("alignment-baseline","middle").attr("dominant-baseline","middle").attr("text-anchor","middle").call(N,e.width).node().getBBox(),s=n.fontSize?.replace?n.fontSize.replace("px",""):n.fontSize;return i.remove(),r.height+.55*s+e.padding},"getVirtualNodeHeight"),L=(0,i.eW)(function(t,e,n){t.append("path").attr("id","node-"+e.id).attr("class","node-bkg node-"+e.type).attr("d",`M0 ${e.height-5} v${-e.height+10} q0,-5 5,-5 h${e.width-10} q5,0 5,5 v${e.height-5} H0 Z`),t.append("line").attr("class","node-line-"+n).attr("x1",0).attr("y1",e.height).attr("x2",e.width).attr("y2",e.height)},"defaultBkg"),P={initGraphics:A,drawNode:C,getVirtualNodeHeight:H},O=(0,i.eW)(function(t,e,n,s){let a;let l=(0,i.nV)(),o=l.leftMargin??50;i.cM.debug("timeline",s.db);let c=l.securityLevel;"sandbox"===c&&(a=(0,r.Ys)("#i"+e));let h=("sandbox"===c?(0,r.Ys)(a.nodes()[0].contentDocument.body):(0,r.Ys)("body")).select("#"+e);h.append("g");let d=s.db.getTasks(),u=s.db.getCommonDb().getDiagramTitle();i.cM.debug("task",d),P.initGraphics(h);let p=s.db.getSections();i.cM.debug("sections",p);let y=0,g=0,f=0,m=0,x=50+o,b=50;m=50;let _=0,k=!0;p.forEach(function(t){let e={number:_,descr:t,section:_,width:150,padding:20,maxHeight:y},n=P.getVirtualNodeHeight(h,e,l);i.cM.debug("sectionHeight before draw",n),y=Math.max(y,n+20)});let v=0,w=0;for(let[t,e]of(i.cM.debug("tasks.length",d.length),d.entries())){let n={number:t,descr:e,section:e.section,width:150,padding:20,maxHeight:g},r=P.getVirtualNodeHeight(h,n,l);i.cM.debug("taskHeight before draw",r),g=Math.max(g,r+20),v=Math.max(v,e.events.length);let s=0;for(let t of e.events){let n={descr:t,section:e.section,number:e.section,width:150,padding:20,maxHeight:50};s+=P.getVirtualNodeHeight(h,n,l)}w=Math.max(w,s)}i.cM.debug("maxSectionHeight before draw",y),i.cM.debug("maxTaskHeight before draw",g),p&&p.length>0?p.forEach(t=>{let e=d.filter(e=>e.section===t),n={number:_,descr:t,section:_,width:200*Math.max(e.length,1)-50,padding:20,maxHeight:y};i.cM.debug("sectionNode",n);let r=h.append("g"),s=P.drawNode(r,n,_,l);i.cM.debug("sectionNode output",s),r.attr("transform",`translate(${x}, ${m})`),b+=y+50,e.length>0&&j(h,e,_,x,b,g,l,v,w,y,!1),x+=200*Math.max(e.length,1),b=m,_++}):(k=!1,j(h,d,_,x,b,g,l,v,w,y,!0));let W=h.node().getBBox();i.cM.debug("bounds",W),u&&h.append("text").text(u).attr("x",W.width/2-o).attr("font-size","4ex").attr("font-weight","bold").attr("y",20),f=k?y+g+150:g+100,h.append("g").attr("class","lineWrapper").append("line").attr("x1",o).attr("y1",f).attr("x2",W.width+3*o).attr("y2",f).attr("stroke-width",4).attr("stroke","black").attr("marker-end","url(#arrowhead)"),(0,i.j7)(void 0,h,l.timeline?.padding??50,l.timeline?.useMaxWidth??!1)},"draw"),j=(0,i.eW)(function(t,e,n,r,s,a,l,o,c,h,d){for(let o of e){let e={descr:o.task,section:n,number:n,width:150,padding:20,maxHeight:a};i.cM.debug("taskNode",e);let u=t.append("g").attr("class","taskWrapper"),p=P.drawNode(u,e,n,l).height;if(i.cM.debug("taskHeight after draw",p),u.attr("transform",`translate(${r}, ${s})`),a=Math.max(a,p),o.events){let e=t.append("g").attr("class","lineWrapper");s+=100,D(t,o.events,n,r,s,l),s-=100,e.append("line").attr("x1",r+95).attr("y1",s+a).attr("x2",r+95).attr("y2",s+a+(d?a:h)+c+120).attr("stroke-width",2).attr("stroke","black").attr("marker-end","url(#arrowhead)").attr("stroke-dasharray","5,5")}r+=200,d&&!l.timeline?.disableMulticolor&&n++}},"drawTasks"),D=(0,i.eW)(function(t,e,n,r,s,a){let l=0,o=s;for(let o of(s+=100,e)){let e={descr:o,section:n,number:n,width:150,padding:20,maxHeight:50};i.cM.debug("eventNode",e);let c=t.append("g").attr("class","eventWrapper"),h=P.drawNode(c,e,n,a).height;l+=h,c.attr("transform",`translate(${r}, ${s})`),s=s+10+h}return s=o,l},"drawEvents"),z={setConf:(0,i.eW)(()=>{},"setConf"),draw:O},R=(0,i.eW)(t=>{let e="";for(let e=0;e<t.THEME_COLOR_LIMIT;e++)t["lineColor"+e]=t["lineColor"+e]||t["cScaleInv"+e],(0,s.Z)(t["lineColor"+e])?t["lineColor"+e]=(0,a.Z)(t["lineColor"+e],20):t["lineColor"+e]=(0,l.Z)(t["lineColor"+e],20);for(let n=0;n<t.THEME_COLOR_LIMIT;n++){let i=""+(17-3*n);e+=`
    .section-${n-1} rect, .section-${n-1} path, .section-${n-1} circle, .section-${n-1} path  {
      fill: ${t["cScale"+n]};
    }
    .section-${n-1} text {
     fill: ${t["cScaleLabel"+n]};
    }
    .node-icon-${n-1} {
      font-size: 40px;
      color: ${t["cScaleLabel"+n]};
    }
    .section-edge-${n-1}{
      stroke: ${t["cScale"+n]};
    }
    .edge-depth-${n-1}{
      stroke-width: ${i};
    }
    .section-${n-1} line {
      stroke: ${t["cScaleInv"+n]} ;
      stroke-width: 3;
    }

    .lineWrapper line{
      stroke: ${t["cScaleLabel"+n]} ;
    }

    .disabled, .disabled circle, .disabled text {
      fill: lightgray;
    }
    .disabled text {
      fill: #efefef;
    }
    `}return e},"genSections"),B={db:c,renderer:z,parser:o,styles:(0,i.eW)(t=>`
  .edge {
    stroke-width: 3;
  }
  ${R(t)}
  .section-root rect, .section-root path, .section-root circle  {
    fill: ${t.git0};
  }
  .section-root text {
    fill: ${t.gitBranchLabel0};
  }
  .icon-container {
    height:100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .edge {
    fill: none;
  }
  .eventWrapper  {
   filter: brightness(120%);
  }
`,"getStyles")}}}]);