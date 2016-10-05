if (model.widgets)
{
   for (var i = 0; i < model.widgets.length; i++)
   {
      var widget = model.widgets[i];
      if (widget.id == "WebPreview")
      {
         var conditions = [];


          var aviTypes = ["application/x-troff-msvideo", "video/avi", "video/msvideo", "video/x-msvideo"]

          for (var n = 0; n < aviTypes.length; n++){
              // Video
              conditions.push({
                  attributes: {
                      mimeType: aviTypes[n]
                  },
                  plugins: [
                      {
                          name: "StrobeMediaPlayback",
                          attributes : {
                              src: "h264preview"
                          }
                      },
                      {
                          name: "Video",
                          attributes : {
                              src: "h264preview"
                          }
                      }
                  ]
              });
          }

         var oldConditions = eval("(" + widget.options.pluginConditions + ")");
         // Add the other conditions back in
         for (var j = 0; j < oldConditions.length; j++)
         {
            conditions.push(oldConditions[j]);
         }
         // Override the original conditions
         model.pluginConditions = jsonUtils.toJSONString(conditions);
         widget.options.pluginConditions = model.pluginConditions;
      }
   }
}