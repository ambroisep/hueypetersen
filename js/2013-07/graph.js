(function(window) {

    var jumps = [{"fromSolarSystemId":30004707,"toSolarSystemId":30004706},{"fromSolarSystemId":30004708,"toSolarSystemId":30004707},{"fromSolarSystemId":30004709,"toSolarSystemId":30004707},{"fromSolarSystemId":30004710,"toSolarSystemId":30004707},{"fromSolarSystemId":30004710,"toSolarSystemId":30004708},{"fromSolarSystemId":30004711,"toSolarSystemId":30004710},{"fromSolarSystemId":30004712,"toSolarSystemId":30004711},{"fromSolarSystemId":30004713,"toSolarSystemId":30004712},{"fromSolarSystemId":30004714,"toSolarSystemId":30004713},{"fromSolarSystemId":30004715,"toSolarSystemId":30004712},{"fromSolarSystemId":30004716,"toSolarSystemId":30004714},{"fromSolarSystemId":30004717,"toSolarSystemId":30004715},{"fromSolarSystemId":30004718,"toSolarSystemId":30004711},{"fromSolarSystemId":30004719,"toSolarSystemId":30004718},{"fromSolarSystemId":30004720,"toSolarSystemId":30004719},{"fromSolarSystemId":30004721,"toSolarSystemId":30004718},{"fromSolarSystemId":30004722,"toSolarSystemId":30004719},{"fromSolarSystemId":30004723,"toSolarSystemId":30004720},{"fromSolarSystemId":30004724,"toSolarSystemId":30004717},{"fromSolarSystemId":30004725,"toSolarSystemId":30004724},{"fromSolarSystemId":30004726,"toSolarSystemId":30004725},{"fromSolarSystemId":30004727,"toSolarSystemId":30004725},{"fromSolarSystemId":30004728,"toSolarSystemId":30004726},{"fromSolarSystemId":30004729,"toSolarSystemId":30004725},{"fromSolarSystemId":30004730,"toSolarSystemId":30004716},{"fromSolarSystemId":30004731,"toSolarSystemId":30004730},{"fromSolarSystemId":30004732,"toSolarSystemId":30004731},{"fromSolarSystemId":30004733,"toSolarSystemId":30004732},{"fromSolarSystemId":30004734,"toSolarSystemId":30004731},{"fromSolarSystemId":30004735,"toSolarSystemId":30004730},{"fromSolarSystemId":30004736,"toSolarSystemId":30004731},{"fromSolarSystemId":30004736,"toSolarSystemId":30004732},{"fromSolarSystemId":30004737,"toSolarSystemId":30004717},{"fromSolarSystemId":30004738,"toSolarSystemId":30004737},{"fromSolarSystemId":30004739,"toSolarSystemId":30004738},{"fromSolarSystemId":30004740,"toSolarSystemId":30004708},{"fromSolarSystemId":30004740,"toSolarSystemId":30004737},{"fromSolarSystemId":30004740,"toSolarSystemId":30004738},{"fromSolarSystemId":30004741,"toSolarSystemId":30004739},{"fromSolarSystemId":30004742,"toSolarSystemId":30004740},{"fromSolarSystemId":30004743,"toSolarSystemId":30004742},{"fromSolarSystemId":30004744,"toSolarSystemId":30004728},{"fromSolarSystemId":30004745,"toSolarSystemId":30004744},{"fromSolarSystemId":30004746,"toSolarSystemId":30004745},{"fromSolarSystemId":30004747,"toSolarSystemId":30004744},{"fromSolarSystemId":30004748,"toSolarSystemId":30004745},{"fromSolarSystemId":30004748,"toSolarSystemId":30004747},{"fromSolarSystemId":30004749,"toSolarSystemId":30004745},{"fromSolarSystemId":30004749,"toSolarSystemId":30004746},{"fromSolarSystemId":30004750,"toSolarSystemId":30004722},{"fromSolarSystemId":30004751,"toSolarSystemId":30004750},{"fromSolarSystemId":30004752,"toSolarSystemId":30004751},{"fromSolarSystemId":30004753,"toSolarSystemId":30004751},{"fromSolarSystemId":30004754,"toSolarSystemId":30004753},{"fromSolarSystemId":30004755,"toSolarSystemId":30004752},{"fromSolarSystemId":30004756,"toSolarSystemId":30004754},{"fromSolarSystemId":30004757,"toSolarSystemId":30004751},{"fromSolarSystemId":30004757,"toSolarSystemId":30004755},{"fromSolarSystemId":30004758,"toSolarSystemId":30004756},{"fromSolarSystemId":30004759,"toSolarSystemId":30004735},{"fromSolarSystemId":30004760,"toSolarSystemId":30004759},{"fromSolarSystemId":30004761,"toSolarSystemId":30004760},{"fromSolarSystemId":30004762,"toSolarSystemId":30004759},{"fromSolarSystemId":30004763,"toSolarSystemId":30004761},{"fromSolarSystemId":30004764,"toSolarSystemId":30004762},{"fromSolarSystemId":30004765,"toSolarSystemId":30004759},{"fromSolarSystemId":30004765,"toSolarSystemId":30004760},{"fromSolarSystemId":30004766,"toSolarSystemId":30004746},{"fromSolarSystemId":30004767,"toSolarSystemId":30004766},{"fromSolarSystemId":30004768,"toSolarSystemId":30004766},{"fromSolarSystemId":30004769,"toSolarSystemId":30004766},{"fromSolarSystemId":30004770,"toSolarSystemId":30004766},{"fromSolarSystemId":30004770,"toSolarSystemId":30004767},{"fromSolarSystemId":30004770,"toSolarSystemId":30004768},{"fromSolarSystemId":30004771,"toSolarSystemId":30004769},{"fromSolarSystemId":30004772,"toSolarSystemId":30004736},{"fromSolarSystemId":30004773,"toSolarSystemId":30004772},{"fromSolarSystemId":30004774,"toSolarSystemId":30004772},{"fromSolarSystemId":30004774,"toSolarSystemId":30004773},{"fromSolarSystemId":30004775,"toSolarSystemId":30004773},{"fromSolarSystemId":30004775,"toSolarSystemId":30004774},{"fromSolarSystemId":30004776,"toSolarSystemId":30004774},{"fromSolarSystemId":30004777,"toSolarSystemId":30004774},{"fromSolarSystemId":30004778,"toSolarSystemId":30004722},{"fromSolarSystemId":30004779,"toSolarSystemId":30004778},{"fromSolarSystemId":30004780,"toSolarSystemId":30004779},{"fromSolarSystemId":30004781,"toSolarSystemId":30004780},{"fromSolarSystemId":30004782,"toSolarSystemId":30004781},{"fromSolarSystemId":30004783,"toSolarSystemId":30004778},{"fromSolarSystemId":30004784,"toSolarSystemId":30004749},{"fromSolarSystemId":30004785,"toSolarSystemId":30004784},{"fromSolarSystemId":30004786,"toSolarSystemId":30004785},{"fromSolarSystemId":30004787,"toSolarSystemId":30004785},{"fromSolarSystemId":30004787,"toSolarSystemId":30004786},{"fromSolarSystemId":30004788,"toSolarSystemId":30004787},{"fromSolarSystemId":30004789,"toSolarSystemId":30004786},{"fromSolarSystemId":30004789,"toSolarSystemId":30004787},{"fromSolarSystemId":30004790,"toSolarSystemId":30004779},{"fromSolarSystemId":30004791,"toSolarSystemId":30004790},{"fromSolarSystemId":30004792,"toSolarSystemId":30004790},{"fromSolarSystemId":30004792,"toSolarSystemId":30004791},{"fromSolarSystemId":30004793,"toSolarSystemId":30004790},{"fromSolarSystemId":30004794,"toSolarSystemId":30004791},{"fromSolarSystemId":30004794,"toSolarSystemId":30004792},{"fromSolarSystemId":30004794,"toSolarSystemId":30004793},{"fromSolarSystemId":30004795,"toSolarSystemId":30004792},{"fromSolarSystemId":30004796,"toSolarSystemId":30004782},{"fromSolarSystemId":30004797,"toSolarSystemId":30004796},{"fromSolarSystemId":30004798,"toSolarSystemId":30004797},{"fromSolarSystemId":30004799,"toSolarSystemId":30004796},{"fromSolarSystemId":30004799,"toSolarSystemId":30004798},{"fromSolarSystemId":30004800,"toSolarSystemId":30004798},{"fromSolarSystemId":30004801,"toSolarSystemId":30004796},{"fromSolarSystemId":30004801,"toSolarSystemId":30004799},{"fromSolarSystemId":30004802,"toSolarSystemId":30004801}];
    var systems = [{"name":"UHKL-N","id":30004706},{"name":"Z3V-1W","id":30004707},{"name":"A-ELE2","id":30004708},{"name":"KFIE-Z","id":30004709},{"name":"1DH-SX","id":30004710},{"name":"PR-8CA","id":30004711},{"name":"NOL-M9","id":30004712},{"name":"O-IOAI","id":30004713},{"name":"QX-LIJ","id":30004714},{"name":"HM-XR2","id":30004715},{"name":"4K-TRB","id":30004716},{"name":"AJI-MA","id":30004717},{"name":"FWST-8","id":30004718},{"name":"YZ9-F6","id":30004719},{"name":"0N-3RO","id":30004720},{"name":"G-TT5V","id":30004721},{"name":"319-3D","id":30004722},{"name":"I3Q-II","id":30004723},{"name":"RF-K9W","id":30004724},{"name":"E3OI-U","id":30004725},{"name":"IP6V-X","id":30004726},{"name":"R5-MM8","id":30004727},{"name":"1B-VKF","id":30004728},{"name":"T-J6HT","id":30004729},{"name":"D-W7F0","id":30004730},{"name":"JP4-AA","id":30004731},{"name":"FM-JK5","id":30004732},{"name":"PDE-U3","id":30004733},{"name":"23G-XC","id":30004734},{"name":"T5ZI-S","id":30004735},{"name":"4X0-8B","id":30004736},{"name":"Q-HESZ","id":30004737},{"name":"1-SMEB","id":30004738},{"name":"M5-CGW","id":30004739},{"name":"6Q-R50","id":30004740},{"name":"ZA9-PY","id":30004741},{"name":"RCI-VL","id":30004742},{"name":"MJXW-P","id":30004743},{"name":"QC-YX6","id":30004744},{"name":"T-M0FA","id":30004745},{"name":"4O-239","id":30004746},{"name":"LUA5-L","id":30004747},{"name":"T-IPZB","id":30004748},{"name":"Q-JQSG","id":30004749},{"name":"D-3GIQ","id":30004750},{"name":"K-6K16","id":30004751},{"name":"QY6-RK","id":30004752},{"name":"W-KQPI","id":30004753},{"name":"PUIG-F","id":30004754},{"name":"J-LPX7","id":30004755},{"name":"0-HDC8","id":30004756},{"name":"F-TE1T","id":30004757},{"name":"SVM-3K","id":30004758},{"name":"1DQ1-A","id":30004759},{"name":"8WA-Z6","id":30004760},{"name":"5BTK-M","id":30004761},{"name":"N-8YET","id":30004762},{"name":"Y-OMTZ","id":30004763},{"name":"3-DMQT","id":30004764},{"name":"MO-GZ5","id":30004765},{"name":"39P-1J","id":30004766},{"name":"HZAQ-W","id":30004767},{"name":"7G-QIG","id":30004768},{"name":"NIDJ-K","id":30004769},{"name":"PS-94K","id":30004770},{"name":"8RQJ-2","id":30004771},{"name":"KEE-N6","id":30004772},{"name":"M2-XFE","id":30004773},{"name":"5-CQDA","id":30004774},{"name":"I-E3TG","id":30004775},{"name":"S-6HHN","id":30004776},{"name":"ZXB-VC","id":30004777},{"name":"GY6A-L","id":30004778},{"name":"UEXO-Z","id":30004779},{"name":"9O-8W1","id":30004780},{"name":"8F-TK3","id":30004781},{"name":"PF-KUQ","id":30004782},{"name":"N8D9-Z","id":30004783},{"name":"F-9PXR","id":30004784},{"name":"Y5C-YD","id":30004785},{"name":"31X-RE","id":30004786},{"name":"Q-02UL","id":30004787},{"name":"7UTB-F","id":30004788},{"name":"5-6QW7","id":30004789},{"name":"7-K6UE","id":30004790},{"name":"C6Y-ZF","id":30004791},{"name":"6Z-CKS","id":30004792},{"name":"G-M5L3","id":30004793},{"name":"KBAK-I","id":30004794},{"name":"M-SRKS","id":30004795},{"name":"9GNS-2","id":30004796},{"name":"YAW-7M","id":30004797},{"name":"C3N-3S","id":30004798},{"name":"CX8-6K","id":30004799},{"name":"LWX-93","id":30004800},{"name":"1-2J4P","id":30004801},{"name":"M0O-JG","id":30004802}];
    var paths = [[30004712,0,[30004712]],[30004711,1,[30004712,30004711]],[30004713,1,[30004712,30004713]],[30004715,1,[30004712,30004715]],[30004710,2,[30004712,30004711,30004710]],[30004718,2,[30004712,30004711,30004718]],[30004714,2,[30004712,30004713,30004714]],[30004717,2,[30004712,30004715,30004717]],[30004707,3,[30004712,30004711,30004710,30004707]],[30004708,3,[30004712,30004711,30004710,30004708]],[30004719,3,[30004712,30004711,30004718,30004719]],[30004721,3,[30004712,30004711,30004718,30004721]],[30004716,3,[30004712,30004713,30004714,30004716]],[30004724,3,[30004712,30004715,30004717,30004724]],[30004737,3,[30004712,30004715,30004717,30004737]],[30004706,4,[30004712,30004711,30004710,30004707,30004706]],[30004709,4,[30004712,30004711,30004710,30004707,30004709]],[30004720,4,[30004712,30004711,30004718,30004719,30004720]],[30004722,4,[30004712,30004711,30004718,30004719,30004722]],[30004730,4,[30004712,30004713,30004714,30004716,30004730]],[30004725,4,[30004712,30004715,30004717,30004724,30004725]],[30004738,4,[30004712,30004715,30004717,30004737,30004738]],[30004740,4,[30004712,30004715,30004717,30004737,30004740]],[30004723,5,[30004712,30004711,30004718,30004719,30004720,30004723]],[30004750,5,[30004712,30004711,30004718,30004719,30004722,30004750]],[30004778,5,[30004712,30004711,30004718,30004719,30004722,30004778]],[30004731,5,[30004712,30004713,30004714,30004716,30004730,30004731]],[30004735,5,[30004712,30004713,30004714,30004716,30004730,30004735]],[30004726,5,[30004712,30004715,30004717,30004724,30004725,30004726]],[30004727,5,[30004712,30004715,30004717,30004724,30004725,30004727]],[30004729,5,[30004712,30004715,30004717,30004724,30004725,30004729]],[30004739,5,[30004712,30004715,30004717,30004737,30004738,30004739]],[30004742,5,[30004712,30004715,30004717,30004737,30004740,30004742]],[30004751,6,[30004712,30004711,30004718,30004719,30004722,30004750,30004751]],[30004779,6,[30004712,30004711,30004718,30004719,30004722,30004778,30004779]],[30004783,6,[30004712,30004711,30004718,30004719,30004722,30004778,30004783]],[30004732,6,[30004712,30004713,30004714,30004716,30004730,30004731,30004732]],[30004734,6,[30004712,30004713,30004714,30004716,30004730,30004731,30004734]],[30004736,6,[30004712,30004713,30004714,30004716,30004730,30004731,30004736]],[30004759,6,[30004712,30004713,30004714,30004716,30004730,30004735,30004759]],[30004728,6,[30004712,30004715,30004717,30004724,30004725,30004726,30004728]],[30004741,6,[30004712,30004715,30004717,30004737,30004738,30004739,30004741]],[30004743,6,[30004712,30004715,30004717,30004737,30004740,30004742,30004743]],[30004752,7,[30004712,30004711,30004718,30004719,30004722,30004750,30004751,30004752]],[30004753,7,[30004712,30004711,30004718,30004719,30004722,30004750,30004751,30004753]],[30004757,7,[30004712,30004711,30004718,30004719,30004722,30004750,30004751,30004757]],[30004780,7,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004780]],[30004790,7,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004790]],[30004733,7,[30004712,30004713,30004714,30004716,30004730,30004731,30004732,30004733]],[30004772,7,[30004712,30004713,30004714,30004716,30004730,30004731,30004736,30004772]],[30004760,7,[30004712,30004713,30004714,30004716,30004730,30004735,30004759,30004760]],[30004762,7,[30004712,30004713,30004714,30004716,30004730,30004735,30004759,30004762]],[30004765,7,[30004712,30004713,30004714,30004716,30004730,30004735,30004759,30004765]],[30004744,7,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744]],[30004754,8,[30004712,30004711,30004718,30004719,30004722,30004750,30004751,30004753,30004754]],[30004755,8,[30004712,30004711,30004718,30004719,30004722,30004750,30004751,30004757,30004755]],[30004781,8,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004780,30004781]],[30004791,8,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004790,30004791]],[30004792,8,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004790,30004792]],[30004793,8,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004790,30004793]],[30004773,8,[30004712,30004713,30004714,30004716,30004730,30004731,30004736,30004772,30004773]],[30004774,8,[30004712,30004713,30004714,30004716,30004730,30004731,30004736,30004772,30004774]],[30004761,8,[30004712,30004713,30004714,30004716,30004730,30004735,30004759,30004760,30004761]],[30004764,8,[30004712,30004713,30004714,30004716,30004730,30004735,30004759,30004762,30004764]],[30004745,8,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745]],[30004747,8,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004747]],[30004756,9,[30004712,30004711,30004718,30004719,30004722,30004750,30004751,30004753,30004754,30004756]],[30004782,9,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004780,30004781,30004782]],[30004795,9,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004790,30004792,30004795]],[30004794,9,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004790,30004793,30004794]],[30004775,9,[30004712,30004713,30004714,30004716,30004730,30004731,30004736,30004772,30004774,30004775]],[30004776,9,[30004712,30004713,30004714,30004716,30004730,30004731,30004736,30004772,30004774,30004776]],[30004777,9,[30004712,30004713,30004714,30004716,30004730,30004731,30004736,30004772,30004774,30004777]],[30004763,9,[30004712,30004713,30004714,30004716,30004730,30004735,30004759,30004760,30004761,30004763]],[30004746,9,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004746]],[30004749,9,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004749]],[30004748,9,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004747,30004748]],[30004758,10,[30004712,30004711,30004718,30004719,30004722,30004750,30004751,30004753,30004754,30004756,30004758]],[30004796,10,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004780,30004781,30004782,30004796]],[30004766,10,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004746,30004766]],[30004784,10,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004749,30004784]],[30004797,11,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004780,30004781,30004782,30004796,30004797]],[30004799,11,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004780,30004781,30004782,30004796,30004799]],[30004801,11,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004780,30004781,30004782,30004796,30004801]],[30004767,11,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004746,30004766,30004767]],[30004768,11,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004746,30004766,30004768]],[30004769,11,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004746,30004766,30004769]],[30004770,11,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004746,30004766,30004770]],[30004785,11,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004749,30004784,30004785]],[30004798,12,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004780,30004781,30004782,30004796,30004799,30004798]],[30004802,12,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004780,30004781,30004782,30004796,30004801,30004802]],[30004771,12,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004746,30004766,30004769,30004771]],[30004786,12,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004749,30004784,30004785,30004786]],[30004787,12,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004749,30004784,30004785,30004787]],[30004800,13,[30004712,30004711,30004718,30004719,30004722,30004778,30004779,30004780,30004781,30004782,30004796,30004799,30004798,30004800]],[30004788,13,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004749,30004784,30004785,30004787,30004788]],[30004789,13,[30004712,30004715,30004717,30004724,30004725,30004726,30004728,30004744,30004745,30004749,30004784,30004785,30004787,30004789]]];

    var graph = {
        nodes: systems,
        links: jumps.map(function(j) {
            return {
                source: systems.filter(function(s) { return s.id === j.fromSolarSystemId; })[0],
                target: systems.filter(function(s) { return s.id === j.toSolarSystemId; })[0]
            };
        })
    };

    var width = 760,
        height = 500;

    var force = d3.layout.force()
        .charge(-50)
        .linkDistance(20)
        .gravity(.1)
        .size([width, height]);

    var svg = d3.select("svg")
        .attr("width", width)
        .attr("height", height);

    force
        .nodes(graph.nodes)
        .links(graph.links)
        .start();

    var link = svg.append('g').selectAll(".link")
            .data(graph.links)
        .enter().append("line")
            .attr("class", "link")
            .style({
                stroke: "#000",
                "stroke-width": "2"
            });

    var pathContainer = svg.append('g').attr("class", "path");
    var path = pathContainer.selectAll("line");

    var node = svg.append('g').selectAll(".node")
            .data(graph.nodes)
        .enter().append("circle")
            .attr("class", "node")
            .attr("r", 5)
            .style({
                fill: "#00F",
                stroke: "#FFF",
                "stroke-width": 2
            })
            .call(force.drag);

    node.append("title")
        .text(function(d) { return d.name; });

    force.on("tick", function() {
        link.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        node.attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });

        path.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
    });

    var pathIndex = 0;
    var segments = [];
    var duration = 250;
    var advancePath = function() {
        var p = paths[pathIndex][2];

        if (pathIndex === 0) {
            segments = [];
        }

        if (p.length > 1) {
            var segment = p.slice(-2);
            segments.push({
                source: systems.filter(function(s) { return s.id === segment[0]; })[0],
                target: systems.filter(function(s) { return s.id === segment[1]; })[0]
            });
        }

        path = pathContainer.selectAll("line").data(segments);

        path.enter()
            .append("line")
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; })
            .style({
                stroke: "#F00",
                "stroke-width": "2"
            })
            .transition().duration(duration)
                .style({stroke: "#0F0"});

        path.exit().remove();

        node.style("fill", function(d) {
            if(d.id === 30004712) { return "#F00" };
            return segments.filter(function(s) { return s.target.id === d.id; }).length > 0 ? "#0F0" : "#00F";
        });

        pathIndex = (pathIndex + 1) % paths.length;

        if(pathIndex === 0) {
            setTimeout(advancePath, 5000);
        } else {
            setTimeout(advancePath, duration);
        }
    };

    setTimeout(advancePath, 5000);

})(window);