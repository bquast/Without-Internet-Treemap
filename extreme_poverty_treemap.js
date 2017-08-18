/*
 * Language i18n
 */
var i18n = {
    country: function(iso3c) {
        iso3c = iso3c.toUpperCase();
        if (iso3c in i18n_countries) {
            return i18n_countries[iso3c];
        } else {
            console.log("Unknown country for this language: " + iso3c);
            return ""
        }
    },
    tooltip: function(iso3c, count, year) {
        return Mustache.render(
            i18n_strings["tooltip.caption"],
            {country: this.country(iso3c), count: this.smartRound(count), year: year}
        );
    },
    smartRoundDefault: function(x) {
        if (x > 1) {
            newx = Math.round(x,1);
            return Mustache.render(i18n_strings["millions"], {x : newx});
        } else if (x > 0.001) {
            newx = Math.round(x*1000,1);
            return Mustache.render(i18n_strings["thousands"], {x : newx});
        } else {
            return i18n_strings["nil"];
        }
    },
    smartRound: function(x) {
        if (i18n_strings.smartRound) {
            return i18n_strings.smartRound(x);
        } else {
            return this.smartRoundDefault(x);
        }
    }
}


/*
 * Basic D3 drawing
 */
var updateYear;

var svg = d3.select("svg#treemap");
var width = svg.attr("width"),
    height = svg.attr("height");

var treemap = d3.treemap()
    .tile(d3.treemapSquarify.ratio(1))
    .size([width, height])
    .round(true)
    .paddingInner(1);

// Mapping from regions defined in CSV to CSS classes for styling
var regions = {
    "ECS": { class: "region_ECS" },
    "SSF": { class: "region_SSF" },
    "LCN": { class: "region_LCN" },
    "SAS": { class: "region_SAS" },
    "EAS": { class: "region_EAS" },
    "MEA": { class: "region_MEA" }
};

var years = [];    // array of years in which we have observations
var currentYear;   // current year being displayed

d3.csv("extreme_poverty.csv", function(error, table) {

    if (error) throw error;

    // extract years out of input CSV
    d3.keys(table[0]).forEach(function(h) {
        if (h.indexOf("year_") === 0 && h != "year_max") {
            years.push(parseInt(h.substring(5,9)));
        }
    });
    currentYear = years[0];

    // Treemap needs intermediate tree nodes for regions to do grouping, so add them trivially
    Object.keys(regions).forEach(function(region3c) {
        table.push({
            iso3c: region3c,
            region3c: "WLD",
        });
    });
    table.push({
        iso3c: "WLD",
        region3c: "", // root node .: no parent
    });

    // Build the hierarchy from the flat file
    var root = d3.stratify()
        .id(function(d) {
            return d.iso3c;
        })
        .parentId(function(d) {
            return d.region3c;
        })
        (table);

    // Build the base tree, using maximum over the years
    root = root.sum(function(d) {
            return d.year_max;
        })
        .sort(function(a, b) {
            return (b.value - a.value);
        });

    treemap(root);

    // Draw the base tree with transparency
    var cell = svg.selectAll("g")
        .data(root.leaves())
        .enter().append("g")
        .attr("transform", function(d) {
            return "translate(" + d.x0 + "," + d.y0 + ")";
        });

    cell.append("rect")
        .attr("id", function(d) {
            return "max_" + d.data.iso3c;
        })
        .attr("class", function(d) {
            return regions[d.data.region3c].class;
        })
        .attr("width", function(d) {
            return d.x1 - d.x0;
        })
        .attr("height", function(d) {
            return d.y1 - d.y0;
        })
        .attr("fill-opacity", function(d) {
            return 0.15;
        });

    var getTransform = function(d) {
        return "translate(" +
            (d.x1 - d.x0) * (1 - Math.sqrt(d.data["year_" + currentYear] / d.data.year_max)) / 2 + "," +
            (d.y1 - d.y0) * (1 - Math.sqrt(d.data["year_" + currentYear] / d.data.year_max)) / 2 + ")";
    };
    
    var getWidth = function(d) {
        return (d.x1 - d.x0) * Math.sqrt(d.data["year_" + currentYear] / d.data.year_max);
    };
    
    var getHeight = function(d) {
        return (d.y1 - d.y0) * Math.sqrt(d.data["year_" + currentYear] / d.data.year_max);
    };


    // Draw the selected year
    cell.append("rect")
        .attr("id", function(d) {
            return d.data.iso3c;
        })
        .attr("class", function(d) {
            return "yearbox " + regions[d.data.region3c].class;
        })
        .attr("transform", getTransform)
        .attr("width", getWidth)
        .attr("height", getHeight);

    // Draw the text labels
    cell.append("clipPath")
        .attr("id", function(d) {
            return "clip-" + d.data.iso3c;
        })
        .append("use")
        .attr("xlink:href", function(d) {
            return "#max_" + d.data.iso3c;
        });

    cell.filter(function(d) {
            return d.data.year_max > 5.0;
        })
        .append("text")
        .attr("clip-path", function(d) {
            return "url(#clip-" + d.data.iso3c + ")";
        })
        .attr("alignment-baseline", "middle")
        .attr("text-anchor", "middle")
        .attr("font-size", function(d) {
            return (d.data.year_max > 25.0 ? 12 : 8) + "px";
        })
        .attr("class", function(d) {
            return "text " + regions[d.data.region3c].class;
        })
        .selectAll("tspan")
        .data(function(d) {
            return i18n.country(d.data.iso3c).split(" ").map(function(x) {
                return {
                    t: x,
                    x: (d.x1 - d.x0) / 2,
                    y: (d.y1 - d.y0) / 2
                };
            });
        })
        .enter().append("tspan")
        .attr("x", function(d, i) {
            return d.x;
        })
        .attr("y", function(d, i) {
            return d.y + i * 10;
        })
        .text(function(d) {
            return d.t;
        });

    // Hacky way to set the size of the size key in legend
    firstrect = svg.select("g").select("rect");
    dim10m = Math.sqrt(firstrect.attr("width")*firstrect.attr("height") / firstrect.data()[0].value * 10);
    $("#legendsizekey").css("width", dim10m).css("height", dim10m);
    
    // Define the div for the tooltip
    var tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("display", "none")
        .style("z-index", 10);

    cell.on("mouseover", function(d) {
            tooltip.data([d.data]);
            tooltip.style("display", "inline");
            svg.attr("fill-opacity", 0.25);
            d3.select(this).attr("fill-opacity", 1.0);
        })
        .on("mousemove", function(d) {
            ttBox = tooltip.node().getBoundingClientRect();
            if (ttBox.width !== 0) { // sometimes is in IE in the "gaps"
            
                ttLeft = (d3.event.pageX) - ttBox.width / 2;
                ttTop = (d3.event.pageY) - ttBox.height;
            
                bodyBox = document.body.getBoundingClientRect();

                if (ttLeft + ttBox.width > bodyBox.right) ttLeft = ttLeft - (ttLeft + ttBox.width - bodyBox.right);
                //if (ttTop + ttBox.height > bodyBox.bottom) ttTop = ttTop - (ttTop + ttBox.height - bodyBox.bottom);
                if (ttLeft < 0) ttLeft = 0;
                if (ttTop < 0) ttTop = 0;
            
                tooltip.style("left", ttLeft + "px")
                       .style("top", ttTop + "px");
                updateTooltip();
            }
        })
        .on("mouseout", function(d) {
            tooltip.style("display", "none");
            svg.attr("fill-opacity", null);
            d3.select(this).attr("fill-opacity", null);
        });

    updateYear = function(year, duration) {
        currentYear = year;

        cell.transition()
            .duration(duration)
            .select(".yearbox")
            .attr("transform", getTransform)
            .attr("width", getWidth)
            .attr("height", getHeight);

        
        yearlabel = $("#yearlabel").remove().text(year);
        $("#yearlabelholder").append(yearlabel);
        updateTooltip();
    };

    updateTooltip = function() {
        if (tooltip.style("display") !== "none") {
            tooltip.html(function(ttd) {
                return "<span style='font-size: 14px'>"+i18n.tooltip(ttd.iso3c, ttd["year_"+currentYear], currentYear)+"</span><br><br>" +
                    "<table>" +
                    [1990,1996,2002,2008,2013].map(function(y) {
                        if (y === currentYear) {
                            return "<tr><td><b>" + y + '</b></td><td class="figures"><b>' + i18n.smartRound(ttd["year_"+y]) + "</b></td></tr>";
                        } else {
                            return "<tr><td>" + y + '</td><td class="figures">' + i18n.smartRound(ttd["year_"+y]) + "</td></tr>";                                    
                        }
                    }).join("\n") +
                    "</table>";
            });
        }
    };

    createSlider(years);
    // we were setting focus on load but that's a bad idea in an iframe
    //$(".ui-slider-handle").focus();
});

/*
 * Interactivity stuff - timeline/slider and animation
 */
var sliderLabels, timeStep;
var currIndex = 0;
var sliderPlayTime = 8000;

var isPlaying = false;
var nextTimeout;

// Borrowed from http://stackoverflow.com/questions/8584902/get-closest-number-out-of-array
var getClosest = function(number, array) {
    var current = array[0];
    var difference = Math.abs(number - current);
    var index = array.length;
    while (index--) {
        var newDifference = Math.abs(number - array[index]);
        if (newDifference < difference) {
            difference = newDifference;
            current = array[index];
        }
    }
    return current;
};

var sliderAtLeft = function() {
    return (currIndex === 0);
};

var sliderAtRight = function() {
    return (currIndex === sliderLabels.length - 1);
};

var sliderStepLeft = function() {
    if (!sliderAtLeft()) {
        $("#slider").slider("value", sliderLabels[currIndex - 1]);
    }            
};

var sliderStepRight = function() {
    if (!sliderAtRight()) {
        $("#slider").slider("value", sliderLabels[currIndex + 1]);
    }
};

var createSlider = function(years, currentYear) {
    sliderLabels = years;
    timeStep = sliderPlayTime / (sliderLabels[sliderLabels.length-1] - sliderLabels[0]);

    $("#slider").slider({
        value: currentYear,
        min: sliderLabels[0],
        max: sliderLabels[sliderLabels.length-1],
        step: 0.01,
        stop: function(event, ui) {
            // Snap to closest label
            if (sliderLabels.indexOf(ui.value) === -1) {
                closest = getClosest(ui.value, sliderLabels);
                $(this).slider("value", closest);
            }
        },
        change: function(event, ui) {
            currIndex = sliderLabels.indexOf(ui.value);
            if (!isPlaying) {
                updateYear(ui.value, 500);
            }
        }
    }).keydown(function(event) {
        if (event.which == 37 && !sliderAtLeft()) { // left
            sliderStepLeft();
        } else if (event.which == 39 && !sliderAtRight()) { // right
            sliderStepRight();
        }
    }).each(function() {
        var opt = $(this).data().uiSlider.options;

        // Position the labels
        sliderLabels.forEach(function(val) {
            var el = $('<label>' + val + '</label>').css('left', ((val - opt.min) / (opt.max - opt.min) * 100) + '%');
            $("#slider").append(el);
        });
    });
};

var timedAdvance = function() {
    sliderStepRight();
    if (!sliderAtRight()) {
        nextTimeout = timeStep * (sliderLabels[currIndex+1] - sliderLabels[currIndex]);
        nextTimeoutObj = setTimeout(timedAdvance, nextTimeout);
        updateYear(sliderLabels[currIndex+1], nextTimeout);
    } else {
        $("#play").html("&#9654;");
        isPlaying = false;
    }
};

$("#play").click(function(event) {
    if (!isPlaying) {
        $(this).html("<b>&#8545;</b>");
        isPlaying = true;
        $("#slider").slider("value", sliderLabels[0]);
        nextTimeout = timeStep * (sliderLabels[1] - sliderLabels[0]);
        updateYear(sliderLabels[currIndex+1], nextTimeout);
        nextTimeoutObj = setTimeout(timedAdvance, nextTimeout);
    } else {
        $(this).html("&#9654;");
        isPlaying = false;
        clearTimeout(nextTimeoutObj);
    }
}).keydown(function(event) {
    if (event.which == 37 && !sliderAtLeft()) { // left
        sliderStepLeft();
    } else if (event.which == 39 && !sliderAtRight()) { // right
        sliderStepRight();
    }
});