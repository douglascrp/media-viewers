<#assign el=args.htmlid?html>

<@markup id="css" >
   <#include "../../../alfresco/components/preview/include/web-preview-css-dependencies.lib.ftl" />
   <@link rel="stylesheet" type="text/css" href="${page.url.context}/res/extras/components/dashlets/web-preview.css" group="${dependencyGroup}"/>
   <@link rel="stylesheet" type="text/css" href="${page.url.context}/res/components/object-finder/object-finder.css" group="${dependencyGroup}" />

    <@link rel="stylesheet" type="text/css" href="${page.url.context}/res/extras/components/preview/FLVPlayer.css" group="${dependencyGroup}" />
    <@link rel="stylesheet" type="text/css" href="${page.url.context}/res/extras/components/preview/Prettify.css" group="${dependencyGroup}" />
    <@link rel="stylesheet" type="text/css" href="${page.url.context}/res/extras/components/preview/WebODF.css" group="${dependencyGroup}" />
    <@link rel="stylesheet" type="text/css" href="${page.url.context}/res/extras/components/preview/viewer-common.css" group="${dependencyGroup}" />


</@>

<@markup id="js" >
   <#include "../../../alfresco/components/preview/include/web-preview-js-dependencies.lib.ftl" />
   <@script type="text/javascript" src="${page.url.context}/res/extras/components/dashlets/web-preview.js" group="${dependencyGroup}"></@script>
   <@script type="text/javascript" src="${page.url.context}/res/modules/simple-dialog.js" group="${dependencyGroup}"></@script>
   <@script type="text/javascript" src="${url.context}/res/components/common/common-component-style-filter-chain.js" group="${dependencyGroup}"/>
   <@script type="text/javascript" src="${url.context}/res/components/object-finder/object-finder.js" group="${dependencyGroup}"/>

    <@script type="text/javascript" src="${url.context}/res/extras/components/preview/FLVPlayer.js" group="${dependencyGroup}"/>
    <@script type="text/javascript" src="${url.context}/res/extras/components/preview/Prettify.js" group="${dependencyGroup}"/>
    <@script type="text/javascript" src="${url.context}/res/extras/components/preview/WebODF.js" group="${dependencyGroup}"/>
    <@script type="text/javascript" src="${url.context}/res/extras/components/preview/web-preview-extend.js" group="${dependencyGroup}"/>

</@>

<@markup id="widgets">
   <#assign id=el?replace("-", "_")>
   <@inlineScript group="${dependencyGroup}">
   var editDocLinkEvent${id} = new YAHOO.util.CustomEvent("onDashletConfigure");
   </@>
   <@createWidgets group="${dependencyGroup}"/>
   <@inlineScript group="${dependencyGroup}">
   editDocLinkEvent${id}.subscribe(DocumentViewerDashlet.onConfigDashletClick, DocumentViewerDashlet, true);
   </@>
</@>

<@markup id="html">
   <@uniqueIdDiv>
      <#if node??>
         <#assign el=args.htmlid?html>
      <div id="${el}-body" class="web-preview">
          <div id="${el}-previewer-div" class="previewer">
              <div class="message"></div>
          </div>
      </div>
      </#if>

   <div class="dashlet video">
       <div class="title" id="${args.htmlid}-title">
          <#if node??>
              <a class="title-link" href="${url.context}/page/site/${page.url.templateArgs.site!''}/document-details?nodeRef=${args.nodeRef!''}">${args.name}</a>
          <#else>
             <#if args.name?exists>${args.name}<#else>${msg("header.video")}</#if>
          </#if>

       </div>
       <div class="body" id="${args.htmlid}-body" style="height: ${args.height!400}px;">
           <div class="msg dashlet-padding video-widget-msg" id="${args.htmlid}-msg"></div>
           <div class="video-preview" id="${args.htmlid}-preview"></div>
       </div>
   </div>
   </@>
</@>

