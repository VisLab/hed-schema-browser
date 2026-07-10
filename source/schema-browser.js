var schemaNodes = [];
var allSchemaNodes = [];
var inLibraryNodes = [];
var suggestedTagsDict = {};
var useNewFormat = true;
var github_endpoint = "https://api.github.com/repos/hed-standard/hed-schemas/contents";
var github_raw_endpoint = "https://raw.githubusercontent.com/hed-standard/hed-schemas/main";
//Get the button
let scrollToTopBtn = null;

/**
 * Escape HTML special characters to prevent XSS and broken rendering
 * @param text The text to escape
 * @returns The HTML-escaped text
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Onload call. Build schema selection and schema versions dropdown
 * and load default schema accordingly to url params
 */
function load(schema_name) {
    /* Set up scroll to top button
    * https://mdbootstrap.com/docs/standard/extended/back-to-top/
    */
    scrollToTopBtn = document.getElementById("btn-back-to-top");

    // When the user scrolls down 20px from the top of the document, show the button
    window.onscroll = function () {
      scrollFunction();
    };
    // When the user clicks on the button, scroll to the top of the document
    scrollToTopBtn.addEventListener("click", backToTop);

    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('schema')) {
        schema_name = urlParams.get('schema');
    }

    // Get and load schema according to official or prerelease
    standard_schema_api_path = github_endpoint + "/standard_schema";
    library_schema_api_path = github_endpoint + "/library_schemas";
    if (schema_name.includes('prerelease')) {
        var name_without_prerelease = schema_name.replace('_prerelease', '');
        if (name_without_prerelease == "standard") {
            var schema_link = getPrereleaseXml(standard_schema_api_path + "/prerelease");
        }
        else {
            var schema_link = getPrereleaseXml(library_schema_api_path + "/" + name_without_prerelease + "/prerelease");
        }
        // load preprelease schema accordingly
        loadSchema(schema_name, schema_link)

        // add schema names to schema dropdown button
        var standard_prerelease_schema_link = getPrereleaseXml(standard_schema_api_path + "/prerelease");
        var html = '<a class="dropdown-item" id="schemaStandard" + " onclick="loadSchema(\'' + schema_name + '\', \'' + standard_prerelease_schema_link + '\')">Standard</a>';
        $("#schemaDropdown").append(html);
        library_schemas = getLibarySchemas();
        for (var i=0; i < library_schemas.length; i++) {
            var library_schema_link = getPrereleaseXml(library_schema_api_path + "/" + library_schemas[i] + "/prerelease"); 
            var html = '<a class="dropdown-item" id="schemaStandard" + " onclick="loadSchema(\'' + library_schemas[i] + '\', \'' + library_schema_link + '\')">' + library_schemas[i] + '</a>';
            $("#schemaDropdown").append(html);
        }
    }
    else {
        // add schema names to schema dropdown button
        var html = '<a class="dropdown-item" id="schemaStandard" + " onclick="loadDefaultSchema(\'standard\')">standard</a>';
        $("#schemaDropdown").append(html);
        library_schemas = getLibarySchemas();
        for (var i=0; i < library_schemas.length; i++) {
            var html = '<a class="dropdown-item" id="schemaStandard" + " onclick="loadDefaultSchema(\'' + library_schemas[i] + '\')">' + library_schemas[i] + '</a>';
            $("#schemaDropdown").append(html);
        }
        
        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('schema')) {
            url_schema_name = urlParams.get('schema');
            if (urlParams.has('version')) {
                version = urlParams.get('version');
                url = getSchemaURL(url_schema_name, version);
                loadSchema(url_schema_name, url);
                setDropdownBtnText(url_schema_name, version);
            } 
            else
                loadDefaultSchema(url_schema_name);
        }
        else {
            loadDefaultSchema(schema_name);
        }
    }

    // set synonym getter behaviors
    $("#syn_getter_btn").click(function() {
    let host = "http://127.0.0.1:5000/";
    let query = host + "synonym?word=" + $("#searchTags").val();
    var synonyms = null;
        $.ajax({dataType: "json", url: query, async: false, 
        success: function(data) {
        console.log("hide");
            synonyms = [];
            synonyms.push($("#searchTags").val());
            synonyms = synonyms.concat(data["synonyms"]);
            },
        error: function(err) {
            console.log(err);
        }
    });
    if (synonyms != null) {
        $("#syn_getter").empty();
        synonyms.forEach(function(syn) {
            const capitalized = capitalizeFirstLetter(syn);
        let matched_node = allSchemaNodes.filter(elem => elem.includes(capitalized) || elem.includes(syn));
        if (matched_node.length !== 0) {
            matched_node.forEach(node => $("#syn_getter").append(`<option value="${node}" style="font-size:40px;">${node}</option>`));
        }
        });
    }
    });
    $("#syn_getter").change(function() { toNode($(this).val()) });

    // set lock window key press behavior
    $( document ).keypress(function(event) {
        if (event.which == 13) { // enter key
            if ($("div#infoBoard").attr('editable') == 'true') {
                $("div#infoBoard").attr('editable', 'false');
                $("a").off( "mouseover" ); //.mouseover(function(){});
                $("#freezeInfo").html("Press enter/return to unfreeze info board");
            }
            else {
                $("div#infoBoard").attr('editable', 'true');
                $("a").mouseover({format: useNewFormat},infoBoardMouseoverEvent);
                $("#freezeInfo").html("Press enter/return to freeze info board");
            }
        }
    })
    
}

/**
 * Get all currently available library schemas
 */
function getLibarySchemas() {
    libray_schemas_endpoint = github_endpoint + "/library_schemas";
    library_schemas = [];

    $.ajax({dataType: "json", url: libray_schemas_endpoint, async: false, success: function(data) {
        data.forEach(function(item,index) {
            library_schemas.push(item["name"]);
        })
    }});
    return library_schemas;
}

/**
 * Get all schema versions currently hosted on
 * https://github.com/hed-standard/hed-specification/tree/master/hedxml
 * and build githubSchema global variable
 * While building, reverse order for nice display in the dropdown
 */
function getGithubSchema(schema_name) {
    var githubSchema = {"version": [], "download_link": [], "isDeprecated": []};
    if (schema_name == "standard") {
        xml_path = github_endpoint + "/standard_schema/hedxml";
    }
    else {
        xml_path = github_endpoint + "/library_schemas/" + schema_name + "/hedxml";
    }

    $.ajax({dataType: "json", url: xml_path, async: false, success: function(data) {
        data.forEach(function(item,index) {
        if (item["name"].includes('xml')) {
            var version = item["name"].replace(/\.xml$/, '');
            var link = item["download_url"];
            // add to global dict
            githubSchema["version"].push(version);
            githubSchema["download_link"].push(link);
            githubSchema["isDeprecated"].push(false);
        }
        })
    }});
    Object.keys(githubSchema).forEach(key => githubSchema[key].reverse());
    // get deprecated schemas
    var hedxml_url = xml_path + "/deprecated";
    var deprecated = {"version": [], "download_link": [], "isDeprecated": []};
    $.ajax({dataType: "json", url: hedxml_url, async: false, success: function(data) {
        data.forEach(function(item,index) {
        if (item["name"].includes('xml')) {
                var version = item["name"].replace(/\.xml$/, '');
                var link = item["download_url"];
                // add to global dict
                deprecated["version"].push(version);
                deprecated["download_link"].push(link);
                deprecated["isDeprecated"].push(true);
        }
        })
    }});
    Object.keys(deprecated).forEach(key => deprecated[key].reverse());
    Object.keys(deprecated).forEach(key => {
    deprecated[key].forEach(elem => githubSchema[key].push(elem))
    });
    return githubSchema;
}

/**
 *  Retrieve schema versions and add to version dropdown button
 */
function buildSchemaVersionDropdown(schema_name) {
    // clear existing versions
    $("#schemaVersionDropdown").empty();

    // get versions based on provided schema name
    githubSchema = getGithubSchema(schema_name);
    
    // create array of indices and sort by semantic version (descending)
    var indices = [];
    for (var i = 0; i < githubSchema["version"].length; i++) {
        indices.push(i);
    }
    
    // sort indices by semantic version (highest first)
    indices.sort(function(a, b) {
        return compareSemanticVersions(githubSchema["version"][b], githubSchema["version"][a]);
    });
    
    var isDeprecatedTitleAdded = false;
    // build schema dropdown from Github repo in sorted order
    for (var i = 0; i < indices.length; i++) {
        var idx = indices[i];
        if (githubSchema["isDeprecated"][idx] && !isDeprecatedTitleAdded) {
            var html = '<a class="dropdown-header"><b>' + 'Deprecated' + '</b></a>';
            $("#schemaVersionDropdown").append(html);
            isDeprecatedTitleAdded = true;
        } 
        var html = '<a class="dropdown-item" id="schema' + githubSchema["version"][idx] + '" onclick="loadSchema(\'' + schema_name + '\', \'' + githubSchema["download_link"][idx] + '\')">' + githubSchema["version"][idx] + '</a>';
        $("#schemaVersionDropdown").append(html);
    }
}

/**
 * Get the unique prerelease schema xml from prerelease dir
 */
function getPrereleaseXml(prerelease_endpoint) {
    var download_url = "";
    $.ajax({dataType: "json", url: prerelease_endpoint, async: false, success: function(data) {
        data.forEach(function(item,index) {
            if (item["name"].includes('xml') && download_url === "") {
                download_url = item["download_url"];
            }
        })
    }});
    return download_url;
}

/**
 * Get download link of the schema given hedVersion
 * @param hedVersion    schema version number
 * @returns     schema download link
 */
function getSchemaURL(schema_name, version) {
    if (schema_name == "standard") {
        xml_path = github_raw_endpoint + "/standard_schema/hedxml/HED" + version + ".xml";
    }
    else
        xml_path = github_raw_endpoint + "/library_schemas/" + schema_name + "/hedxml/HED_" + schema_name.toLowerCase() + "_" + version + ".xml";
    return xml_path;
}

/**
 * Download the schema given the schema's download link url
 * and reload the html browser with the new schema
 * @param url   schema download link
 */
function loadSchema(schema_name, url)
{
    let re = /HED.*xml/;
    let schemaVersion = url.match(re)[0];
    if ((schemaVersion.charAt(3) >= "8" && !schemaVersion.includes('alpha')) || url.includes('test')) // assuming schemaVersion has form 'HEDx.x.x.*'
        useNewFormat = true;
    else 
        useNewFormat = false;
        
    if (url.includes('deprecated')) // schema link will be */deprecated/*.xml if deprecated
        var isDeprecated = true;
    else 
        var isDeprecated = false;

    $.get(url, function(data,status) {
        xml = $.parseXML(data);
        displayResult(xml, useNewFormat, isDeprecated);
        parseMergedSchema();
        toLevel(2);
        getSchemaNodes();
    });
    $('#dropdownSchemaVersionButton').text('Version: ' + schemaVersion.split('.xml')[0]);
    
    // set prerelease switch btn href
    if (schema_name.includes('prerelease')) {
        var name_without_prerelease = schema_name.replace('_prerelease', '');
        $('.prerelease-switch').attr('href', replaceUrlParam("index.html", 'schema', name_without_prerelease));
    }
    else
        $('.prerelease-switch').attr('href', replaceUrlParam("prerelease.html", 'schema', schema_name + '_prerelease'));
 
}

/**
 * Extract semantic version from a full version string
 * "HED8.4.0" → "8.4.0"
 * "HED_xxx_8.4.0" → "8.4.0"
 */
function extractSemanticVersion(versionStr) {
    var match = versionStr.match(/(\d+)\.(\d+)\.(\d+)/);
    if (match) {
        return match[1] + '.' + match[2] + '.' + match[3];
    }
    return versionStr;
}

/**
 * Compare two semantic versions (e.g., "HED8.4.0" vs "HED8.3.0" or "HED_xxx_8.4.0" vs "HED_xxx_8.3.0")
 * Returns: positive if v1 > v2, negative if v1 < v2, 0 if equal
 */
function compareSemanticVersions(v1, v2) {
    var sem1 = extractSemanticVersion(v1);
    var sem2 = extractSemanticVersion(v2);
    
    var match1 = sem1.match(/(\d+)\.(\d+)\.(\d+)/);
    var match2 = sem2.match(/(\d+)\.(\d+)\.(\d+)/);
    
    if (!match1 || !match2) return 0;
    
    var major1 = parseInt(match1[1]);
    var minor1 = parseInt(match1[2]);
    var patch1 = parseInt(match1[3]);
    
    var major2 = parseInt(match2[1]);
    var minor2 = parseInt(match2[2]);
    var patch2 = parseInt(match2[3]);
    
    if (major1 !== major2) return major1 - major2;
    if (minor1 !== minor2) return minor1 - minor2;
    return patch1 - patch2;
}

/**
 * Find the highest semantic version among non-deprecated versions
 * Returns the download URL of the latest version, or null if none found
 */
function findLatestVersion(versions, isDeprecated, downloadLinks) {
    var latestIndex = -1;
    var latestVersion = null;
    
    for (var i = 0; i < versions.length; i++) {
        if (!isDeprecated[i]) {
            if (latestIndex === -1 || compareSemanticVersions(versions[i], latestVersion) > 0) {
                latestIndex = i;
                latestVersion = versions[i];
            }
        }
    }
    
    if (latestIndex === -1) {
        return null;
    }
    
    return downloadLinks[latestIndex];
}

function loadDefaultSchema(schema_name) {
    // build schema version dropdown
    buildSchemaVersionDropdown(schema_name);

    // get the latest version from GitHub
    githubSchema = getGithubSchema(schema_name);
    var latestUrl = findLatestVersion(githubSchema["version"], githubSchema["isDeprecated"], githubSchema["download_link"]);

    // load default schema - use actual URL if found, otherwise fall back to Latest redirect
    if (latestUrl) {
        loadSchema(schema_name, latestUrl);
    } else {
        // fallback if GitHub API returns no data
        if (schema_name == "standard") {
            xml_path = github_raw_endpoint + "/standard_schema/hedxml/HEDLatest.xml";
        }
        else {
            xml_path = github_raw_endpoint + "/library_schemas/" + schema_name + "/hedxml/HED_" + schema_name.toLowerCase() + "_Latest.xml";
        }
        loadSchema(schema_name, xml_path);
    }
}

function setDropdownBtnText(schema_name, version) {
    $('#dropdownSchemaButton').text('Schema: ' + schema_name);
    $('#dropdownSchemaVersionButton').text('Version: ' + version);
}
// -------------------------------------------------------------------------
// Pure-JS XML → HTML transformation
// Replaces the deprecated XSLTProcessor / XSLT pipeline.
// The generated HTML is structurally identical to what hed-schema.xsl and
// hed-schema-old.xsl produced, so all downstream jQuery code is unchanged.
// -------------------------------------------------------------------------

/** Escape a string for safe insertion into HTML text or attribute values. */
function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Replicates the XSL translate(translate(name,' ','_'),'0123456789','zowhfvsneit').
 * Used to build CSS-safe id / href values.
 */
function xslTranslate(name) {
    const digits = {'0':'z','1':'o','2':'w','3':'h','4':'f','5':'v','6':'s','7':'n','8':'e','9':'i'};
    return name.replace(/ /g, '_').replace(/[0-9]/g, d => digits[d] || d);
}

/** Return trimmed text of the first direct child element with the given tag. */
function childText(el, tag) {
    const child = el.querySelector(`:scope > ${tag}`);
    return child ? child.textContent.trim() : '';
}

/**
 * Render <attribute> direct children of el as hidden divs attributed to nodeName.
 * Matches the output of the XSL <attribute> template in hed-schema.xsl.
 */
function renderAttrDivs(el, nodeName) {
    let html = '';
    for (const attr of el.querySelectorAll(':scope > attribute')) {
        const attrName = childText(attr, 'name');
        const values = [...attr.querySelectorAll(':scope > value')].map(v => esc(v.textContent.trim()));
        const valStr = values.length > 0 ? values.join(', ') + ',' : 'true';
        html += `<div class="attribute" style="display: none" name="${esc(nodeName)}">${esc(attrName)}: ${valStr}</div>`;
    }
    return html;
}

/**
 * Render <property> direct children of el as hidden divs attributed to nodeName.
 * Used for schemaAttributeDefinition elements (which carry properties, not attributes).
 */
function renderPropDivs(el, nodeName) {
    let html = '';
    for (const prop of el.querySelectorAll(':scope > property')) {
        const propName = childText(prop, 'name');
        const values = [...prop.querySelectorAll(':scope > value')].map(v => esc(v.textContent.trim()));
        const valStr = values.length > 0 ? values.join(', ') + ',' : 'true';
        html += `<div class="attribute" style="display: none" name="${esc(nodeName)}">${esc(propName)}: ${valStr}</div>`;
    }
    return html;
}

/**
 * Render a <node> element and its children recursively (new format, hed-schema.xsl).
 * Parent nodes  → <a data-toggle="collapse"> + children container div
 * Leaf nodes    → plain <a>
 */
function renderSchemaNode(nodeEl, level) {
    const name = childText(nodeEl, 'name');
    const description = childText(nodeEl, 'description');
    const childNodes = [...nodeEl.querySelectorAll(':scope > node')];

    if (childNodes.length > 0) {
        let html = `<a href="#x${esc(name)}" tag="${esc(name)}" description="${esc(description)}" role="button" class="list-group-item level-${level}" data-toggle="collapse" aria-expanded="true" name="schemaNode">${esc(name)}</a>`;
        html += renderAttrDivs(nodeEl, name);
        html += `<div class="list-group collapse multi-collapse level-${level} show" id="x${esc(name)}">`;
        for (const child of childNodes) {
            html += renderSchemaNode(child, level + 1);
        }
        html += '</div>';
        return html;
    } else {
        // NOTE: the "tag" attribute is only used as a lookup key for jQuery selectors
        // (e.g. a[tag='...']) and for the autocomplete/search node list - it is never used
        // as an actual DOM id/href, so it must NOT be run through xslTranslate(). Using the
        // translated form here previously caused a mismatch with the untranslated "name"
        // attribute that renderAttrDivs() stamps onto each attribute div (name="${nodeName}"),
        // so any leaf tag containing a digit (e.g. "SubnodeE1") could never be matched back to
        // its own attribute divs. This broke inLibrary detection (leaves stayed blue instead of
        // brown) and search/autocomplete for such tags - most visible in the testlib schema,
        // whose test nodes are deliberately named with digits (see GitHub issue #11).
        let html = `<a description="${esc(description)}" role="button" class="list-group-item level-${level}" tag="${esc(name)}" name="schemaNode">${esc(name)}</a>`;
        html += renderAttrDivs(nodeEl, name);
        return html;
    }
}

/** Render the inner HTML of the main schema tree from a <schema> element. */
function renderSchemaTree(schemaEl) {
    let html = '';
    for (const node of schemaEl.querySelectorAll(':scope > node')) {
        html += renderSchemaNode(node, 1);
    }
    return html;
}

function renderUnitClassDefinitions(defsEl) {
    let html = '';
    for (const ucDef of defsEl.querySelectorAll(':scope > unitClassDefinition')) {
        const name = childText(ucDef, 'name');
        const description = childText(ucDef, 'description');
        const idName = xslTranslate(name);
        html += `<a description="${esc(description)}" href="#${esc(idName)}" role="button" class="list-group-item" data-toggle="collapse" aria-expanded="true" name="unitClassDef">${esc(name)}</a>`;
        html += renderAttrDivs(ucDef, name);
        html += `<div class="list-group collapse multi-collapse level-" id="${esc(idName)}">`;
        for (const unit of ucDef.querySelectorAll(':scope > unit')) {
            const uName = childText(unit, 'name');
            const uDesc = childText(unit, 'description');
            html += `<a description="${esc(uDesc)}" role="button" class="list-group-item" tag="${esc(uName)}" name="unitClassDef">${esc(uName)}</a>`;
            html += renderAttrDivs(unit, uName);
        }
        html += '</div>';
    }
    return html;
}

function renderUnitModifierDefinitions(defsEl) {
    let html = '';
    for (const c of defsEl.querySelectorAll(':scope > unitModifierDefinition')) {
        const name = childText(c, 'name');
        const description = childText(c, 'description');
        html += `<a description="${esc(description)}" role="button" class="list-group-item" name="unitModifierDef">${esc(name)}</a>`;
        html += renderAttrDivs(c, name);
    }
    return html;
}

function renderValueClassDefinitions(defsEl) {
    let html = '';
    for (const c of defsEl.querySelectorAll(':scope > valueClassDefinition')) {
        const name = childText(c, 'name');
        const description = childText(c, 'description');
        html += `<a description="${esc(description)}" role="button" class="list-group-item" name="valueClassDef">${esc(name)}</a>`;
        html += renderAttrDivs(c, name);
    }
    return html;
}

function renderSchemaAttributeDefinitions(defsEl) {
    let html = '';
    for (const c of defsEl.querySelectorAll(':scope > schemaAttributeDefinition')) {
        const name = childText(c, 'name');
        const description = childText(c, 'description');
        html += `<a description="${esc(description)}" role="button" class="list-group-item" name="attributeDef">${esc(name)}</a>`;
        html += renderPropDivs(c, name);
    }
    return html;
}

function renderPropertyDefinitions(defsEl) {
    let html = '';
    for (const c of defsEl.querySelectorAll(':scope > propertyDefinition')) {
        const name = childText(c, 'name');
        const description = childText(c, 'description');
        html += `<a description="${esc(description)}" role="button" class="list-group-item" name="propertyDef">${esc(name)}</a>`;
        html += renderAttrDivs(c, name);
    }
    return html;
}

/**
 * Transform a new-format HED XML document (schema >= 8.x) into section HTML strings.
 * Replicates the output of hed-schema.xsl.
 */
function transformNewFormat(xmlDoc) {
    const hed = xmlDoc.querySelector('HED');
    const library = hed.getAttribute('library');
    const version = hed.getAttribute('version') || '';
    const versionStr = library ? `${library}_${version}` : version;

    const get = tag => hed.querySelector(`:scope > ${tag}`);

    return {
        version: versionStr,
        schema:                    renderSchemaTree(get('schema') || document.createElement('schema')),
        prologue:                  (get('prologue') || {textContent: ''}).textContent,
        epilogue:                  (get('epilogue') || {textContent: ''}).textContent,
        unitClassDefinitions:      get('unitClassDefinitions')      ? renderUnitClassDefinitions(get('unitClassDefinitions'))           : '',
        unitModifierDefinitions:   get('unitModifierDefinitions')   ? renderUnitModifierDefinitions(get('unitModifierDefinitions'))     : '',
        valueClassDefinitions:     get('valueClassDefinitions')     ? renderValueClassDefinitions(get('valueClassDefinitions'))         : '',
        schemaAttributeDefinitions:get('schemaAttributeDefinitions')? renderSchemaAttributeDefinitions(get('schemaAttributeDefinitions')): '',
        propertyDefinitions:       get('propertyDefinitions')       ? renderPropertyDefinitions(get('propertyDefinitions'))             : '',
    };
}

/**
 * Render a <node> element for old-format schemas (hed-schema-old.xsl).
 * Old-format schemas store tag attributes as XML attributes, not child elements.
 */
function renderSchemaNodeOld(nodeEl, level) {
    const name = childText(nodeEl, 'name');
    const description = nodeEl.getAttribute('description') || '';
    const tagId = xslTranslate(name);
    const childNodes = [...nodeEl.querySelectorAll(':scope > node')];

    // Attributes are XML attributes in the old format
    const attrParts = [];
    for (const attr of nodeEl.attributes) {
        attrParts.push(`${esc(attr.name)}: ${esc(attr.value)},`);
    }
    const attrHtml = `<div class="attribute" style="display: none">${attrParts.join(' ')}</div>`;

    if (childNodes.length > 0) {
        let html = `<a href="#${esc(tagId)}" tag="${esc(tagId)}" description="${esc(description)}" role="button" class="list-group-item level-${level}" data-toggle="collapse" aria-expanded="true" name="schemaNode">${esc(name)}</a>`;
        html += attrHtml;
        html += `<div class="list-group collapse multi-collapse level-${level} show" id="${esc(tagId)}">`;
        for (const child of childNodes) {
            html += renderSchemaNodeOld(child, level + 1);
        }
        html += '</div>';
        return html;
    } else {
        let html = `<a description="${esc(description)}" role="button" class="list-group-item level-${level}" tag="${esc(tagId)}" name="schemaNode">${esc(name)}</a>`;
        html += attrHtml;
        return html;
    }
}

/**
 * Transform an old-format HED XML document into an HTML string.
 * Replicates the output of hed-schema-old.xsl.
 * The hed-version div is included inline (the old displayResult read it back from #schema).
 */
function transformOldFormat(xmlDoc) {
    const hed = xmlDoc.querySelector('HED');
    const version = hed.getAttribute('version') || '';

    let html = `<div id="hed-version" style="display: none;">${esc(version)}</div>`;
    for (const node of hed.querySelectorAll(':scope > node')) {
        html += renderSchemaNodeOld(node, 1);
    }
    return { version, schema: html };
}

/**
 * Reload html browser with new schema.
 * @param xml          Parsed XML document of the schema
 * @param useNewFormat true for schemas >= 8.0.0-alpha.3 (new child-element attribute format)
 * @param isDeprecated true if this is a deprecated schema version
 */
function displayResult(xml, useNewFormat, isDeprecated) {
    if (useNewFormat) {
        const result = transformNewFormat(xml);
        $("#schema").html(result.schema);
        $("#prologue").html(escapeHtml(result.prologue).replace(/\n/g, "<br>"));
        $("#epilogue").html(escapeHtml(result.epilogue).replace(/\n/g, "<br>"));
        $("#schemaDefinitions").show();
        $("#unitClassDefinitions").html(result.unitClassDefinitions);
        $("#unitModifierDefinitions").html(result.unitModifierDefinitions);
        $("#valueClassDefinitions").html(result.valueClassDefinitions);
        $("#schemaAttributeDefinitions").html(result.schemaAttributeDefinitions);
        $("#propertyDefinitions").html(result.propertyDefinitions);
        var versionText = "HED " + result.version;
        versionText = isDeprecated ? versionText + " (deprecated)" : versionText;
        $("#hed").html(versionText);
    } else {
        const result = transformOldFormat(xml);
        $("#schema").html(result.schema);
        $("#schemaDefinitions").hide();
        var versionText = "HED " + result.version;
        versionText = isDeprecated ? versionText + " (deprecated)" : versionText;
        $("#hed").html(versionText);
    }

    // set info board behavior
    $("a").mouseover({format: useNewFormat}, infoBoardMouseoverEvent);

    // set font colors: parent nodes (with data-toggle) and leaf nodes both get blue,
    // leaf nodes get bold; inLibrary nodes are re-colored brown by parseMergedSchema().
    $(".list-group-item:not(.inLibrary)").css('color', '#0072B2');
    $(".list-group-item:not(.inLibrary):not([data-toggle='collapse'])").css('font-weight', 'bold');
}

function infoBoardMouseoverEvent(event) {
    // jQuery callback that responds to a mouse hover action
        var useNewFormat = event.data.format;
        var selected = $(event.target);
        var node = selected;
        var path = getPath(selected);
        var nodeName = selected.text();
        var finalText = "";
        if (useNewFormat) {
            selected.nextAll(`.attribute[name='${nodeName}']`).each(function(index) {
                var parsed = $(this).text();
                if (parsed.includes(",")) {
                    var trimmed = parsed.trim();
                    var trimmed = trimmed.replace(/(^,)|(,$)/g, "")
                    finalText += "<p>" + trimmed + "</p>";
                }
                else
                    finalText += "<p>" + parsed.trim() + "</p>";
            });
        }
        else {
            var attrs = selected.next(".attribute").text();
                parsed = attrs.split(','); // attributes are written in comma separated string
                parsed = parsed.map(x => "<p>" + x.trim() + "</p>");
                parsed = parsed.slice(0,parsed.length-1); // last item is empty (result of extra , at the end)
                finalText = parsed.join("");
        }
            finalText = finalText == null || finalText.length == 0 ? "" : finalText;
        var disp_div = ["schemaNode", "unitClassDef", "unitModifierDef", "valueClassDef", "attributeDef", "propertyDef"];
        if (disp_div.includes(selected.attr('name'))) {
            $("h4#title").text(nodeName);
            $("p#tag").text("Long form: " + path);
            $("p#description").text(selected.attr("description"));
            $("div#attribute_info").html(finalText);
        }
        else {
            $("h4#title").text(node.textContent);
            $("p#tag").text("");
            $("p#description").text(selected.attr("description"));
            $("div#attribute_info").html(finalText);
        }
}
/**
 *  Get full path of tag node
 *  @param node     a tag node
 */
function getPath(node) {
    var path = node.text();
    node = node.parent();
    while (node != null) {
        var aNode = node.prevAll("a.list-group-item:first");
        if (aNode.text()) {
            path = aNode.text() + "/" + path;
            node = node.parent();
        }
        else
            break;
    }
    return path;
}

/**
 * Button listener for collapse/hide all button
 */
function showHideAll() {
    if ($("#schema").attr("status") == "show") {
        hideAll()
    }
    else {
        showAll()
    }
}
function showAll() {
    $("#schema").find(".collapse").addClass("show");
    $("#schema").attr("status","show");
}
function hideAll() {
    $("#schema").find(".collapse").removeClass("show");
    $("#schema").attr("status","hide");
}
function toLevel(level) {
    hideAll()
    for (var i=1; i < level; i++) {
        $("#schema").find(`.level-${i}`).addClass("show");
    }
    $("#schema").attr("status","show");
}
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
function toNode(nodeName) {
    let node = $("a[tag='"+nodeName+"'");
    let attrs = node.attr("class");
    const levelString = attrs.match(/level-\d?/g)[0];
    const levelNum = levelString.split('-')[1];
    toLevel(levelNum);
    $("html").animate(
      {
        scrollTop: node.offset().top
      },
      500 //speed
    );
    node.effect("highlight", {}, 3000);
}
function getSchemaNodes() {
    /**
     * Set autocomplete behavior
     */
    allowDeprecated = $("#searchDeprecatedTags")[0].checked;
    // clear array
    schemaNodes.length = 0;
    allSchemaNodes.length = 0;

    // clear dictionary
    suggestedTagsDict = {};
    /* Initialize schema nodes list and set behavior of search box */
    $("a[name='schemaNode']").each(function() {
        attributes = getAttributesOfNode($(this));
        if (!allowDeprecated && attributes.includes('deprecatedFrom')) {
            return;
        }
        
        var nodeName = $(this).attr("tag");
        allSchemaNodes.push(nodeName);

        // build the suggestedtags dictionary
        $(this).nextAll(`.attribute[name='${nodeName}']`).each(function(index) {
            var parsed = $(this).text();
            if (parsed.includes("suggestedTag")) {
                var suggestedTags = parsed.split(":")[1].trim();
                suggestedTags = suggestedTags.split(",");
                clean_suggestedTags = [];
                suggestedTags.forEach(element => {
                    // for non empty string, remove whitespace and newline characters and tab characters and push to clean_suggestedTags
                    if (element.trim().length > 0) {
                        cleaned = element.trim();
                        cleaned.replace((/[\t\n\r]/gm),"");
                        cleaned = cleaned.toLowerCase();
                        clean_suggestedTags.push(cleaned);
                    }
                });
                // for each clean_suggestedTags, add its mapping with nodeName to the suggestedTagsDict
                clean_suggestedTags.forEach(element => {
                    if (!(element in suggestedTagsDict)) {
                        suggestedTagsDict[element] = [nodeName];
                    }
                    else {
                        suggestedTagsDict[element].push(nodeName);
                    }
                });
            }
        });
    });    
    
    /* add autocomplete and search */
    autocomplete(document.getElementById("searchTags"), allSchemaNodes, suggestedTagsDict);

    /* go to tag on enter key press */
    $("#searchTags").on('keyup', function (e) {
        if (e.key === 'Enter' || e.keyCode === 13) {
        var searchText = $("#searchTags").val();
        searchText = searchText.toLowerCase();
        searchText = capitalizeFirstLetter(searchText);
        if (allSchemaNodes.includes(searchText))
            toNode(searchText);
        }
    });
}

function getAttributesOfNode(tagNode) {
    attributes = []
    attributeDivs = tagNode.nextUntil("a", ".attribute");
    for (var i=0; i < attributeDivs.length; i++) {
        attributes.push(attributeDivs[i].innerText.split(':')[0]);
    }
    return attributes
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
/* For scroll to top button */
function scrollFunction() {
  if (
    document.body.scrollTop > 20 ||
    document.documentElement.scrollTop > 20
  ) {
    scrollToTopBtn.style.display = "block";
  } else {
    scrollToTopBtn.style.display = "none";
  }
}
function backToTop() {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}
/**
 * From autocomplete online tutorial
 */
function autocomplete(inp, arr, suggestedTagsDict) {
    /*the autocomplete function takes two arguments,
    the text field element and an array of possible autocompleted values:*/
    var currentFocus;
    /*execute a function when someone writes in the text field:*/
    inp.addEventListener("input", function(e) {
        var a, b, i, val = this.value;
        val = val.toLowerCase(); // make uniform
        /*close any already open lists of autocompleted values*/
        closeAllLists();
        if (!val) { return false;}
        currentFocus = -1;
        /*create a DIV element that will contain the items (values):*/
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        /*append the DIV element as a child of the autocomplete container:*/
        this.parentNode.appendChild(a);
        /*for each item in the array...*/
        for (i = 0; i < arr.length; i++) {
          /*check if the item starts with the same letters as the text field value:*/
          if (arr[i].toLowerCase().includes(val)) {
            /*create a DIV element for each matching element:*/
            b = document.createElement("DIV");
            /*make the matching letters bold:*/
            b.innerHTML = arr[i].substr(0, arr[i].toLowerCase().indexOf(val));
            b.innerHTML += "<strong>" + arr[i].substr(arr[i].toLowerCase().indexOf(val), val.length) + "</strong>";
            b.innerHTML += arr[i].substr(arr[i].toLowerCase().indexOf(val)+val.length);
            /*insert a input field that will hold the current array item's value:*/
            b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
            /*execute a function when someone clicks on the item value (DIV element):*/
            b.addEventListener("click", function(e) {
                /*insert the value for the autocomplete text field:*/
                inp.value = this.getElementsByTagName("input")[0].value;
                toNode(inp.value);
                /*close the list of autocompleted values,
                (or any other open lists of autocompleted values:*/
                closeAllLists();
            });
            a.appendChild(b);
          }
        }
        if (val in suggestedTagsDict) {
            b = document.createElement("DIV");
            b.innerHTML = "<strong>Suggested Tags Of:</strong>";
            a.appendChild(b)
            suggestedTagsDict[val].forEach(element => {
                b = document.createElement("DIV");
                b.innerHTML = element
                /*insert a input field that will hold the current array item's value:*/
                b.innerHTML += "<input type='hidden' value='" + element + "'>";
                /*execute a function when someone clicks on the item value (DIV element):*/
                b.addEventListener("click", function(e) {
                    /*insert the value for the autocomplete text field:*/
                    inp.value = this.getElementsByTagName("input")[0].value;
                    toNode(inp.value);
                    /*close the list of autocompleted values,
                    (or any other open lists of autocompleted values:*/
                    closeAllLists();
                });
                a.appendChild(b);
            });
        }
    });
    /*execute a function presses a key on the keyboard:*/
    inp.addEventListener("keydown", function(e) {
        var x = document.getElementById(this.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");
        if (e.keyCode == 40) {
          /*If the arrow DOWN key is pressed,
          increase the currentFocus variable:*/
          currentFocus++;
          /*and and make the current item more visible:*/
          addActive(x);
        } else if (e.keyCode == 38) { //up
          /*If the arrow UP key is pressed,
          decrease the currentFocus variable:*/
          currentFocus--;
          /*and and make the current item more visible:*/
          addActive(x);
        } else if (e.keyCode == 13) {
          /*If the ENTER key is pressed, prevent the form from being submitted,*/
          e.preventDefault();
          if (currentFocus > -1) {
            /*and simulate a click on the "active" item:*/
            if (x) x[currentFocus].click();
          }
        }
    });
    function addActive(x) {
      /*a function to classify an item as "active":*/
      if (!x) return false;
      /*start by removing the "active" class on all items:*/
      removeActive(x);
      if (currentFocus >= x.length) currentFocus = 0;
      if (currentFocus < 0) currentFocus = (x.length - 1);
      /*add class "autocomplete-active":*/
      x[currentFocus].classList.add("autocomplete-active");
    }
    function removeActive(x) {
      /*a function to remove the "active" class from all autocomplete items:*/
      for (var i = 0; i < x.length; i++) {
        x[i].classList.remove("autocomplete-active");
      }
    }
    function closeAllLists(elmnt) {
      /*close all autocomplete lists in the document,
      except the one passed as an argument:*/
      var x = document.getElementsByClassName("autocomplete-items");
      for (var i = 0; i < x.length; i++) {
        if (elmnt != x[i] && elmnt != inp) {
        x[i].parentNode.removeChild(x[i]);
      }
    }
  }
  
  /*execute a function when someone clicks in the document:*/
  document.addEventListener("click", function (e) {
      closeAllLists(e.target);
  });
} 

function parseMergedSchema() {
    // clear inLibraryNodes
    inLibraryNodes.length = 0;
    // parse merged library schema
    // scan through all <a> tags with name="schameNode" and detect whether its siblings contain <div> tag with class="attribute" whose values contains "inLibrary"
    // if so, add the class "inLibrary" to the <a> tag
    $("a[name='schemaNode']").each(function() {
        var nodeName = $(this).attr("tag");
        $(this).nextAll(`.attribute[name='${nodeName}']`).each(function(index) {
            var parsed = $(this).text();
            if (parsed.includes("inLibrary")) {
                inLibraryNodes.push(nodeName);
                $(this).prevAll("a.list-group-item:first").addClass("inLibrary");
                $(this).prevAll("a.list-group-item:first").addClass("hasInLibrary");
            }
        });
    });

    $("#schema").attr("inlibrarystatus","show");

    // mark all tags as has inLibrary class or not
    // for each <a> with list-group-item class
    $("a.list-group-item").each(function() {
        // print the href of this node
        div_id = $(this).attr("href");
        // if the div with id div_id has a child with class inLibrary
        if ($(div_id).find('a.inLibrary').length !== 0) {
            $(this).addClass("hasInLibrary");
        }
    });
   
    // make inLibrary tag a different color
    $(".inLibrary[data-toggle='collapse']").css('color', '#a0522d');
    $(".inLibrary:not([data-toggle='collapse'])").css('color', '#a0522d');
    $(".inLibrary:not([data-toggle='collapse'])").css('font-weight', 'bold');

}

/**
 * Button listener
 * Show/hide merged library tags
 */
function showHideMergedLibrary() {
    if ($("#schema").attr("inlibrarystatus") == "show") {
        // hide base schema
        $(".list-group-item:not(.hasInLibrary)").hide();
        $("#schema").attr("inlibrarystatus","hide");
        /* reinitialize autocomplete and search */
        console.log("hide");
        // print length of inLibraryNodes
        console.log(inLibraryNodes.length);
        autocomplete(document.getElementById("searchTags"), inLibraryNodes, suggestedTagsDict);
    }
    else {
        // show base schema
        $(".list-group-item:not(.hasInLibrary)").show();
        $("#schema").attr("inlibrarystatus","show");
        /* reinitialize autocomplete and search */
        console.log(allSchemaNodes.length);
        autocomplete(document.getElementById("searchTags"), allSchemaNodes, suggestedTagsDict);
    }
}

// Update url params
function replaceUrlParam(url, paramName, paramValue)
{
    if (paramValue == null) {
        paramValue = '';
    }
    var pattern = new RegExp('\\b('+paramName+'=).*?(&|#|$)');
    if (url.search(pattern)>=0) {
        return url.replace(pattern,'$1' + paramValue + '$2');
    }
    url = url.replace(/[?#]$/,'');
    return url + (url.indexOf('?')>0 ? '&' : '?') + paramName + '=' + paramValue;
}

