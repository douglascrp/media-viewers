/*
 * Copyright (C) 2010-2013 Share Extras contributors
 *
 * This file is part of the Share Extras project.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * This is the "PdfJs" plugin that renders PDF files using the popular pdf.js
 * library. By default the pdf.js libraries are used directly, but in 'iframe'
 * mode it is possible to force the viewer to use the viewer implementation
 * provided by pdf.js within an iframe. This mode may be deprecated in the
 * future.
 * 
 * Supports the "application/pdf" mime type directly, plus any other type
 * for which a PDF thumbnail definition is available.
 * 
 * @namespace Alfresco.WebPreview.prototype.Plugins
 * @class Alfresco.WebPreview.prototype.Plugins.PdfJs
 * @author Peter Lofgren Loftux AB
 * @author Will Abson
 */

(function()
{
   // IE does not support const
   var K_UNKNOWN_SCALE = 0;
   var K_CSS_UNITS = 96.0 / 72.0;
   var K_MIN_SCALE = 0.25;
   var K_MAX_SCALE = 4.0;

   /**
    * YUI aliases
    */
   var Dom = YAHOO.util.Dom, 
      Event = YAHOO.util.Event, 
      Element = YAHOO.util.Element;

   /**
    * Alfresco Slingshot aliases
    */
   var $html = Alfresco.util.encodeHTML;

   /**
    * PdfJs plug-in constructor
    * 
    * @constructor
    * @param wp {Alfresco.WebPreview} The Alfresco.WebPreview instance that decides which plugin to use
    * @param attributes {object} Arbitrary attributes brought in from the <plugin> element
    */
   Alfresco.WebPreview.prototype.Plugins.PdfJs = function(wp, attributes)
   {
      this.pages = [];
      this.pageText = [];
      this.widgets = {};
      this.documentConfig = {};
      this.wp = wp;
      this.id = wp.id; // needed by Alfresco.util.createYUIButton
      this.attributes = YAHOO.lang.merge(Alfresco.util.deepCopy(this.attributes), attributes);
      
      /*
       * Custom events
       */
      this.onPdfLoaded = new YAHOO.util.CustomEvent("pdfLoaded", this);
      this.onResize = new YAHOO.util.CustomEvent("resize", this);
      
      return this;
   };

   Alfresco.WebPreview.prototype.Plugins.PdfJs.prototype =
   {
      /**
       * Configuration attributes
       * 
       * @property attributes
       * @type object
       */
      attributes:
      {
         /**
          * Decides if the node's content or one of its thumbnails shall be
          * displayed. Leave it as it is if the node's content shall be used. Set
          * to a custom thumbnail definition name if the node's thumbnail contains
          * the PdfJs to display.
          * 
          * @property src
          * @type String
          * @default null
          */
         src : null,

         /**
          * Skipbrowser test, mostly for developer to force test loading. Valid
          * options "true" "false" as String.
          * 
          * @property skipbrowsertest
          * @type String
          * @default "false"
          */
         skipbrowsertest : "false",

         /**
          * Default zoom level for new documents
          * 
          * @property defaultScale
          * @type String
          * @default "auto"
          */
         defaultScale : "auto",

         /**
          * Multipler for zooming in/out
          * 
          * @property scaleDelta
          * @type String
          * @default "1.1"
          */
         scaleDelta : "1.1",

         /**
          * Minimum scale level to use when auto-scaling a document
          * 
          * @property autoMinScale
          * @type String
          * @default "0.7"
          */
         autoMinScale : "0.7",

         /**
          * Maximum scale level to use when auto-scaling a document
          * 
          * @property autoMaxScale
          * @type String
          * @default "1.25"
          */
         autoMaxScale : "1.25",

         /**
          * Layout to use to display pages, "single" (one page per row) or "multi" (multiple pages per row)
          * 
          * @property pageLayout
          * @type String
          * @default "multi"
          */
         pageLayout : "multi",

         /**
          * Whether text overlays on pages should be disabled. Overlays allow users to select text
          * content in their browser but reduce rendering performance.
          * 
          * @property disableTextLayer
          * @type String
          * @default "false"
          */
         disableTextLayer : "false",

         /**
          * Whether to use HTML5 browser storage to persist the page number and zoom level of previously-viewed documents
          * 
          * @property useLocalStorage
          * @type String
          * @default "true"
          */
         useLocalStorage : "true",

         /**
          * If the user came from the search page, should the search feature be automatically triggered?
          * 
          * @property autoSearch
          * @type String
          * @default "true"
          */
         autoSearch : "true"
      },

      /**
       * Cached PDF document, once loaded from the server
       * 
       * @property pdfDoc
       * @type {object}
       * @default null
       */
      pdfDoc : null,

      /**
       * Current page number
       * 
       * @property pageNum
       * @type int
       * @default 1
       */
      pageNum : 1,

      /**
       * Cached pages from the PDF doc
       * 
       * @property pages
       * @type {array}
       * @default []
       */
      pages : [],

      /**
       * Cached page text from the document, for searching purposes
       * 
       * @property pageText
       * @type {array}
       * @default []
       */
      pageText : [],

      /**
       * Total number of pages in the current document
       * 
       * @property numPages
       * @type int
       * @default 0
       */
      numPages : 0,

      /**
       * YUI widgets container
       * 
       * @property widgets
       * @type object
       * @default {}
       */
      widgets : {},

      /**
       * Whether the page view is maximised within the client
       * 
       * @property maximized
       * @type boolean
       * @default false
       */
      maximized : false,

      /**
       * Stored configuration for this particular document, including page number and zoom level. Persisted to local browser storage.
       * 
       * @property documentConfig
       * @type {object}
       * @default {}
       */
      documentConfig : {},

      /**
       * Whether the previewer is embedded in a wiki page
       * 
       * @property inWikiPage
       * @type boolean
       * @default false
       */
      inWikiPage : false,

      /**
       * Whether the previewer is embedded in a dashlet
       * 
       * @property inDashlet
       * @type boolean
       * @default false
       */
      inDashlet : false,

      /**
       * Store the pdf.js url for use with PDFJS.workerSrc (4.2 Specific).
       *
       * @property workerSrc
       * @type string
       * @default empty string
       */
      workerSrc : "",

      /**
       * Tests if the plugin can be used in the users browser.
       * 
       * @method report
       * @return {String} Returns nothing if the plugin may be used, otherwise
       *         returns a message containing the reason it cant be used as a
       *         string.
       * @public
       */
      report : function PdfJs_report()
      {
         var canvassupport = false, skipbrowsertest = (this.attributes.skipbrowsertest && this.attributes.skipbrowsertest === "true") ? true : false;

         if (skipbrowsertest === false)
         {
            // Test if canvas is supported
            if (window.HTMLCanvasElement)
            {
               canvassupport = true;
               // Do some engine test as well, some support canvas but not the
               // rest for full html5
               if (YAHOO.env.ua.webkit > 0 && YAHOO.env.ua.webkit < 534)
               {
                  // http://en.wikipedia.org/wiki/Google_Chrome
                  // Guessing for the same for safari
                  canvassupport = false;
               }
               // It actually works with ie9, but lack fo support for typed
               // arrays makes performance terrible.
               if (YAHOO.env.ua.ie > 0 && YAHOO.env.ua.ie < 10)
               {
                  canvassupport = false;
               }
               if (YAHOO.env.ua.gecko > 0 && YAHOO.env.ua.gecko < 5)
               {
                  // http://en.wikipedia.org/wiki/Gecko_(layout_engine)
                  canvassupport = false;
               }
            }

         }
         else
         {
            canvassupport = true;
         }

         // If neither is supported, then report this, and bail out as viewer
         if (canvassupport === false && skipbrowsertest === false)
         {
            return this.wp.msg("label.browserReport", "&lt;canvas&gt; element");
         }

      },

      /**
       * Display the node.
       * 
       * @method display
       * @public
       */
      display : function PdfJs_display()
      {
         this.inWikiPage = Dom.getAncestorByClassName(this.wp.getPreviewerElement(), "wiki-page") != null;
         this.inDashlet = Dom.getAncestorByClassName(this.wp.getPreviewerElement(), "body") != null;

         Alfresco.util.YUILoaderHelper.require([ "tabview" ], this.onComponentsLoaded, this);
         Alfresco.util.YUILoaderHelper.loadComponents();
         
         // Remove the annoying 'Setting up Previewer' message
         this.wp.getPreviewerElement().innerHTML = "";

          // Return null means WebPreview instance will not overwrite the innerHTML of the preview area
         return null;
      },

      /**
       * Required YUI components have been loaded
       * 
       * @method onComponentsLoaded
       * @public
       */
      onComponentsLoaded : function PdfJs_onComponentsLoaded()
      {
         this.workerSrc = Alfresco.constants.URL_CONTEXT + 'res/extras/components/preview/pdfjs/pdf.worker' +  (Alfresco.constants.DEBUG ? '.js' : '-min.js');
         // Find the name of pdf.js resource file (4.2 specific)
         var scriptElements = document.getElementsByTagName('script');
         for(i = 0, il = scriptElements.length; i < il; i++)
         {
            if(scriptElements[i].src.indexOf('extras/components/preview/pdfjs/pdf.worker_') > -1)
            {
               this.workerSrc =  scriptElements[i].src;
               break;
            }
         }

         if (!this.inWikiPage && !this.inDashlet)
         {
            this._loadDocumentConfig();
         }

         // Set page number
         var urlParams = Alfresco.util.getQueryStringParameters(window.location.hash.replace("#", ""));
         this.pageNum = urlParams.page || (this.documentConfig.pageNum ? parseInt(this.documentConfig.pageNum) : this.pageNum);

         // Viewer HTML is contained in an external web script, which we load via XHR, then onViewerLoad() does the rest
         Alfresco.util.Ajax.request({
            url: Alfresco.constants.URL_SERVICECONTEXT + 'extras/components/preview/pdfjs?htmlid=' + encodeURIComponent(this.wp.id),
            successCallback : {
               fn : this.onViewerLoaded,
               scope : this
            },
            failureMessage : this.wp.msg("error.viewerload")
         });

         if (!this.inWikiPage)
         {
            // Window resize behaviour
            Event.addListener(window, "resize", this.onRecalculatePreviewLayout, this, true);

            // Hash change behaviour
            Event.addListener(window, "hashchange", this.onWindowHashChange, this, true);

            // Window unload behaviour
            Event.addListener(window, "beforeunload", this.onWindowUnload, this, true);
         }
      },

      /**
       * Handler for successful load of the viewer markup webscript
       * 
       * @method onViewerLoaded
       * @public
       */
      onViewerLoaded : function PdfJs_onViewerLoaded(p_obj)
      {
         this.wp.getPreviewerElement().innerHTML = p_obj.serverResponse.responseText;

         // Cache references to commonly-used elements
         this.controls = Dom.get(this.wp.id + "-controls");
         this.pageNumber = Dom.get(this.wp.id + "-pageNumber");
         this.sidebar = Dom.get(this.wp.id + "-sidebar");
         this.viewer = Dom.get(this.wp.id + "-viewer");

         // Set up viewer
         if (this.attributes.pageLayout == "multi")
         {
            Dom.addClass(this.viewer, "multiPage");
         }

         // Set up toolbar
         this.widgets.sidebarButton = Alfresco.util.createYUIButton(this, "sidebarBtn", this.onSidebarToggle, {
            type: "checkbox",
            disabled: true
         });
         this.widgets.nextButton = Alfresco.util.createYUIButton(this, "next", this.onPageNext, {
            disabled: true
         });
         this.widgets.previousButton = Alfresco.util.createYUIButton(this, "previous", this.onPagePrevious, {
            disabled: true
         });
         Event.addListener(this.wp.id + "-pageNumber", "change", this.onPageChange, this, true);
         this.widgets.zoomOutButton = Alfresco.util.createYUIButton(this, "zoomOut", this.onZoomOut, {
            disabled: true
         });
         this.widgets.zoomInButton = Alfresco.util.createYUIButton(this, "zoomIn", this.onZoomIn, {
            disabled: true
         });
         this.widgets.scaleMenu = new YAHOO.widget.Button(this.id + "-scaleSelectBtn", {
            type : "menu",
            menu : this.id + "-scaleSelect",
            disabled: true
         });
         this.widgets.scaleMenu.getMenu().subscribe("click", this.onZoomChange, null, this);
         var downloadMenu = [
            { text: this.wp.msg("link.download"), value: "", onclick: { fn: this.onDownloadClick, scope: this } },
         ];
         if (this.attributes.src)
         {
            downloadMenu.push({ text: this.wp.msg("link.downloadPdf"), value: "", onclick: { fn: this.onDownloadPDFClick, scope: this } });
         }
         this.widgets.downloadButton = new YAHOO.widget.Button(this.id + "-download", {
            type : "menu",
            menu : downloadMenu
         });
         this.widgets.maximize = Alfresco.util.createYUIButton(this, "fullpage", this.onMaximizeClick, {
            title: this.wp.msg("button.maximize.tip", 
                  YAHOO.env.ua.os == "macintosh" ? this.wp.msg("key.meta") : this.wp.msg("key.ctrl"))
         });
         this.widgets.linkBn = Alfresco.util.createYUIButton(this, "link", this.onLinkClick, {
            type: "checkbox"
         });

         // Set up search toolbar
         Event.addListener(this.wp.id + "-findInput", "change", this.onFindChange, this, true);
         var _this = this;
         Event.addListener(this.wp.id + "-findInput", "keypress", function(e)
         {
            if (e.keyCode == 13)
            {
               Event.stopEvent(e);
               _this.onFindChange("find");
            }
         });
         this.widgets.previousSearchButton = Alfresco.util.createYUIButton(this, "findPrevious", this.onFindChange);
         this.widgets.nextSearchButton = Alfresco.util.createYUIButton(this, "findNext", this.onFindChange);
         this.widgets.searchHighlight = Alfresco.util.createYUIButton(this, "findHighlightAll",
               this.onFindChangeHighlight, {
                  type : "checkbox"
               });
         this.widgets.searchMatchCase = Alfresco.util.createYUIButton(this, "findMatchCase",
               this.onFindChangeMatchCase, {
                  type : "checkbox"
               });
         this.widgets.searchBarToggle = Alfresco.util.createYUIButton(this, "searchBarToggle", this.onToggleSearchBar,
         {
            type : "checkbox",
            disabled: true,
            title: this.wp.msg("button.search.tip", 
                  YAHOO.env.ua.os == "macintosh" ? this.wp.msg("key.meta") : this.wp.msg("key.ctrl"))
         });
         
         // Enable sidebar, scale drop-down and search button when PDF is loaded
         // Other buttons are enabled by custom functions
         this.onPdfLoaded.subscribe(function onPdfLoadEnableButtons(p_type, p_args) {
            this.widgets.sidebarButton.set("disabled", false);
            this.widgets.scaleMenu.set("disabled", false);
            this.widgets.searchBarToggle.set("disabled", false);
         }, this, true);

         // Set height of the container and the viewer area
         this._setPreviewerElementHeight();
         this._setViewerHeight();

         // Create new instance of PFFFinderController. Needs to be created
         // early to be available at all places.
         this.pdfFindController = new PDFFindController();

         // Load the PDF itself
         this._loadPdf();

         // Keyboard shortcuts
         if (!this.inWikiPage && !this.inDashlet)
         {
            var findShortcutHandler = function findShortcutHandler(type, args) {
               var e = args[1];
               if ((e.ctrlKey || e.metaKey) && this.widgets.searchBarToggle)
               {
                  Event.stopEvent(e);
                  e.newValue = (!this.widgets.searchDialog || !this.widgets.searchDialog.cfg.getProperty("visible"));
                  this.widgets.searchBarToggle.set("checked", !this.widgets.searchBarToggle.get("checked"));
               }
            }
            var fullscreenShortcutHandler = function fullscreenShortcutHandler(type, args) {
               var e = args[1];
               if (e.ctrlKey || e.metaKey)
               {
                  Event.stopEvent(e);
                  this.onFullScreen(e);
               }
            }
            
            new YAHOO.util.KeyListener(document, { keys: 37 }, { // left arrow
               fn : this.onPagePrevious,
               scope : this,
               correctScope : true
            }).enable();
            new YAHOO.util.KeyListener(document, { keys: 39 }, { // right arrow
               fn : this.onPageNext,
               scope : this,
               correctScope : true
            }).enable();
            new YAHOO.util.KeyListener(document, { keys: 70, ctrl: true }, { // Ctrl+F
               fn : findShortcutHandler,
               scope : this,
               correctScope : true
            }).enable();
            new YAHOO.util.KeyListener(document, { keys: 13, ctrl: true }, { // Ctrl+Enter
               fn : fullscreenShortcutHandler,
               scope : this,
               correctScope : true
            }).enable();
            
            if (YAHOO.env.ua.os == "macintosh")
            {
               new YAHOO.util.KeyListener(document, { keys: 13 }, { // Cmd+Enter
                  fn : fullscreenShortcutHandler,
                  scope : this,
                  correctScope : true
               }).enable();
               new YAHOO.util.KeyListener(document, { keys: 70 }, { // Cmd+F
                  fn : findShortcutHandler,
                  scope : this,
                  correctScope : true
               }).enable();
            }
            
            Event.addListener(window, "fullscreenchange", this.onFullScreenChange, this, true);
            Event.addListener(window, "mozfullscreenchange", this.onFullScreenChange, this, true);
            Event.addListener(window, "webkitfullscreenchange", this.onFullScreenChange, this, true);
         }
         new YAHOO.util.KeyListener(document, { keys: 27 }, { // escape
            fn: function (e) {
               if (this.maximized)
               {
                  this.onMaximizeClick();
               }
            },
            scope : this,
            correctScope : true
         }).enable();

      },

      /**
       * Set the height of the preview element
       * 
       * @method _setPreviewerElementHeight
       * @private
       */
      _setPreviewerElementHeight : function PdfJs_setPreviewerElementHeight()
      {
         // Is the viewer maximized?
         if (!this.maximized)
         {
            if (this.inDashlet)
            {
               Dom.setStyle(this.wp.getPreviewerElement(), "height", "100%");
            }
            else if (this.inWikiPage)
            {
               Dom.setStyle(this.wp.getPreviewerElement(), "height", null);
            }
            else
            {
               var previewHeight = this.wp.setupPreviewSize({
                  commentsList: true,
                  commentContent: false,
                  siteNavigation: true,
                  nodeHeader: true
               });
               Dom.setStyle(this.wp.getPreviewerElement(), "height", (previewHeight - 10).toString() + "px");
            }
         }
         else if (this.fullscreen)
         {
            // Do nothing
         }
         else
         {
            Dom.setStyle(this.wp.getPreviewerElement(), "height", (window.innerHeight || Dom.getViewportHeight()).toString() + "px");
         }
      },

      /**
       * Set the height of the viewer area where content is displayed, so that it occupies the height of the parent previewer element
       * minus the menu bar.
       * 
       * @method _setViewerHeight
       * @private
       */
      _setViewerHeight : function PdfJs_setViewerHeight()
      {
         var previewRegion = Dom.getRegion(this.viewer.parentNode), 
            controlRegion = Dom.getRegion(this.controls),
            controlHeight = !this.fullscreen ? controlRegion.height : 0,
            newHeight = previewRegion.height - controlHeight -1; // Allow for bottom border
         
         if (newHeight === 0)
         {
            // Some browser get viewer.parentNode wrong (same as this.controls),
            // Probably due to timing isseu, new height from style hasn't
            // rendered yet.
            // use the default to get height.
            if (!this.maximized)
            {
               var previewSize = this.wp.setupPreviewSize({
                  commentsList: true,
                  commentContent: false,
                  siteNavigation: true,
                  nodeHeader: true
               });
               newHeight = previewSize - 
                  10 - controlHeight -1; // Allow for bottom border of 1px
            }
            else
            {
               newHeight = Dom.getViewportHeight() - controlHeight - 1;
            }
         }
         
         if (!this.fullscreen)
         {
            if (Alfresco.logger.isDebugEnabled())
            {
               Alfresco.logger.debug("Setting viewer height to " + newHeight + "px (toolbar " + controlHeight + "px, container " + previewRegion.height + "px");
            }
            Dom.setStyle(this.viewer, "height", newHeight.toString() + "px");
            Dom.setStyle(this.sidebar, "height", newHeight.toString() + "px");
         }
         else
         {
            if (Alfresco.logger.isDebugEnabled())
            {
               Alfresco.logger.debug("Setting viewer height to 100% (full-screen)");
            }
            Dom.setStyle(this.viewer, "height", "100%");
         }
      },

      /**
       * Fetch the PDF content and display it
       * 
       * @method _loadPdf
       * @private
       */
      _loadPdf : function PdfJs__loadPdf(params)
      {
         // Workaround for ALF-17458
         this.wp.options.name = this.wp.options.name.replace(/[^\w_\-\. ]/g, "");
         
         var me = this, fileurl = this.attributes.src ? this.wp.getThumbnailUrl(this.attributes.src) : this.wp
               .getContentUrl();
         
         // Add the full protocol + host as pdf.js require this
         if (fileurl.substr(0, 4).toLowerCase() !== 'http')
         {
            fileurl = window.location.protocol + '//' + window.location.host + fileurl;
         }

         params = params || {};
         params.url = fileurl;

         // Protect against Spinner not being loaded
         if (typeof window.Spinner === "function")
         {
            // Add the loading spinner to the viewer area
            this.spinner = new Spinner({
               lines: 13, // The number of lines to draw
               length: 7, // The length of each line
               width: 4, // The line thickness
               radius: 10, // The radius of the inner circle
               corners: 1, // Corner roundness (0..1)
               rotate: 0, // The rotation offset
               color: '#fff', // #rgb or #rrggbb
               speed: 1, // Rounds per second
               trail: 60, // Afterglow percentage
               shadow: false, // Whether to render a shadow
               hwaccel: false, // Whether to use hardware acceleration
               className: 'spinner', // The CSS class to assign to the spinner
               zIndex: 2e9, // The z-index (defaults to 2000000000)
               top: 'auto', // Top position relative to parent in px
               left: 'auto' // Left position relative to parent in px
            }).spin(this.viewer);
            
            this.onPdfLoaded.subscribe(function onPdfLoadStopSpinner(p_type, p_args) {
               this.spinner.stop();
            }, this, true);
         }
         else
         {
            Alfresco.logger.error("spinner.js is not loaded!");
         }

         // Set the worker source
         PDFJS.workerSrc = this.workerSrc;

         // PDFJS Disable new range feature if not loading from first page
         PDFJS.disableRange = true;
         // disable autofetch - retrieve just the ranges needed to display
         PDFJS.disableAutoFetch = false;

         if (Alfresco.logger.isDebugEnabled())
         {
            Alfresco.logger.debug("Loading PDF file from " + fileurl);
         }

         PDFJS.getDocument(params).then
         (
            Alfresco.util.bind(this._onGetDocumentSuccess, this),
            Alfresco.util.bind(this._onGetDocumentFailure, this),
            Alfresco.util.bind(this._onGetDocumentProgress, this)
         );
      },
      
      /**
       * PDF document retieved successfully
       * 
       * @function _onGetDocumentSuccess
       * @private
       */
      _onGetDocumentSuccess: function PdfJs__onGetDocumentSuccess(pdf)
      {
         this.pdfDoc = pdf;
         this.numPages = this.pdfDoc.numPages;
         if (Alfresco.logger.isDebugEnabled())
         {
            Alfresco.logger.debug("Rendering PDF with fingerprint " + pdf.fingerprint + " for " + this.wp.options.name);
         }
         this._renderPdf();
         this._updatePageControls();
         this.onPdfLoaded.fire(pdf);
      },

      /**
       * Error encountered retrieving PDF document
       * 
       * @function _onGetDocumentFailure
       * @private
       */
      _onGetDocumentFailure: function PdfJs__onGetDocumentFailure(message, exception)
      {
         if (this.spinner)
         {
            this.spinner.stop();
         }
         if (exception && exception.name === 'PasswordException') {
            var textMsgId = 'prompt.password.text';
            if (exception.code === 'incorrectpassword') {
               textMsgId = 'error.incorrectpassword';
            }
            if (exception.code === 'needpassword' || exception.code === 'incorrectpassword') {
               var me = this, id = Alfresco.util.generateDomId(),
                  submitPassword = Alfresco.util.bind(function(password) {
                     if (password && password.length > 0)
                     {
                        this._loadPdf({
                           password: password
                        });
                     }
                  }, this),
                  prompt = Alfresco.util.PopupManager.getUserInput({
                     title: this.wp.msg('prompt.password.title'),
                     html: '<label for="' + id + '">' + $html(this.wp.msg(textMsgId)) + '</label><br/><br/><input id="' + id + '" tabindex="0" type="password" value=""/>',
                     buttons: [
                         {
                            text: Alfresco.util.message("button.ok", this.name),
                            handler: function PdfJs__onGetDocumentFailure_okClick() {
                               // Grab the input, destroy the pop-up, then callback with the value
                               submitPassword(Dom.get(id).value);
                               this.destroy();
                            },
                            isDefault: true
                         },
                         {
                            text: Alfresco.util.message("button.cancel", this.name),
                            handler: function PdfJs__onGetDocumentFailure_cancelClick() {
                               this.destroy();
                            }
                         }
                      ]
                  }),
                  okButton = prompt.getButtons()[0];
               // Enable OK button when value typed
               YAHOO.util.Event.addListener(id, "keyup", function(event, okButton) {
                  if (okButton != null)
                  {
                     okButton.set("disabled", YAHOO.lang.trim(this.value || this.text || "").length == 0);
                  }
               }, okButton);
               // Enter key listener
               new YAHOO.util.KeyListener(id, {
                  keys: [ YAHOO.util.KeyListener.KEY.ENTER ]
               }, function onPasswordEnter(e) {
                  submitPassword(Dom.get(id).value);
                  prompt.destroy();
               }).enable();
               // Focus the input element
               if (Dom.get(id))
               {
                  Dom.get(id).focus();
               }
               return;
            }
         }
         var loadingErrorMessage = this.wp.msg('error.pdfload');
         if (exception && exception.name === 'InvalidPDFException') {
            // change error message also for other builds
            loadingErrorMessage = this.wp.msg('error.invalidpdf');
         }
         Alfresco.util.PopupManager.displayMessage({
            text: loadingErrorMessage
         });
         Alfresco.logger.error("Could not load PDF due to error " + exception.name + " (code " + exception.code + "): " + message);
      },

      /**
       * Notifications of progress receiving the PDF document. Not currently used.
       * 
       * @function _onGetDocumentProgress
       * @private
       */
      _onGetDocumentProgress: function PdfJs__onGetDocumentProgress(progressData)
      {
         // Do nothing
         //this.progress(progressData.loaded / progressData.total);
      },

      /**
       * Display the PDF content in the container
       * 
       * @method _renderPdf
       * @private
       */
      _renderPdf : function PdfJs__renderPdf()
      {
         var pagePromises = [], pagesRefMap = {}, pagesCount = this.numPages;
         for ( var i = 1; i <= pagesCount; i++)
         {
            pagePromises.push(this.pdfDoc.getPage(i));
         }
         var pagesPromise = PDFJS.Promise.all(pagePromises);

         var destinationsPromise = this.pdfDoc.getDestinations();

         var renderPageContainer = Alfresco.util.bind(function(promisedPages)
         {
            var self = this;
            this.documentView = new DocumentView(this.id + "-viewer", {
               name: "documentView",
               pageLayout : this.attributes.pageLayout,
               currentScale : K_UNKNOWN_SCALE,
               defaultScale : this.documentConfig.scale ? this.documentConfig.scale : this.attributes.defaultScale,
               disableTextLayer : this.attributes.disableTextLayer == "true",
               autoMinScale : parseFloat(this.attributes.autoMinScale),
               autoMaxScale : parseFloat(this.attributes.autoMaxScale),
               pdfJsPlugin : self
            });
            this.documentView.onScrollChange.subscribe(function onDocumentViewScroll() {
               var newPn = this.documentView.getScrolledPageNumber();
               if (this.pageNum != newPn)
               {
                  this.pageNum = newPn;
                  this._updatePageControls();
               }
            }, this, true);
            
            // Defer rendering
            this.thumbnailView = null

            this.pages = promisedPages;
            this.documentView.addPages(promisedPages);
            // this.thumbnailView.addPages(promisedPages);

            for ( var i = 0; i < promisedPages.length; i++)
            {
               var page = promisedPages[i], pageRef = page.ref;
               pagesRefMap[pageRef.num + ' ' + pageRef.gen + ' R'] = i;
            }

            this.documentView.render();
            // Scroll to the current page, this will force the visible content to render
            this.documentView.scrollTo(this.pageNum);

            // Enable the sidebar
            if (this.documentConfig.sidebarEnabled)
            {
               // WA Disabled for now since rendering the same page in two places at once causes the second render to never complete
               //this.widgets.sidebarButton.set("checked", true);
            }

            // Update toolbar
            this._updateZoomControls();
            Dom.get(this.wp.id + "-numPages").textContent = this.numPages;
            Dom.setAttribute(this.wp.id + "-pageNumber", "max", this.numPages);
            Dom.setAttribute(this.wp.id + "-pageNumber", "disabled", this.numPages > 1 ? null : "disabled");
            Dom.get(this.wp.id + "-pageNumber").removeAttribute("disabled");
            
            // If the user clicked through to the document details from the search page, open
            // the search dialog and perform a search for that term
            
            if (this.attributes.autoSearch && document.referrer && document.referrer.indexOf("/search?") > 0)
            {
               var st = Alfresco.util.getQueryStringParameter("t", document.referrer);
               if (st)
               {
                  this.widgets.searchBarToggle.set("checked", true); // Toggle the search box on
                  Dom.get(this.wp.id + "-findInput").value = st;
                  this.onFindChange("find");
               }
            }

         }, this);

         var setDestinations = Alfresco.util.bind(function (destinations) {
            this.destinations = destinations;
         }, this);

         var getOutline = Alfresco.util.bind(function (outline) {
            this._addOutline(outline);
         }, this);
         var setupOutline = Alfresco.util.bind(function () {
            this.pdfDoc.getOutline().then(getOutline);
         }, this);

         pagesPromise.then(renderPageContainer);

         this.pagesRefMap = pagesRefMap;

         destinationsPromise.then(setDestinations);

         // outline view depends on destinations and pagesRefMap
         PDFJS.Promise.all([ pagesPromise, destinationsPromise ]).then(setupOutline);

      },

      /**
       * Update the paging controls shown in the toolbar
       * 
       * @method _updatePageControls
       * @private
       */
      _updatePageControls : function PdfJs__updatePageControls()
      {
         // Update current page number
         this.pageNumber.value = this.pageNum;
         // Update toolbar controls
         this.widgets.nextButton.set("disabled", this.pageNum >= this.pdfDoc.numPages);
         this.widgets.previousButton.set("disabled", this.pageNum <= 1);
      },

      /**
       * Update the zoom controls shown in the toolbar
       * 
       * @method _updateZoomControls
       * @private
       */
      _updateZoomControls : function PdfJs__updateZoomControls(n)
      {
         // Update zoom controls
         var scale = this.documentView.currentScale;
         this.widgets.zoomInButton.set("disabled", scale * this.attributes.scaleDelta > K_MAX_SCALE);
         this.widgets.zoomOutButton.set("disabled", scale / this.attributes.scaleDelta < K_MIN_SCALE);
         this.widgets.scaleMenu.set("label", "" + Math.round(scale * 100) + "%");
      },

      /**
       * Scroll the displayed document to the specified page
       * 
       * @method _scrollToPage
       * @param n {int} Number of the page to scroll to, must be 1 or greater.
       * @private
       */
      _scrollToPage : function PdfJs__scrollToPage(n)
      {
         this.documentView.scrollTo(n);
         this.pageNum = n;

         // Update toolbar controls
         this._updatePageControls();

         // Update sidebar, if visible
         // TODO define an isRendered() method on the view object
         if (this.thumbnailView && this.thumbnailView.pages && this.thumbnailView.pages[0] && this.thumbnailView.pages[0].container)
         {
            this.thumbnailView.setActivePage(this.pageNum);
         }
      },

      /**
       * Use the specified document outline object to render a basic outline view in the sidebar
       * 
       * TODO Use an event to load this only when the docunent outline tab is first displayed
       * 
       * @method _addOutline
       * @param outline {object} Outline object as passed to us by pdf.js
       * @private
       */
      _addOutline : function PdfJs__addOutline(outline)
      {
         var pEl = Dom.get(this.id + "-outlineView");

         if (outline && outline.length > 0)
         {
            var queue = [{parent: pEl, items: outline}];
            while (queue.length > 0)
            {
               var levelData = queue.shift();
               var i, n = levelData.items.length;
               for (i = 0; i < n; i++)
               {
                  var item = levelData.items[i];
                  var div = document.createElement('div');
                  div.className = 'outlineItem';
                  var a = document.createElement('a');
                  Dom.setAttribute(a, "href", "#");
                  YAHOO.util.Event.addListener(a, "click", function(e, obj) {
                     YAHOO.util.Event.stopEvent(e);
                     this._navigateTo(obj);
                  }, item.dest, this);
                  a.textContent = item.title;
                  div.appendChild(a);

                  if (item.items.length > 0) {
                     var itemsDiv = document.createElement('div');
                     itemsDiv.className = 'outlineItems';
                     div.appendChild(itemsDiv);
                     queue.push({parent: itemsDiv, items: item.items});
                  }

                  levelData.parent.appendChild(div);
               }
            }
         }
         else
         {
            pEl.innerHTML = "<p>" + this.wp.msg("msg.noOutline") + "</p>";
         }
      },

      /**
       * Navigate the viewer to the specified document outline item
       * 
       * @method _navigateTo
       * @param dest {object} outline object item, from the document outline
       * @private
       */
      _navigateTo : function PdfJs__navigateTo(dest)
      {
         if (typeof dest === 'string')
            dest = this.destinations[dest];
         if (!(dest instanceof Array))
            return; // invalid destination
         // dest array looks like that: <page-ref> </XYZ|FitXXX> <args..>
         var destRef = dest[0];
        var pageNumber = destRef instanceof Object ?
          this.pagesRefMap[destRef.num + ' ' + destRef.gen + ' R'] : (destRef + 1);
         if (pageNumber > this.documentView.pages.length - 1)
            pageNumber = this.documentView.pages.length - 1;
         if (typeof pageNumber == "number")
         {
            this._scrollToPage(pageNumber + 1);
         }
      },

      /**
       * Load configuration for the current document
       * 
       * @method _loadDocumentConfig
       * @private
       */
      _loadDocumentConfig : function PdfJs__loadDocumentConfig()
      {
         if (this.attributes.useLocalStorage != "true" || !this._browserSupportsHtml5Storage())
         {
            this.documentConfig = {};
         }
         else
         {
            var base = "org.sharextras.media-viewers.pdfjs.document." + this.wp.options.nodeRef.replace(":/", "").replace("/", ".") + ".";
            this.documentConfig = {
               pageNum : window.localStorage[base + "pageNum"],
               scale : window.localStorage[base + "scale"],
               sidebarEnabled : ("true" == window.localStorage[base + "sidebar-enabled"])
            };
            if (this.documentConfig.scale == "null")
            {
               this.documentConfig.scale = null;
            }
         }
      },

      /**
       * Check if the web browser supports local storage
       * 
       * @property _browserSupportsHtml5Storage
       * @returns {boolean} true if local storage is available, false otherwise
       */
      _browserSupportsHtml5Storage : function PdfJs__browserSupportsHtml5Storage()
      {
         try
         {
            return 'localStorage' in window && window['localStorage'] !== null;
         }
         catch (e)
         {
            return false;
         }
      },

      /*
       * EVENT HANDLERS
       */

      /**
       * Toggle sidebar button click handler
       * 
       * @method onSidebarToggle
       */
      onSidebarToggle : function PdfJs_onSidebarToggle(e_obj)
      {
         var sbshown = Dom.getStyle(this.sidebar, "display") == "block";
         Dom.setStyle(this.sidebar, "display", sbshown ? "none" : "block");
         if (sbshown)
         {
            Dom.removeClass(this.viewer, "sideBarVisible");
          }
          else
         {
            Dom.addClass(this.viewer, "sideBarVisible");
            if (!this.thumbnailView)
            {
               this.thumbnailView = new DocumentView(this.id + "-thumbnailView", {
                  name: "thumbnailView",
                  pageLayout : "single",
                  defaultScale : "page-width",
                  disableTextLayer : true,
                  pdfJsPlugin : this
               });
               this.thumbnailView.addPages(this.pages);
            }
         }
         this.documentView.alignRows();
         // Render any pages that have appeared
         this.documentView.renderVisiblePages();

          var goToPage = function goToPage(e, obj) {
            YAHOO.util.Event.stopEvent(e);
            this._scrollToPage(obj.pn);
         };

         // Lazily instantiate the TabView
         this.widgets.tabview = this.widgets.tabview || new YAHOO.widget.TabView(this.id + "-sidebarTabView");

         // Set up the thumbnail view immediately
         if (this.thumbnailView && this.thumbnailView.pages.length > 0 && !this.thumbnailView.pages[0].container)
         {
            this.thumbnailView.render();
            for ( var i = 0; i < this.thumbnailView.pages.length; i++)
            {
                YAHOO.util.Event.addListener(this.thumbnailView.pages[i].container, "click", function(e, obj) {
                  this.thumbnailView.setActivePage(obj.pn);
                  this.documentView.scrollTo(obj.pn);
                }, {pn: i+1}, this);
            }
             // Scroll to the current page, this will force the visible content to render
            this.thumbnailView.scrollTo(this.pageNum);
            this.thumbnailView.setActivePage(this.pageNum);
         }
      },

      /**
       * Previous page button or key clicked
       * 
       * @method onPagePrevious
       */
      onPagePrevious : function PdfJs_onPagePrevious(e_obj)
      {
         if (this.pageNum <= 1)
            return;
         this.pageNum--;
         this._scrollToPage(this.pageNum);
      },

      /**
       * Next button or key clicked
       * 
       * @method onPageNext
       */
      onPageNext : function PdfJs_onPageNext(e_obj)
      {
         if (this.pageNum >= this.pdfDoc.numPages)
            return;
         this.pageNum++;
         this._scrollToPage(this.pageNum);
      },

      /**
       * Full screen key press
       * 
       * @method onFullScreen
       */
      onFullScreen : function PdfJs_onFullScreen(e_obj)
      {
         var el = this.viewer;
         if ((document.fullScreenElement && document.fullScreenElement !== null) ||    // alternative standard method
               (!document.mozFullScreenElement && !document.webkitFullScreenElement && !document.webkitFullscreenElement)) // current working methods
         {
            // Remove window resize behaviour
            Event.removeListener(window, "resize", this.onRecalculatePreviewLayout, this, true);
            
            if (el.requestFullScreen)
            {
               el.requestFullScreen();
            }
            else if (el.mozRequestFullScreen)
            {
               el.mozRequestFullScreen();
            }
            else if (el.webkitRequestFullScreen)
            {
               el.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
            }
         }
         else
         {
            if (document.cancelFullScreen)
            {
               document.cancelFullScreen();
            }
            else if (document.mozCancelFullScreen)
            {
               document.mozCancelFullScreen();
            }
            else if (document.webkitCancelFullScreen)
            {
               document.webkitCancelFullScreen();
            }
         }
      },
      
      /**
       * Full screen change event received
       * 
       * See https://developer.mozilla.org/en-US/docs/DOM/Using_fullscreen_mode
       * 
       * @method onFullScreenChange
       */
      onFullScreenChange: function PdfJs_onFullScreenChange(e_obj)
      {
         if ((document.fullScreenElement && document.fullScreenElement !== null) ||    // alternative standard method
               (!document.mozFullScreenElement && !document.webkitFullScreenElement && !document.webkitFullscreenElement)) // current working methods
         {
            Alfresco.logger.debug("Leaving full screen mode");
            this.fullscreen = false;
            this.documentView.fullscreen = false;
            
            this.documentView.setScale(this.oldScale);
            this.pageNum = this.oldPageNum;

            this._setViewerHeight();
            
            this.onResize.fire();
            
            // Now redefine the row margins
            this.documentView.alignRows();
            
            this._scrollToPage(this.pageNum);
            
            // Re-add window resize behaviour
            Event.addListener(window, "resize", this.onRecalculatePreviewLayout, this, true);
         }
         else
         {
            Alfresco.logger.debug("Entering full screen mode");
            this.documentView.fullscreen = true;
            this.fullscreen = true;
            
            // Remember the old scale and page numbers
            this.oldScale = this.documentView.currentScale;
            this.oldPageNum = this.pageNum;
            
            this._setViewerHeight();

            this.onResize.fire();
            
            // Now redefine the row margins
            this.documentView.alignRows();
            // Render any pages that have appeared
            this.documentView.setScale(this.documentView.parseScale("page-fit"));
            this._scrollToPage(this.pageNum);
         }
      },

      /**
       * Page number changed in text input field
       * 
       * @method onPageChange
       */
      onPageChange : function PdfJs_onPageChange(e_obj)
      {
         var pn = parseInt(e_obj.currentTarget.value);
         if (pn < 1 || pn > this.numPages)
         {
            Alfresco.util.PopupManager.displayMessage({
               text : this.wp.msg('error.badpage')
            });
            return false;
          }
          else
         {
            this.pageNum = pn;
            this._scrollToPage(this.pageNum);
         }
      },

      onToggleSearchBar : function PdfJs_onToggleSearchBar(e_obj)
      {
         if(!this.widgets.searchDialog)
         {
            this.widgets.searchDialog = new YAHOO.widget.SimpleDialog(this.id + '-searchDialog',
            {
               close : false,
               draggable : false,
               effect : null,
               modal : false,
               visible : false,
               width: "310px",
               context : [ this.viewer, "tr", "tr", [ "beforeShow", "windowResize" ], [-20, 3] ],
               underlay: "none"
            });
            this.widgets.searchDialog.render();
            
            new YAHOO.util.KeyListener(Dom.get(this.id + "-searchDialog"), { keys: 27 }, { // escape
               fn: function (type, args) {
                  if (this.widgets.searchBarToggle.get("checked"))
                  {
                     var e = args[1];
                     Event.stopEvent(e);
                     this.widgets.searchBarToggle.set("checked", false);
                  }
               },
               scope : this,
               correctScope : true
            }).enable();
         }
         
         if (e_obj.newValue === true)
         {
            this.widgets.searchDialog.show();
            this.widgets.searchDialog.bringToTop();
            //Set focus on input box
            var iel = Dom.get(this.wp.id + "-findInput");
            iel.focus();
            iel.select();
            
            if (!this.pdfFindController.documentView)
            {
               this.pdfFindController.initialize(this.documentView);
               // Extract text
               this.pdfFindController.extractText();
            }
         }
         else
         {
            this.widgets.searchDialog.hide();
            this.pdfFindController.active = false;
         }
      },

      onFindChangeMatchCase : function PdfJs_onFindChangeMatchCase(e_obj)
      {
         this.onFindChange("casesensitivitychange");
      },

      onFindChangeHighlight : function PdfJs_onFindChangeHighlight(e_obj)
      {
         this.onFindChange("highlightallchange");
      },

      /**
       * Text value changed in Find text input field
       * 
       * @method onFindChange
       */
      onFindChange : function PdfJs_onFindChange(e_obj)
      {
         var query = Dom.get(this.id + '-findInput').value
         if (!query)
            return;

         var event = document.createEvent('CustomEvent'), findPrevious = false, eventid = 'find', highlight = this.widgets.searchHighlight
               .get("checked"), caseSensitive = this.widgets.searchMatchCase.get("checked"), triggerevent;

         if (e_obj.currentTarget)
         {
            triggerevent = e_obj.currentTarget.id
         } else
         {
            triggerevent = e_obj;
         }

         switch (triggerevent)
         {
         case this.id + '-findNext':
            eventid += 'again';
            break;
         case this.id + '-findPrevious':
            eventid += 'again';
            findPrevious = true;
            break;
         case 'highlightallchange':
            eventid += 'highlightallchange';
            break;
         case 'casesensitivitychange':
            eventid += 'casesensitivitychange';
            break;
         default:
            if (query === this.lastSearchQuery)
            {
               eventid += 'again';
               break;
            }
            else
            {
               // Set inactive for find event, this will trigger a fresh search
               // this.pdfFindController.active = false;
               break;
            }
         }
         
         this.lastSearchQuery = query;

         // PDFFindController has its own event handling, so for now use that
         // instead of yahoo.bubbling
         event.initCustomEvent(eventid, true, true, {
            query : query,
            caseSensitive : caseSensitive,
            highlightAll : highlight,
            findPrevious : findPrevious
         });
         window.dispatchEvent(event);
      },

      /**
       * Zoom out button clicked
       * 
       * @method onZoomOut
       */
      onZoomOut : function PdfJs_onZoomOut(p_obj)
      {
         var newScale = Math.max(K_MIN_SCALE, this.documentView.currentScale / this.attributes.scaleDelta);
         this.documentView.setScale(this.documentView.parseScale(newScale));
         this._scrollToPage(this.pageNum);
         this._updateZoomControls();

      },

      /**
       * Zoom in button clicked
       * 
       * @method onZoomIn
       */
      onZoomIn : function PdfJs_onZoomIn(p_obj)
      {
         var newScale = Math.min(K_MAX_SCALE, this.documentView.currentScale * this.attributes.scaleDelta);
         this.documentView.setScale(this.documentView.parseScale(newScale));
         this._scrollToPage(this.pageNum);
         this._updateZoomControls();
      },

      /**
       * Zoom level changed via the zoom menu button
       * 
       * @method onZoomChange
       */
      onZoomChange : function PdfJs_onZoomChange(p_sType, p_aArgs)
      {
         var oEvent = p_aArgs[0], // DOM event
             oMenuItem = p_aArgs[1]; // MenuItem instance that was the target of the event

         var newScale = oMenuItem.value;
         this.documentView.setScale(this.documentView.parseScale(newScale));
         this._scrollToPage(this.pageNum);
         this._updateZoomControls();
      },

      /**
       * Download Original document menu link click handler
       * 
       * @method onDownloadClick
       */
      onDownloadClick : function PdfJs_onDownloadClick(p_obj)
      {
         window.location.href = this.wp.getContentUrl(true);
      },

      /**
       * Download PDF click handler (for thumbnailed content only)
       * 
       * @method onDownloadPDFClick
       */
      onDownloadPDFClick : function PdfJs_onDownloadPDFClick(p_obj)
      {
         window.location.href = this.wp.getThumbnailUrl(this.attributes.src) + "&a=true";
      },

      /**
       * Maximize/Minimize button clicked
       * 
       * @method onMaximizeClick
       */
      onMaximizeClick : function PdfJs_onMaximizeClick(p_obj)
      {
         this.maximized = !this.maximized;

         if (this.maximized)
         {
            Dom.addClass(this.wp.getPreviewerElement(), "fullPage");
            this.widgets.maximize.set("label", this.wp.msg("button.minimize"));
            this.widgets.maximize.set("title", this.wp.msg("button.minimize.tip"));
          }
          else
         {
            Dom.removeClass(this.wp.getPreviewerElement(), "fullPage");
            this.widgets.maximize.set("label", this.wp.msg("button.maximize"));
            this.widgets.maximize.set("title", this.wp.msg("button.maximize.tip"));
         }

         this._setPreviewerElementHeight();
         this._setViewerHeight();
         this.onResize.fire();
         // Now redefine the row margins
         this.documentView.alignRows();
         // Render any pages that have appeared
         this.documentView.renderVisiblePages();
         if (this.thumbnailView)
         {
            this.thumbnailView.renderVisiblePages();
         }
         
         // Re-align the dialogs to the viewer
         if (this.widgets.searchDialog)
         {
            this.widgets.searchDialog.align("tr", "tr");
         }
         if (this.widgets.linkDialog)
         {
            this.widgets.linkDialog.align("tr", "tr");
         }
      },

      /**
       * Link button click handler
       * 
       * @method onLinkClick
       */
      onLinkClick : function PdfJs_onLinkClick(p_obj)
      {
          var dialogid = this.id + "-linkDialog",
             inputid = dialogid + "-input";

          var fnSelectLink = function PdfJs_onLinkClick_fnSelectLink() {
            var btnid = this.widgets.linkDialogBg.get('checkedButton').get('id');
             var link = window.location.href.replace(window.location.hash, "") + (btnid.indexOf("-doc") > 0 ? "" : "#page=" + this.pageNum);
            var iel = Dom.get(inputid);
            iel.value = link;
            iel.focus();
            iel.select();
         };

         if (!this.widgets.linkDialog)
         {
             var linkDialog = new YAHOO.widget.SimpleDialog(dialogid,
             {
               close : false,
               draggable : false,
               effect : null,
               modal : false,
               visible : false,
               context : [ this.viewer, "tr", "tr", [ "beforeShow", "windowResize" ], [-20, 3] ],
               width : "40em",
               underlay: "none"
            });
            var slideurl = window.location.href.replace(window.location.hash, "") + "#page=" + this.pageNum;
            linkDialog.render();

            new YAHOO.util.KeyListener(Dom.get(dialogid), { keys: 27 }, { // escape
               fn: function (type, args) {
                  if (this.widgets.linkBn.get("checked"))
                  {
                     var e = args[1];
                     Event.stopEvent(e);
                     this.widgets.linkBn.set("checked", false);
                  }
               },
               scope : this,
               correctScope : true
            }).enable();

            var linkDialogBg = new YAHOO.widget.ButtonGroup(dialogid + "-bg");
            for ( var i = 0; i < linkDialogBg.getCount(); i++)
            {
               linkDialogBg.getButton(i).addListener("click", fnSelectLink, null, this);
            }

            this.widgets.linkDialogBg = linkDialogBg;
            this.widgets.linkDialog = linkDialog;

             YAHOO.util.Event.addListener(inputid, "click", function() {
               this.focus();
               this.select();
            });
         }
         if (!this.widgets.linkDialog.cfg.getProperty("visible"))
         {
            this.widgets.linkDialog.show();
            this.widgets.linkDialog.bringToTop();
            fnSelectLink.call(this);
          }
          else
         {
            this.widgets.linkDialog.hide();
         }
      },

      /**
       * Handler for window resize event
       * 
       * @method onRecalculatePreviewLayout
       */
      onRecalculatePreviewLayout : function PdfJs_onRecalculatePreviewLayout(p_obj)
      {
         if (this.documentView)
         {
            Alfresco.logger.debug("onRecalculatePreviewLayout");
            this._setPreviewerElementHeight();
            this._setViewerHeight();
            this.onResize.fire();
            // Now redefine the row margins
            this.documentView.alignRows();
            // Render any pages that have appeared
            this.documentView.renderVisiblePages();
         }
         if (this.thumbnailView)
         {
            this.thumbnailView.renderVisiblePages();
         }
      },

      /**
       * Handler for window hashchange event
       * 
       * See http://caniuse.com/#search=hash
       * 
       * @method onWindowHashChange
       */
      onWindowHashChange : function PdfJs_onWindowHashChange(p_obj)
      {
         // Set page number
         var urlParams = Alfresco.util.getQueryStringParameters(window.location.hash.replace("#", ""));
         pn = urlParams.page;

         if (pn)
         {
            if (pn > this.pdfDoc.numPages || pn < 1)
            {
               Alfresco.util.PopupManager.displayPrompt({
                  text : this.wp.msg('error.badpage')
               });
             }
             else
            {
               this.pageNum = pn;
               this._scrollToPage(this.pageNum);
            }
         }
      },

      /**
        * Window unload event handler to save document configuration to local storage
       * 
       * @method onWindowUnload
       */
      onWindowUnload : function PdfJs_onWindowUnload()
      {
         if (this.attributes.useLocalStorage == "true" && this._browserSupportsHtml5Storage() && this.documentView)
         {
            var base = "org.sharextras.media-viewers.pdfjs.document." + this.wp.options.nodeRef.replace(":/", "").replace("/", ".") + ".";
            if (this.pageNum)
            {
               window.localStorage[base + "pageNum"] = this.pageNum;
            }
            if (this.documentView.lastScale)
            {
               window.localStorage[base + "scale"] = this.documentView.lastScale;
            }
            if (this.widgets.sidebarButton)
            {
               window.localStorage[base + "sidebar-enabled"] = this.widgets.sidebarButton.get("checked");
            }
         }
      }
   };

   /**
    * Page helper class
    */
   var DocumentPage = function(id, content, parent, config, pdfJsPlugin)
   {
      this.id = id;
      this.content = content;
      this.parent = parent;
      this.canvas = null;
      this.container = null;
      this.loadingIconDiv = null;
      this.textLayerDiv = null;
      this.config = config || {};
      this.textContent = null;
      this.textLayerDiv = null;
      this.pdfJsPlugin = pdfJsPlugin;
   }

   DocumentPage.prototype =
   {
      /**
       * Render a specific page in the container. This does not render the content of the page itself, just the container divs.
       * 
       * @method render
       */
      render : function DocumentPage_render()
      {
         var div = document.createElement('div');
         div.id = this.parent.id + '-pageContainer-' + this.id;
         Dom.addClass(div, "page");
         this.parent.viewer.appendChild(div);

         // Create the loading indicator div
         var loadingIconDiv = document.createElement('div');
         Dom.addClass(loadingIconDiv, 'loadingIcon');
         div.appendChild(loadingIconDiv);

         this.container = div;
         this.loadingIconDiv = loadingIconDiv;

         this._setPageSize();
      },
      
      /**
       * Get the region in the document taken by this page
       * 
       * @method getRegion
       * @returns {object} Object containing region dimensions as returned by YAHOO.util.Dom.getRegion()
       */
      getRegion : function DocumentPage_getRegion()
      {
         return Dom.getRegion(this.container);
      },

      /**
        * Get the vertical position of the pae relative to the top of the parent element. A negative number
        * means that the page is above the current scroll position, a positive number means it is below.
       * 
       * @method getVPos
       */
      getVPos : function DocumentPage_getVPos(page)
      {
          var vregion = this.parent.viewerRegion,
             pregion = this.getRegion();

         return pregion.top - vregion.top;
      },

      /**
       * Render page content
       * 
       * @method renderContent
       */
      renderContent : function DocumentPage_renderContent()
      {
         var region = Dom.getRegion(this.container),
             canvas = document.createElement('canvas');
         canvas.id = this.container.id.replace('-pageContainer-', '-canvas-');
         canvas.mozOpaque = true;
         this.container.appendChild(canvas);

         this.canvas = canvas;
         
         // Hide the canvas until we've finished drawing the content, so the loading spinner shows through
         Dom.setStyle(canvas, "visibility", "hidden");

         // Add text layer
         var textLayerDiv = null;
         if (!this.parent.config.disableTextLayer)
         {
            textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            this.container.appendChild(textLayerDiv);
         }
         this.textLayerDiv = textLayerDiv;
         this.textLayer = textLayerDiv ? new TextLayerBuilder(textLayerDiv, this.id - 1, this.pdfJsPlugin) : null;
         if (this.textLayer)
            this.textLayer.pdfFindController = this.pdfJsPlugin.pdfFindController;

          var content = this.content,
             view = content.view,
             ctx = canvas.getContext('2d');

         canvas.width = region.width;
         canvas.height = region.height;

         // Fill canvas with a white background
         ctx.save();
         ctx.fillStyle = 'rgb(255, 255, 255)';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         ctx.restore();
         
         // Removed to fix issue 112, since this no longer seems to appear in pdf.js's own viewer.js
         //ctx.translate(-view[0] * this.parent.currentScale, -view[1] * this.parent.currentScale);

         // Render the content itself
         var renderContext = {
            canvasContext : ctx,
            viewport : this.content.getViewport(this.parent.currentScale),
            textLayer : this.textLayer
         };
         
         var startTime = 0;
         
         if (Alfresco.logger.isDebugEnabled())
         {
            startTime = new Date().getTime();
         }
         
         var renderFn = Alfresco.util.bind(function renderPageFn() {

            // Hide the loading icon and make the canvas visible again
            if (this.loadingIconDiv)
            {
               Dom.setStyle(this.loadingIconDiv, "display", "none");
            }
            Dom.setStyle(this.canvas, "visibility", "visible");
            
            // Log time taken to draw the page
            if (Alfresco.logger.isDebugEnabled())
            {
               Alfresco.logger.debug("Rendered " + this.parent.name + " page " + this.id + " in " + (new Date().getTime() - startTime) + "ms");
            }
            
         }, this);
         
         var setTextFn = Alfresco.util.bind(function textContentResolved(textContent) {
            this.textLayer.setTextContent(textContent);
         }, this);
         
         content.render(renderContext).then(renderFn);
         
         if (this.textLayer)
         {
            this.getTextContent().then(setTextFn);
         }

      },

      /**
       * Set page container size
       * 
       * @method _setPageSize
       * @private
       */
      _setPageSize : function DocumentPage__setPageSize(page)
      {
         var pageContainer = this.container, content = this.content,
            viewPort = content.getViewport(this.parent.currentScale);
         Dom.setStyle(pageContainer, "height", "" + Math.floor(viewPort.height) + "px");
         Dom.setStyle(pageContainer, "width", "" + Math.floor(viewPort.width) + "px");
      },

      /**
       * Remove page canvas and reset dimensions
       * 
       * @method _reset
       * @private
       */
      reset : function DocumentPage_reset()
      {
         this._setPageSize();

         // Remove any existing page canvas
         if (this.canvas)
         {
            this.container.removeChild(this.canvas);
            delete this.canvas;
            this.canvas = null;
         }

         if (this.loadingIconDiv)
         {
            Dom.setStyle(this.loadingIconDiv, "display", "block");
         }
      },

      /**
       * Get the text content of the page. Used by find
       * 
       * @method getTextContent
       * @public
       */
      getTextContent : function DocumentPage_pageviewGetTextContent()
      {
         if (!this.textContent)
         {
            this.textContent = this.content.getTextContent();
         }
         return this.textContent;
      },

      /**
       * Scroll the page into view
       * 
       * @method scrollIntoView
       * 
       */
      scrollIntoView : function DocumentPage_scrollIntoView(el, spot)
      {

         var offsetY = 0;
         if (Alfresco.logger.isDebugEnabled())
         {
            Alfresco.logger.debug("Page Scroll");
         }

         if (el)
         {
            offsetY += el.offsetTop
            if (Alfresco.logger.isDebugEnabled())
            {
               Alfresco.logger.debug("Page Scroll offsetTop " + el.offsetTop);
            }
         }

         if (spot)
         {
            if (Alfresco.logger.isDebugEnabled())
            {
               Alfresco.logger.debug("Page Scroll spot " + spot.top);
            }
            offsetY += spot.top;
         }

         if (Alfresco.logger.isDebugEnabled())
         {
            Alfresco.logger.debug("Page Scroll " + offsetY);
         }

         this.parent.scrollTo(this.id, offsetY);
      }

   }

   /**
    * Document View utility class. Used for main view and thumbnail view.
    */
   var DocumentView = function(elId, config) {
      this.id = elId;
      this.config = config || {};
      this.pages = [];
      this.viewer = Dom.get(elId);
      this.viewerRegion = Dom.getRegion(this.viewer);
      this.currentScale = config.currentScale || K_UNKNOWN_SCALE;
      this.name = this.config.name || "";
      this.pdfJsPlugin = config.pdfJsPlugin;

      // Used for setupRenderLayoutTimer in TextLayerbuilder
      this.lastScroll = 0;
      var self = this;
      this.viewer.addEventListener('scroll', function()
      {
         self.lastScroll = Date.now();
      }, false);
      
      this.pdfJsPlugin.onResize.subscribe(this.onResize, this, true);
      
      Event.addListener(this.viewer, "scroll", function (e) {
         this.renderOnScrollZero++;
         YAHOO.lang.later(500, this, this.onScroll);
      }, this, true);
      
      /*
       * Custom events generated by this component
       */
      this.onScrollChange = new YAHOO.util.CustomEvent("scrollChange", this);
   }

   DocumentView.prototype = {
      /**
       * Currently active page
       * 
       * @property activePage
       */
      activePage : null,
      
      /**
       * Name of last scale to be auto-selected or selected by the user. This is the value which will be persisted when the
       * document is unloaded and used to set up the same view the next time it is loaded.
       */
      lastScale : null,

      /**
       * Counter for viewer scroll events - incremented on event, decremented some time later. Rendering will occur only when counter reaches zero.
       * 
       * @property renderOnScrollZero
       * @type int
       * @default 0
       */
      renderOnScrollZero : 0,

      /**
       * Add a single page from a PDF document to this view
       * 
       * @method addPage
       */
      addPage : function DocumentView_addPage(id, content)
      {
         var page = new DocumentPage(id, content, this, {}, this.pdfJsPlugin);
         this.pages.push(page);
      },

      /**
       * Add pages from a PDF document to this view
       * 
       * @method addPages
       */
      addPages : function DocumentView_addPages(pages)
      {
         for ( var i = 0; i < pages.length; i++)
         {
            var page = pages[i];
            this.addPage(i + 1, page);
         }
      },

      /**
       * Render page containers and set their sizes. This does not render the page content itself, neither canvas or text layers.
       * 
       * @method render
       */
      render : function DocumentView_render()
      {
         // Render each page (not canvas or text layers)
         for ( var i = 0; i < this.pages.length; i++)
         {
            if (Alfresco.logger.isDebugEnabled())
            {
               Alfresco.logger.debug("Rendering " + this.name + " page container " + (i+1));
            }
            this.pages[i].render();
         }

         // Set scale, if not already set
         if (this.currentScale === K_UNKNOWN_SCALE)
         {
            // Scale was not initialized: invalid bookmark or scale was not specified.
            // Setting the default one.
            this.setScale(this.parseScale(this.config.defaultScale));
         }
         else
         {
            this.alignRows();
         }
      },

      /**
       * Remove all existing canvas content
       * 
       * @method reset
       */
      reset : function DocumentView_reset()
      {
         // Remove all the existing canvas elements
         for ( var i = 0; i < this.pages.length; i++)
         {
            this.pages[i].reset();
         }

         // Now redefine the row margins
         this.alignRows();
      },

      /**
       * Centre the rows of pages horizontally  within their parent viewer element by adding the correct amount of left padding
       * 
       * @method alignRows
       */
      alignRows : function DocumentView_alignRows()
      {
         var rowPos = -1, rowWidth = 0, largestRow = 0;
         if (this.config.pageLayout == "multi")
         {
            Dom.setStyle(this.viewer, "padding-left", "0px");
            for ( var i = 0; i < this.pages.length; i++)
            {
               var page = this.pages[i], container = page.container, vpos = page.getVPos();
               // If multi-page mode is on, we need to add custom extra margin to the LHS of the 1st item in the row to make it centred
               if (vpos != rowPos)
               {
                  rowWidth = parseInt(Dom.getStyle(container, "margin-left")); // Rather than start from zero assume equal right padding on last row item
               }
               rowWidth += Dom.getRegion(container).width + parseInt(Dom.getStyle(container, "margin-left"));
               largestRow = Math.max(largestRow, rowWidth);
               rowPos = vpos;
            }
            Dom.setStyle(this.viewer, "padding-left", "" + Math.floor(((this.viewer.clientWidth - largestRow) / 2)) + "px");
         }
      },

      /**
       * Render pages in the visible area of the viewer (or near it) given the current scroll position
       * 
       * @method renderVisiblePages
       */
      renderVisiblePages : function DocumentView_renderVisiblePages()
      {
         // region may not be populated properly if the div was hidden
         this.viewerRegion = Dom.getRegion(this.viewer);
         
         var vheight = this.viewerRegion.height, vtop = this.viewerRegion.top;
         
         if (Alfresco.logger.isDebugEnabled())
         {
            Alfresco.logger.debug("Render " + this.name + " visible pages: viewer height " + this.viewerRegion.height + "px");
         }

         // Render visible pages
         for ( var i = 0; i < this.pages.length; i++)
         {
            var page = this.pages[i], 
               pregion = page.getRegion(),
               top = pregion.top - vtop,
               bottom = top + pregion.height,
               vicinity = 0.6;
            
            // WA - improve algorith for selecting which pages to render, based on the following criteria
            // Page top is above the viewer top edge, bottom below the bottom edge OR
            // Bottom is within half the viewer height of the top edge OR
            // Top is within half the viewer height of the bottom edge
            if (page.container && !page.canvas && 
                  (top < 0 && 0 < bottom || vheight * -1 * vicinity < bottom && bottom < vheight || 0 < top && top < vheight * (vicinity + 1) ))
            {
               if (Alfresco.logger.isDebugEnabled())
               {
                  Alfresco.logger.debug("Rendering " + this.name + " page " + (i+1) + " content (page top:" + top + ", bottom:" + bottom + ")");
               }
               page.renderContent();
            }
         }
      },

      /**
       * Scroll the viewer to the given page number
       * 
       * @method scrollTo
       * @param n {int} Number of the page to scroll to, 1 or greater.
       */
      scrollTo : function DocumentView_scrollTo(n, offsetY)
      {
         var newPos = this.pages[n - 1].getVPos(),
            firstPos = this.pages[0].getVPos();

         if (Alfresco.logger.isDebugEnabled())
         {
            Alfresco.logger.debug("Scrolling " + this.name + " to page " + n + 
                  ". New page top is " + newPos + "px" + 
                  ". First page top is " + firstPos + "px");
         }

         var scrollTop = newPos - firstPos;
         if (offsetY)
         {
            scrollTop += offsetY
         }

         if (Alfresco.logger.isDebugEnabled())
         {
            Alfresco.logger.debug("Old scrollTop was " + this.viewer.scrollTop + "px");
            Alfresco.logger.debug("Set scrollTop to " + scrollTop + "px");
            Alfresco.logger.debug("scrollTop offsetY " + offsetY);
         }

         this.viewer.scrollTop = scrollTop;
         this.pageNum = n;

         // Render visible pages
         this.renderVisiblePages();
      },

      /**
       * Set the scale of the view and remove all previously-rendered document content
       * 
       * @method setScale
       * @param value {float} numerical scale value
       */
      setScale : function DocumentView_setScale(value)
      {
         if (value == this.currentScale)
         {
            return;
         }
         if (Alfresco.logger.isDebugEnabled())
         {
            Alfresco.logger.debug("Scale is now " + value);
         }
         this.currentScale = value;

         // Remove all the existing canvas elements
         this.reset();

         // Now redefine the row margins
         this.alignRows();
      },

      /**
       * Calculate page zoom level based on the supplied value. Recognises numerical values and special string constants, e.g. 'page-fit'.
       * Normally used in conjunction with setScale(), since this method does not set the current value.
       * 
       * @method parseScale
       * @private
       * @return {float} Numerical scale value
       */
      parseScale : function DocumentView_parseScale(value)
      {
         var scale = parseFloat(value);
         if (scale)
         {
            this.lastScale = value;
            return scale;
         }

         if (this.pages.length > 0)
         {
             var currentPage = this.pages[0],
                container = currentPage.container,
                hmargin = parseInt(Dom.getStyle(container, "margin-left")) + parseInt(Dom.getStyle(container, "margin-right")),
                vmargin = parseInt(Dom.getStyle(container, "margin-top")),
                contentWidth = parseInt(currentPage.content.pageInfo.view[2]),
                contentHeight = parseInt(currentPage.content.pageInfo.view[3]),
                clientWidth = this.fullscreen ? window.screen.width : this.viewer.clientWidth - 1, // allow an extra pixel in width otherwise 2-up view wraps
                clientHeight = this.fullscreen ? window.screen.height : this.viewer.clientHeight;
            
            Alfresco.logger.debug("Client height: " + this.viewer.clientHeight);

            if ('page-width' == value)
            {
               var pageWidthScale = (clientWidth - hmargin * 2) / contentWidth;
               scale = pageWidthScale;
             }
             else if ('two-page-width' == value)
            {
               var pageWidthScale = (clientWidth - hmargin * 3) / contentWidth;
               scale = pageWidthScale / 2;
             }
             else if ('page-height' == value)
            {
               var pageHeightScale = (clientHeight - vmargin * 2) / contentHeight;
               scale = pageHeightScale;
             }
             else if ('page-fit' == value)
            {
                var pageWidthScale = (clientWidth - hmargin*2) / contentWidth,
                   pageHeightScale = (clientHeight - vmargin*2) / contentHeight;
                scale = Math.min(pageWidthScale, pageHeightScale);
             }
             else if ('two-page-fit' == value)
            {
                var pageWidthScale = (clientWidth - hmargin*3) / contentWidth,
                   pageHeightScale = (clientHeight - vmargin*2) / contentHeight;
                scale = Math.min(pageWidthScale / 2, pageHeightScale);
             }
             else if ('auto' == value)
            {
                var tpf = this.parseScale("two-page-fit"),
                   opf = this.parseScale("page-fit"),
                   opw = this.parseScale("page-width"),
                   tpw = this.parseScale("two-page-width"),
                   minScale = this.config.autoMinScale,
                   maxScale = this.config.autoMaxScale;
               if (tpf > minScale && this.numPages > 1)
               {
                  scale = tpf;
                }
                else if (opf > minScale)
               {
                   scale = opf;
                }
                else if (tpw > minScale && this.numPages > 1)
               {
                   scale = tpw;
                }
                else if (opw > minScale)
               {
                   scale = opw;
                }
                else
               {
                   scale = minScale;
               }
               // Make sure that the page is not zoomed in *too* far. 
               // A limit of 125% max zoom is the default for the main view.
               if (maxScale)
               {
                  scale = Math.min(scale, maxScale);
               }
             }
             else
            {
               throw "Unrecognised zoom level '" + value + "'";
            }
          }
          else
         {
            throw "Unrecognised zoom level - no pages";
         }
         
         this.lastScale = value;
         return scale;
      },

      /**
       * Return the number of the page (1 or greater) that should be considered the 'current' page given the scroll position.
       * 
       * @method getScrolledPageNumber
       * @returns {int} Number of the current page, 1 or greater
       */
      getScrolledPageNumber : function DocumentView_getScrolledPageNumber()
      {
         // Calculate new page number
         for ( var i = 0; i < this.pages.length; i++)
         {
            var page = this.pages[i],
               vpos = page.getVPos();
            if (vpos + parseInt(page.container.style.height) / 2 > 0)
            {
               return i + 1;
            }
         }
         return this.pages.length;
      },

      /**
       * Set the currently-active page number
       * 
       * @method setActivePage
       */
      setActivePage : function DocumentView_setActivePage(n)
      {
         if (this.activePage)
         {
            Dom.removeClass(this.activePage.container, "activePage");
         }
         Dom.addClass(this.pages[n - 1].container, "activePage");
         this.activePage = this.pages[n - 1];
      },
      
      onResize: function onResize()
      {
         // TODO viewerRegion should be populated by an event?
         this.viewerRegion = Dom.getRegion(this.viewer);
      },

      /**
       * Event handler for scroll event within the view area
       * 
       * @method onScroll
       */
      onScroll : function PdfJs_onViewerScroll(e_obj)
      {
         this.renderOnScrollZero--;
         if (this.renderOnScrollZero == 0)
         {
            // Render visible pages
            this.renderVisiblePages();
            // Fire custom event
            this.onScrollChange.fire(this);
         }
      }
   }

   /**
    * Text layer builder, used to render text layer into pages. Copied from pdf.js viewer.
    */
   var TextLayerBuilder = function textLayerBuilder(textLayerDiv, pageIdx, pdfJsPlugin)
   {
      var textLayerFrag = document.createDocumentFragment();

      this.textLayerDiv = textLayerDiv;
      this.layoutDone = false;
      this.divContentDone = false;
      this.pageIdx = pageIdx;
      this.matches = [];
      this.pdfJsPlugin = pdfJsPlugin

      this.beginLayout = function textLayerBuilderBeginLayout()
      {
         this.textDivs = [];
         this.textLayerQueue = [];
         this.renderingDone = false;
      };

      this.endLayout = function textLayerBuilderEndLayout()
      {
         this.layoutDone = true;
         this.insertDivContent();
      };

      this.renderLayer = function textLayerBuilderRenderLayer()
      {
         var self = this;
         var textDivs = this.textDivs;
         var textLayerDiv = this.textLayerDiv;
         var canvas = document.createElement('canvas');
         var ctx = canvas.getContext('2d');

         if (Alfresco.logger.isDebugEnabled())
         {
            Alfresco.logger.debug("Render Text layer");
         }
         // No point in rendering so many divs as it'd make the browser unusable
         // even after the divs are rendered
         var MAX_TEXT_DIVS_TO_RENDER = 100000;
         if (textDivs.length > MAX_TEXT_DIVS_TO_RENDER)
         {
            return;
         }

         for ( var i = 0, ii = textDivs.length; i < ii; i++)
         {
            var textDiv = textDivs[i];
            textLayerFrag.appendChild(textDiv);

            ctx.font = textDiv.style.fontSize + ' ' + textDiv.style.fontFamily;
            var width = ctx.measureText(textDiv.textContent).width;

            if (width > 0)
            {
               var textScale = textDiv.dataset.canvasWidth / width;

               // Share extras changed to use Yahoo doom.
               // TODO: Work out some more efficient way of determining
               // prefix as original method do, instead of setting all.
               Dom.setStyle(textDiv, '-ms-transform', 'scale(' + textScale + ', 1)');
               Dom.setStyle(textDiv, '-webkit-transform', 'scale(' + textScale + ', 1)');
               Dom.setStyle(textDiv, '-moz-transform', 'scale(' + textScale + ', 1)');
               Dom.setStyle(textDiv, '-ms-transformOrigin', '0% 0%');
               Dom.setStyle(textDiv, '-webkit-transformOrigin', '0% 0%');
               Dom.setStyle(textDiv, '-moz-transformOrigin', '0% 0%');
               // CustomStyle.setProp('transform' , textDiv,
               // 'scale(' + textScale + ', 1)');
               // CustomStyle.setProp('transformOrigin' , textDiv, '0% 0%');

               textLayerDiv.appendChild(textDiv);
            }
         }

         this.renderingDone = true;
         this.updateMatches();

         textLayerDiv.appendChild(textLayerFrag);
      };

      this.setupRenderLayoutTimer = function textLayerSetupRenderLayoutTimer()
      {
         // Schedule renderLayout() if user has been scrolling, otherwise
         // run it right away
         var kRenderDelay = 300; // in ms
         var self = this;

         if (Date.now() - self.pdfJsPlugin.documentView.lastScroll > kRenderDelay)
         {
            // Render right away
            this.renderLayer();
         } else
         {
            // Schedule
            if (this.renderTimer)
               clearTimeout(this.renderTimer);
            this.renderTimer = setTimeout(function()
            {
               self.setupRenderLayoutTimer();
            }, kRenderDelay);
         }
      };

      this.appendText = function textLayerBuilderAppendText(geom)
      {
         var textDiv = document.createElement('div');

         // vScale and hScale already contain the scaling to pixel units
         var fontHeight = geom.fontSize * geom.vScale;
         textDiv.dataset.canvasWidth = geom.canvasWidth * geom.hScale;
         textDiv.dataset.fontName = geom.fontName;

         textDiv.style.fontSize = fontHeight + 'px';
         textDiv.style.fontFamily = geom.fontFamily;
         textDiv.style.left = geom.x + 'px';
         textDiv.style.top = (geom.y - fontHeight) + 'px';

         // The content of the div is set in the `setTextContent` function.

         this.textDivs.push(textDiv);
      };

      this.insertDivContent = function textLayerUpdateTextContent()
      {
         // Only set the content of the divs once layout has finished, the
         // content
         // for the divs is available and content is not yet set on the divs.
         if (!this.layoutDone || this.divContentDone || !this.textContent)
            return;

         this.divContentDone = true;

         var textDivs = this.textDivs;
         var bidiTexts = this.textContent.bidiTexts;

         for ( var i = 0; i < bidiTexts.length; i++)
         {
            var bidiText = bidiTexts[i];
            var textDiv = textDivs[i];

            textDiv.textContent = bidiText.str;
            textDiv.dir = bidiText.ltr ? 'ltr' : 'rtl';
         }

         this.setupRenderLayoutTimer();
      };

      this.setTextContent = function textLayerBuilderSetTextContent(textContent)
      {
         this.textContent = textContent;
         this.insertDivContent();
      };

      this.convertMatches = function textLayerBuilderConvertMatches(matches)
      {
         var i = 0;
         var iIndex = 0;
         var bidiTexts = this.textContent.bidiTexts;
         var end = bidiTexts.length - 1;
         var queryLen = this.pdfFindController.state.query.length;

         var lastDivIdx = -1;
         var pos;

         var ret = [];

         // Loop over all the matches.
         for ( var m = 0; m < matches.length; m++)
         {
            var matchIdx = matches[m];
            // # Calculate the begin position.

            // Loop over the divIdxs.
            while (i !== end && matchIdx >= (iIndex + bidiTexts[i].str.length))
            {
               iIndex += bidiTexts[i].str.length;
               i++;
            }

            // TODO: Do proper handling here if something goes wrong.
            if (i == bidiTexts.length)
            {
               console.error('Could not find matching mapping');
            }

            var match = {
               begin : {
                  divIdx : i,
                  offset : matchIdx - iIndex
               }
            };

            // # Calculate the end position.
            matchIdx += queryLen;

            // Somewhat same array as above, but use a > instead of >= to get
            // the end
            // position right.
            while (i !== end && matchIdx > (iIndex + bidiTexts[i].str.length))
            {
               iIndex += bidiTexts[i].str.length;
               i++;
            }

            match.end = {
               divIdx : i,
               offset : matchIdx - iIndex
            };
            ret.push(match);
         }

         return ret;
      };

      this.renderMatches = function textLayerBuilder_renderMatches(matches)
      {

         // Early exit if there is nothing to render.
         if (matches.length === 0)
         {
            return;
         }

         var bidiTexts = this.textContent.bidiTexts;
         var textDivs = this.textDivs;
         var prevEnd = null;
         var isSelectedPage = this.pageIdx === this.pdfFindController.selected.pageIdx;
         var selectedMatchIdx = this.pdfFindController.selected.matchIdx;
         var highlightAll = this.pdfFindController.state.highlightAll;

         var infty = {
            divIdx : -1,
            offset : undefined
         };

         function beginText(begin, className)
         {
            var divIdx = begin.divIdx;
            var div = textDivs[divIdx];
            div.innerHTML = '';

            var content = bidiTexts[divIdx].str.substring(0, begin.offset);
            var node = document.createTextNode(content);
            if (className)
            {
               var isSelected = isSelectedPage && divIdx === selectedMatchIdx;
               var span = document.createElement('span');
               span.className = className + (isSelected ? ' selected' : '');
               span.appendChild(node);
               div.appendChild(span);
               return;
            }
            div.appendChild(node);
         }

         function appendText(from, to, className)
         {
            var divIdx = from.divIdx;
            var div = textDivs[divIdx];

            var content = bidiTexts[divIdx].str.substring(from.offset, to.offset);
            var node = document.createTextNode(content);
            if (className)
            {
               var span = document.createElement('span');
               span.className = className;
               span.appendChild(node);
               div.appendChild(span);
               return;
            }
            div.appendChild(node);
         }

         function highlightDiv(divIdx, className)
         {
            textDivs[divIdx].className = className;
         }

         var i0 = selectedMatchIdx, i1 = i0 + 1, i;

         if (highlightAll)
         {
            i0 = 0;
            i1 = matches.length;
         } else if (!isSelectedPage)
         {
            // Not highlighting all and this isn't the selected page, so do
            // nothing.
            return;
         }

         for (i = i0; i < i1; i++)
         {
            var match = matches[i];
            var begin = match.begin;
            var end = match.end;

            var isSelected = isSelectedPage && i === selectedMatchIdx;
            var highlightSuffix = (isSelected ? ' selected' : '');
            if (isSelected)
            {
               this.pdfFindController.documentView.pages[this.pageIdx].scrollIntoView(textDivs[begin.divIdx], {
                  top : -50
               });
            }

            // Match inside new div.
            if (!prevEnd || begin.divIdx !== prevEnd.divIdx)
            {
               // If there was a previous div, then add the text at the end
               if (prevEnd !== null)
               {
                  appendText(prevEnd, infty);
               }
               // clears the divs and set the content until the begin point.
               beginText(begin);
            } else
            {
               appendText(prevEnd, begin);
            }

            if (begin.divIdx === end.divIdx)
            {
               appendText(begin, end, 'highlight' + highlightSuffix);
            } else
            {
               appendText(begin, infty, 'highlight begin' + highlightSuffix);
               for ( var n = begin.divIdx + 1; n < end.divIdx; n++)
               {
                  highlightDiv(n, 'highlight middle' + highlightSuffix);
               }
               beginText(end, 'highlight end' + highlightSuffix);
            }
            prevEnd = end;
         }

         if (prevEnd)
         {
            appendText(prevEnd, infty);
         }
      };

      this.updateMatches = function textLayerUpdateMatches()
      {

         // Only show matches, once all rendering is done.
         if (!this.renderingDone)
            return;

         // Clear out all matches.
         var matches = this.matches;
         var textDivs = this.textDivs;
         var bidiTexts = this.textContent.bidiTexts;
         var clearedUntilDivIdx = -1;

         // Clear out all current matches.
         for ( var i = 0; i < matches.length; i++)
         {
            var match = matches[i];
            var begin = Math.max(clearedUntilDivIdx, match.begin.divIdx);
            for ( var n = begin; n <= match.end.divIdx; n++)
            {
               var div = textDivs[n];
               div.textContent = bidiTexts[n].str;
               div.className = '';
            }
            clearedUntilDivIdx = match.end.divIdx + 1;
         }

         if (!this.pdfFindController.active)
            return;

         // Convert the matches on the page controller into the match format
         // used
         // for the textLayer.
         this.matches = matches = this.convertMatches(this.pdfFindController.pageMatches[this.pageIdx] || []);

         this.renderMatches(this.matches);
      };
   };

   /**
    * PDFFindController - copied from pdf.js project, file viewer.js Changes
    * includes PDFView -> self.documentView initialize() -> Added support for
    * passing the documentView object
    */

   var FindStates = {
      FIND_FOUND : 0,
      FIND_NOTFOUND : 1,
      FIND_WRAPPED : 2,
      FIND_PENDING : 3
   };

   var PDFFindController = function()
   {
   };

   PDFFindController.prototype = {
      extractTextPromise : null,

      // If active, find results will be highlighted.
      active : false,

      // Stores the text for each page.
      pageContents : [],

      pageMatches : [],

      selected : {
         pageIdx : 0,
         matchIdx : 0
      },

      state : null,

      dirtyMatch : false,

      findTimeout : null,

      // Share extras added to hold current documentView object
      documentView : null,

      initialize : function(documentView)
      {
         var events = [ 'find', 'findagain', 'findhighlightallchange', 'findcasesensitivitychange' ];

         // Share extras add
         this.documentView = documentView;

         this.handleEvent = this.handleEvent.bind(this);

         for ( var i = 0; i < events.length; i++)
         {
            window.addEventListener(events[i], this.handleEvent);
         }
      },

      calcFindMatch : function(pageContent)
      {
         var query = this.state.query;
         var caseSensitive = this.state.caseSensitive;
         var queryLen = query.length;

         if (queryLen === 0)
            return [];

         if (!caseSensitive)
         {
            pageContent = pageContent.toLowerCase();
            query = query.toLowerCase();
         }

         var matches = [];

         var matchIdx = -queryLen;
         while (true)
         {
            matchIdx = pageContent.indexOf(query, matchIdx + queryLen);
            if (matchIdx === -1)
            {
               break;
            }

            matches.push(matchIdx);
         }
         return matches;
      },

      extractText : function()
      {
         if (this.extractTextPromise)
         {
            return this.extractTextPromise;
         }
         this.extractTextPromise = new PDFJS.Promise();

         var self = this;
         function extractPageText(pageIndex)
         {
            self.documentView.pages[pageIndex].getTextContent().then(function textContentResolved(data)
            {
               // Build the find string.
               var bidiTexts = data.bidiTexts;
               var str = '';

               for ( var i = 0; i < bidiTexts.length; i++)
               {
                  str += bidiTexts[i].str;
               }

               // Store the pageContent as a string.
               self.pageContents.push(str);
               // Ensure there is a empty array of matches.
               self.pageMatches.push([]);

               if ((pageIndex + 1) < self.documentView.pages.length)
                  extractPageText(pageIndex + 1);
               else
                  self.extractTextPromise.resolve();
            });
         }
         extractPageText(0);
         return this.extractTextPromise;
      },

      handleEvent : function(e)
      {
         if (this.state === null || e.type !== 'findagain')
         {
            this.dirtyMatch = true;
         }
         this.state = e.detail;
         this.updateUIState(FindStates.FIND_PENDING);

         var promise = this.extractText();

         clearTimeout(this.findTimeout);
         if (e.type === 'find')
         {
            // Only trigger the find action after 250ms of silence.
            this.findTimeout = setTimeout(function()
            {
               promise.then(this.performFind.bind(this));
            }.bind(this), 250);
         } else
         {
            promise.then(this.performFind.bind(this));
         }
      },

      updatePage : function(idx)
      {
         var self = this;
         var page = self.documentView.pages[idx];

         if (this.selected.pageIdx === idx)
         {
            // If the page is selected, scroll the page into view, which
            // triggers
            // rendering the page, which adds the textLayer. Once the textLayer
            // is
            // build, it will scroll onto the selected match.
            // Share Extras changed: used to be pages.scrollIntoView()
            // self.documentView.scrollTo(idx+1);
            page.scrollIntoView();
         }

         if (page.textLayer)
         {
            page.textLayer.updateMatches();
         }
      },

      performFind : function()
      {
         // Recalculate all the matches.
         // TODO: Make one match show up as the current match

         var self = this;
         var pages = self.documentView.pages;
         var pageContents = this.pageContents;
         var pageMatches = this.pageMatches;

         this.active = true;

         if (this.dirtyMatch)
         {
            // Need to recalculate the matches.
            this.dirtyMatch = false;

            this.selected = {
               pageIdx : -1,
               matchIdx : -1
            };

            // TODO: Make this way more lasily (aka. efficient) - e.g. calculate
            // only
            // the matches for the current visible pages.
            var firstMatch = true;
            for ( var i = 0; i < pageContents.length; i++)
            {
               var matches = pageMatches[i] = this.calcFindMatch(pageContents[i]);
               if (firstMatch && matches.length !== 0)
               {
                  firstMatch = false;
                  this.selected = {
                     pageIdx : i,
                     matchIdx : 0
                  };
               }
               this.updatePage(i, true);
            }
            if (!firstMatch || !this.state.query)
            {
               this.updateUIState(FindStates.FIND_FOUND);
            } else
            {
               this.updateUIState(FindStates.FIND_NOTFOUND);
            }
         } else
         {
            // If there is NO selection, then there is no match at all -> no
            // sense to
            // handle previous/next action.
            if (this.selected.pageIdx === -1)
            {
               this.updateUIState(FindStates.FIND_NOTFOUND);
               return;
            }

            // Handle findAgain case.
            var previous = this.state.findPrevious;
            var sPageIdx = this.selected.pageIdx;
            var sMatchIdx = this.selected.matchIdx;
            var findState = FindStates.FIND_FOUND;

            if (previous)
            {
               // Select previous match.

               if (sMatchIdx !== 0)
               {
                  this.selected.matchIdx -= 1;
               } else
               {
                  var len = pageMatches.length;
                  for ( var i = sPageIdx - 1; i != sPageIdx; i--)
                  {
                     if (i < 0)
                        i += len;

                     if (pageMatches[i].length !== 0)
                     {
                        this.selected = {
                           pageIdx : i,
                           matchIdx : pageMatches[i].length - 1
                        };
                        break;
                     }
                  }
                  // If pageIdx stayed the same, select last match on the page.
                  if (this.selected.pageIdx === sPageIdx)
                  {
                     this.selected.matchIdx = pageMatches[sPageIdx].length - 1;
                     findState = FindStates.FIND_WRAPPED;
                  } else if (this.selected.pageIdx > sPageIdx)
                  {
                     findState = FindStates.FIND_WRAPPED;
                  }
               }
            } else
            {
               // Select next match.

               if (pageMatches[sPageIdx].length !== sMatchIdx + 1)
               {
                  this.selected.matchIdx += 1;
               } else
               {
                  var len = pageMatches.length;
                  for ( var i = sPageIdx + 1; i < len + sPageIdx; i++)
                  {
                     if (pageMatches[i % len].length !== 0)
                     {
                        this.selected = {
                           pageIdx : i % len,
                           matchIdx : 0
                        };
                        break;
                     }
                  }

                  // If pageIdx stayed the same, select first match on the page.
                  if (this.selected.pageIdx === sPageIdx)
                  {
                     this.selected.matchIdx = 0;
                     findState = FindStates.FIND_WRAPPED;
                  } else if (this.selected.pageIdx < sPageIdx)
                  {
                     findState = FindStates.FIND_WRAPPED;
                  }
               }
            }

            this.updateUIState(findState, previous);
            this.updatePage(sPageIdx, sPageIdx === this.selected.pageIdx);
            if (sPageIdx !== this.selected.pageIdx)
            {
               this.updatePage(this.selected.pageIdx, true);
            }
         }
      },

      updateUIState : function(state, previous)
      {
         var findMsg = '';
         var status = '';

         /**
          * TODO: For now do not display for hits, gets very noisy when stepping.
          * Possibly change color or similar in search box to indicate hit instead
          * Pending cand be ajax gif on search bar until state is found, then removed. 
          * See pdf.js default Implementation
          */

         if(state===FindStates.FIND_FOUND||state===FindStates.FIND_PENDING)
            return;
         
         switch (state) {
           case FindStates.FIND_FOUND:
             findMsg = this.documentView.pdfJsPlugin.wp.msg('search.message.found');
             break;

           case FindStates.FIND_PENDING:
             findMsg = this.documentView.pdfJsPlugin.wp.msg('search.message.pending');
             break;

           case FindStates.FIND_NOTFOUND:
             findMsg = this.documentView.pdfJsPlugin.wp.msg('search.message.notfound');
             break;

           case FindStates.FIND_WRAPPED:
             if (previous) {
                findMsg = this.documentView.pdfJsPlugin.wp.msg('search.message.wrapped.bottom');
             } else {
                findMsg = this.documentView.pdfJsPlugin.wp.msg('search.message.wrapped.top');
             }
             break;
         }
         
         Alfresco.util.PopupManager.displayMessage({
            text : findMsg
         });
      }
   };
})();
