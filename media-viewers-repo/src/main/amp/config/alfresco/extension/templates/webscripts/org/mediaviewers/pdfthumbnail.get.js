function main()
{

    model.allowBrowserToCache = "false";


    // Get the node from the URL
    var pathSegments = url.match.split("/");
    var reference = [ url.templateArgs.store_type, url.templateArgs.store_id ].concat(url.templateArgs.id.split("/"));
    var node = search.findNode('node', reference);

    // 404 if the node to thumbnail is not found
    if (node == null)
    {
        status.setCode(status.STATUS_NOT_FOUND, "The thumbnail source node could not be found");
        return;
    }

    // 400 if the node is not a subtype of cm:content
    if (!node.isSubType("cm:content"))
    {
        status.setCode(status.STATUS_BAD_REQUEST, "The thumbnail source node is not a subtype of cm:content");
        return;
    }


    var thumbnailName = 'pdf';



    // Get the thumbnail
    var thumbnail = node.getThumbnail(thumbnailName);
    if (thumbnail == null || thumbnail.size == 0)
    {
        // Remove broken thumbnail
        if (thumbnail != null)
        {
            thumbnail.remove();
        }

        try {
            model.contentNode = node.createThumbnail(thumbnailName, false, true);
        }
        catch(e) {
            status.setCode(status.STATUS_NOT_FOUND, "Thumbnail could not be created");
            return;
        }

    }
    else
    {
        // Place the details of the thumbnail into the model, this will be used to stream the content to the client
        model.contentNode = thumbnail;
    }
}

main();