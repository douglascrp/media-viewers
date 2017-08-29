<#escape x as jsonUtils.encodeJSONString(x)>
{
"title": "<#if docLinkTitle??>${docLinkTitle}</#if>",
"nodeRef": "<#if docNoderef??>${docNoderef}</#if>"
}
</#escape>