var processTopologyData = function(receivedData) {
    function Link (source, target) { // Creates a Link Class
        this.source = source;
        this.target = target;
    }

    // Creates a topo data object
    var topoData = {
        nodes:(receivedData['dmo-topology'])['node']
    };

    //inserts node at beginning (anchor node - IoT VizConf).
    topoData.nodes.unshift({
        name: anchorName,
        scale: 2,
        x: 75,
        y: 0
    });

    topoData.links = []; //Creating Link array

    for (var selectedNode=1; selectedNode<topoData.nodes.length; selectedNode++) { //start from 1, as 0(anchor) was already set.
        var currentNode = topoData.nodes[selectedNode]; //gets current node
        currentNode.scale = 1; //sets icon scale
        currentNode.dmoNodeId = currentNode['dmo-node-id']; //get node id
        currentNode.obdVendorString = currentNode['obd-vendor-string']; //get obd vendor string
        currentNode.label = 'ID: '+currentNode.dmoNodeId; //assign label
        delete currentNode['dmo-node-id'];
        delete currentNode['obd-vendor-string'];
        topoData.links.push(new Link(0,selectedNode)); //Adds links from anchor to each node
    }
    return topoData;
};

var processSensorData = function(receivedData) {
    var sensorArray = [];
    for (var sensor = 0; sensor < receivedData.length; sensor++) {
      sensorArray.push(JSON.parse(receivedData[sensor]['content-json-string'])); //parses sensor data received and pushes sensors into an array
    }
    return sensorArray; // returns array
};