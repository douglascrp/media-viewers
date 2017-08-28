<#assign el=args.htmlid?html>

<#--Picker Macro for content goes here.-->
<#macro renderPickerHTML controlId>
   <#assign pickerId = controlId + "-picker">
<div id="${pickerId}" class="picker yui-panel">
    <div id="${pickerId}-head" class="hd">${msg("form.control.object-picker.header")}</div>

    <div id="${pickerId}-body" class="bd">
        <div class="picker-header">
            <div id="${pickerId}-folderUpContainer" class="folder-up"><button id="${pickerId}-folderUp"></button></div>
            <div id="${pickerId}-navigatorContainer" class="navigator">
                <button id="${pickerId}-navigator"></button>
                <div id="${pickerId}-navigatorMenu" class="yuimenu">
                    <div class="bd">
                        <ul id="${pickerId}-navigatorItems" class="navigator-items-list">
                            <li>&nbsp;</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div id="${pickerId}-searchContainer" class="picker-search">
                <input type="text" class="picker-search-input" name="-" id="${pickerId}-searchText" value="" maxlength="256" />
                <span class="search-button"><button id="${pickerId}-searchButton">${msg("form.control.object-picker.search")}</button></span>
            </div>
        </div>
        <div class="yui-g">
            <div id="${pickerId}-left" class="yui-u first panel-left">
                <div id="${pickerId}-results" class="picker-items">
                   <#nested>
                </div>
            </div>
            <div id="${pickerId}-right" class="yui-u panel-right">
                <div id="${pickerId}-selectedItems" class="picker-items"></div>
            </div>
        </div>
        <div class="bdft">
            <button id="${controlId}-ok" tabindex="0">${msg("button.ok")}</button>
            <button id="${controlId}-cancel" tabindex="0">${msg("button.cancel")}</button>
        </div>
    </div>

</div>
</#macro>


<#--Actual dialog is being shown here. -->
<div id="${args.htmlid}-configDialog" class="config-video">
   <div class="hd">${msg("label.header")}</div>
   <div class="bd">
      <form id="${args.htmlid}-form" action="" method="POST">

          <#--legacy browse button-->
          <#--<div class="yui-gd">-->
            <#--<div class="yui-u first"><label for="${args.htmlid}-video">${msg("label.video")}:</label></div>-->
            <#--<div class="yui-u" >-->
               <#--<span id="${args.htmlid}-video" class="video-name"></span>-->
               <#--<div id="${args.htmlid}-filePicker">-->
                  <#--<button type="button" name="-" id="${args.htmlid}-filePicker-showPicker-button">${msg("label.browse")}</button>-->
               <#--</div>-->
               <#--<input type="hidden" name="pathField" id="${args.htmlid}-pathField" />-->
               <#--<input type="hidden" name="name" id="${args.htmlid}-name" />-->
            <#--</div>-->
         <#--</div>-->

          <#--contentNodeRef picker-->
          <div class="form-field">
            <#assign controlId = el +"-nodeRef">
              <label for="${controlId}">${msg("label.video")} <span class="mandatory-indicator">*</span></label>
              <div id="${controlId}" class="object-finder">
                  <div id="${controlId}-currentValueDisplay" class="current-values"></div>
                  <input type="hidden" id="${controlId}-html" name="nodeRef" value="" />
                  <div id="${controlId}-itemGroupActions" class="show-picker"></div>
                    <@renderPickerHTML controlId />
              </div>
          </div>


         <div class="bdft">
            <input type="submit" id="${args.htmlid}-ok" value="${msg("button.ok")}" />
            <input type="button" id="${args.htmlid}-cancel" value="${msg("button.cancel")}" />
         </div>
      </form>
   </div>
</div>