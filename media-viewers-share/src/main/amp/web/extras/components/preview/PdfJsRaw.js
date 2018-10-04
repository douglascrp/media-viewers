/*
 * Copyright (C) 2010-2012 Share Extras contributors
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
 * This is the "PdfJsRaw" plugin that renders PDF files using the popular pdf.js
 * library. By default the pdf.js libraries are used directly, but in 'iframe'
 * mode it is possible to force the viewer to use the viewer implementation
 * provided by pdf.js within an iframe.
 *
 * Supports the "application/pdf" mime type directly, plus any other type
 * for which a PDF thumbnail definition is available.
 *
 * @namespace Alfresco.WebPreview.prototype.Plugins
 * @class Alfresco.WebPreview.prototype.Plugins.PdfJsRaw
 * @author Peter Lofgren Loftux AB
 */

(function () {
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
     * PdfJsRaw plug-in constructor
     *
     * @constructor
     * @param wp {Alfresco.WebPreview} The Alfresco.WebPreview instance that decides which plugin to use
     * @param attributes {object} Arbitrary attributes brought in from the <plugin> element
     */
    Alfresco.WebPreview.prototype.Plugins.PdfJsRaw = function (wp, attributes) {
        this.wp = wp;
        this.id = wp.id; // needed by Alfresco.util.createYUIButton
        this.attributes = YAHOO.lang.merge(Alfresco.util.deepCopy(this.attributes), attributes);
        return this;
    };

    Alfresco.WebPreview.prototype.Plugins.PdfJsRaw.prototype =
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
                     * the PdfJsRaw to display.
                     *
                     * @property src
                     * @type String
                     * @default null
                     */
                    src: null,

                    /**
                     * Skipbrowser test, mostly for developer to force test loading. Valid
                     * options "true" "false" as String.
                     *
                     * @property skipbrowsertest
                     * @type String
                     * @default "false"
                     */
                    skipbrowsertest: "false",

                },

            /**
             * Cached PDF document, once loaded from the server
             *
             * @property pdfDoc
             * @type {object}
             * @default null
             */
            pdfDoc: null,


            /**
             * Whether the previewer is embedded in a wiki page
             *
             * @property inWikiPage
             * @type boolean
             * @default false
             */
            inWikiPage: false,

            /**
             * Whether the previewer is embedded in a dashlet
             *
             * @property inDashlet
             * @type boolean
             * @default false
             */
            inDashlet: false,

            /**
             * Tests if the plugin can be used in the users browser.
             *
             * @method report
             * @return {String} Returns nothing if the plugin may be used, otherwise
             *         returns a message containing the reason it cant be used as a
             *         string.
             * @public
             */
            report: function PdfJsRaw_report() {
                var canvassupport = false,
                    skipbrowsertest = (this.attributes.skipbrowsertest && this.attributes.skipbrowsertest === "true") ? true : false;

                if (skipbrowsertest === false) {
                    // Test if canvas is supported
                    if (window.HTMLCanvasElement) {
                        canvassupport = true;
                        // Do some engine test as well, some support canvas but not the
                        // rest for full html5
                        if (YAHOO.env.ua.webkit > 0 && YAHOO.env.ua.webkit < 534) {
                            // http://en.wikipedia.org/wiki/Google_Chrome
                            // Guessing for the same for safari
                            canvassupport = false;
                        }
                        // It actually works with ie9, but lack fo support for typed
                        // arrays makes performance terrible.
                        if (YAHOO.env.ua.ie > 0 && YAHOO.env.ua.ie < 10) {
                            canvassupport = false;
                        }
                        if (YAHOO.env.ua.gecko > 0 && YAHOO.env.ua.gecko < 5) {
                            // http://en.wikipedia.org/wiki/Gecko_(layout_engine)
                            canvassupport = false;
                        }
                    }

                }
                else {
                    canvassupport = true;
                }

                // If neither is supported, then report this, and bail out as viewer
                if (canvassupport === false && skipbrowsertest === false) {
                    return this.wp.msg("label.browserReport", "&lt;canvas&gt; element");
                }

            },


            /**
             * Display the node.
             *
             * @method display
             * @public
             */
            display: function PdfJsRaw_display() {
                this.inWikiPage = Dom.getAncestorByClassName(this.wp.getPreviewerElement(), "wiki-page") != null;
                this.inDashlet = Dom.getAncestorByClassName(this.wp.getPreviewerElement(), "body") != null;

                var fileurl;
                if (this.attributes.src) {
                    // Get pdf thumbnail modification date
                    var thumbnailModifications = this.wp.options.thumbnailModification, thumbnailModified=0;
                    for(var i=0, l=thumbnailModifications.length; i<l; i++) {
                        var tm = thumbnailModifications[i].split(':');
                        if(tm[0]==='pdf') {
                            thumbnailModified = tm[1];
                        }
                    }

                    // Custom webscript for the sole purpose of getting the pdf rendition
                    fileurl = Alfresco.constants.PROXY_URI + "mediaviewers/pdfthumbnail/" + this.wp.options.nodeRef.replace(":/", "") + "/" + thumbnailModified + "/" + this.wp.options.name
                        + '.pdf';
                }
                else {
                    fileurl = this.wp.getContentUrl();
                }
                var previewHeight = this.wp.setupPreviewSize();
                Dom.setAttribute(this.wp.getPreviewerElement(), "height", (previewHeight - 10).toString());
                var displaysource = '<iframe id="' + this.wp.id +'-PdfJsRaw" name="PdfJsRaw" src="' + Alfresco.constants.URL_PAGECONTEXT + 'pdf-preview?file=' + encodeURIComponent(fileurl)
                    + '" scrolling="yes" marginwidth="0" marginheight="0" frameborder="0" vspace="5" hspace="5"  style="height:' + previewHeight.toString()
                    + 'px;"></iframe>';

                window.addEventListener('resize', Alfresco.util.bind(this.onResize, this));

                // Return HTML that will be set as the innerHTML of the previewer
                return displaysource;

            },

            onResize: function PdfJsRaw_onResize() {
                var iFrame = document.getElementById( this.wp.id +'-PdfJsRaw' );
                var previewHeight = this.wp.setupPreviewSize();
                if(iFrame) {

                    iFrame.height = previewHeight;
                    Dom.setStyle(iFrame, 'height',previewHeight.toString() + 'px');
                }
                var previewElement = this.wp.getPreviewerElement();
                if(previewElement) {
                    Dom.setStyle(previewElement, "height", previewHeight.toString() + 'px');
                    previewElement.height=previewHeight;
                }


            }

        };
})();