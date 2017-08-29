<#assign el=args.htmlid?html>
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

          <p>
              <div class="form-field">
                  <label for="${el}-docLinkTitle">${msg("label.title")}</label>
                  <input id="${el}-docLinkTitle" type="text" name="docLinkTitle" tabindex="0" value="${(docLinkTitle!"")?html}" maxlength="256"/>&nbsp;*
              </div>
          </p>
          <p>
              <div class="form-field">
              <#assign controlId = el +"-nodeRef">
                  <label for="${controlId}">${msg("label.document.display")}: <span class="mandatory-indicator">*</span></label>

                  <div id="${controlId}" class="object-finder">

                      <div id="${controlId}-currentValueDisplay" class="current-values"></div>

                      <input type="hidden" id="${controlId}-html" name="nodeRef" value="" />
                      <div id="${controlId}-itemGroupActions" class="show-picker"></div>

                  <@renderPickerHTML controlId />

                  </div>
              </div>
          </p>


              <div class="bdft">
                  <input type="submit" id="${el}-ok" value="${msg("button.ok")}" tabindex="0" />
                  <input type="button" id="${el}-cancel" value="${msg("button.cancel")}" tabindex="0" />
              </div>
      </form>
   </div>
</div>