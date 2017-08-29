function main()
{
   var docNoderef = '',
      docLinkTitle = '',
      height = '',
      isDefault = false;

   if (args.docLinkTitle)
   {
      docLinkTitle = args.docLinkTitle;
      model.docLinkTitle = docLinkTitle;
   }
   if(args.docNoderef){
      docNoderef = args.docNoderef;
      model.docNoderef = docNoderef;
      model.docNoderefurl = docNoderef.replace("://","/");
   }

   if (args.height)
   {
      height = args.height;
   }


   model.height = height;
   model.isDefault = isDefault;

   var userIsSiteManager = true;
   if (page.url.templateArgs.site)
   {
      // We are in the context of a site, so call the repository to see if the user is site manager or not
      userIsSiteManager = false;
      var json = remote.call("/api/sites/" + page.url.templateArgs.site + "/memberships/" + encodeURIComponent(user.name));

      if (json.status == 200)
      {
         var obj = JSON.parse(json);
         if (obj)
         {
            userIsSiteManager = (obj.role == "SiteManager");
         }
      }
   }
   model.userIsSiteManager = userIsSiteManager;

   // Widget instantiation metadata...
   var DocumentViewerDashlet = {
      id : "DocumentViewerDashlet",
      name : "Alfresco.dashlet.DocumentViewerDashlet",
      assignTo : "DocumentViewerDashlet",
      useMessages: true,
      useOptions: true,
      options : {

         componentId : instance.object.id,
         nodeRef : docNoderef,
         title : docLinkTitle,
         siteId : page.url.templateArgs.site ? page.url.templateArgs.site : ""

      }
   };

   var dashletResizer = {
      id : "DashletResizer",
      name : "Alfresco.widget.DashletResizer",
      initArgs : ["\"" + args.htmlid + "\"", "\"" + instance.object.id + "\""],
      useMessages: false
   };

   var actions = [];
   if (model.userIsSiteManager)
   {
      actions.push(
         {
            cssClass: "edit",
            eventOnClick: {
               _alfValue : "editDocLinkEvent" + args.htmlid.replace(/-/g, "_"),
               _alfType: "REFERENCE"
            },
            tooltip: msg.get("dashlet.edit.tooltip")
         });
   }


   var dashletTitleBarActions = {
      id : "DashletTitleBarActions",
      name : "Alfresco.widget.DashletTitleBarActions",
      useMessages : false,
      options : {
         actions: actions
      }
   };
   model.widgets = [DocumentViewerDashlet, dashletTitleBarActions, dashletResizer];
}

main();

// Set the group from the component property...
model.dependencyGroup =  (args.dependencyGroup != null) ? args.dependencyGroup : "dashlet";