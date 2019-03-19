// Read configuration to decide when and if to show buttons.
// Peter Löfgren, Loftux AB,

var pdfjsraw = config.scoped["PdfJsRaw"], downloadButton = "hiddenMediumView", printButton = "hiddenMediumView",
    downloadButtonMenu = "visibleMediumView", printButtonMenu ="visibleMediumView";

if(pdfjsraw) {
    var buttons = pdfjsraw["buttons"];
    if(buttons) {
        var printValue = buttons.getChildValue("print");
        if(printValue) {
            printButton = printValue;
        }

        var downloadValue = buttons.getChildValue("download")
        if(downloadValue) {
            downloadButton = downloadValue;
        }
    }

    var buttonsMenu = pdfjsraw["buttonsMenu"];
    if(buttonsMenu) {
        var printValueMenu = buttonsMenu.getChildValue("print");
        if(printValueMenu) {
            printButtonMenu = printValueMenu;
        }

        var downloadValueMenu = buttonsMenu.getChildValue("download")
        if(downloadValueMenu) {
            downloadButtonMenu = downloadValueMenu;
        }
    }

}

model.printButton = printButton;
model.downloadButton = downloadButton;
model.downloadButtonMenu = downloadButtonMenu;
model.printButtonMenu = printButtonMenu;
