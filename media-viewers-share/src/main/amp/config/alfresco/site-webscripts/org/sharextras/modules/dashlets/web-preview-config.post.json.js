function main()
{
   var c = sitedata.getComponent(url.templateArgs.componentId);

   var docLinkTitle = String(json.get("docLinkTitle"));
   var docNoderef = String(json.get("nodeRef"));
   if(!docLinkTitle) {
      docLinkTitle="";
   }
   if(!docNoderef) {
      docNoderef="";
   }

   c.properties["docLinkTitle"] = docLinkTitle;
   c.properties["docNoderef"] = docNoderef;

   model.docLinkTitle = (docLinkTitle == "") ? null : docLinkTitle;
   model.docNoderef = (docNoderef == "") ? null : docNoderef;

   c.save();
}

main();