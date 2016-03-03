/**
 * Created by Varun Seereeram on 9/16/15.
 */

//Next
var nxApp;
var topo;

// REST Config
var username = 'admin';
var password = 'admin';

var dmoOpUrl = '/api/restconf/operational/dmoc:dmo-topology';
var dmoConfigUrl = '/api/restconf/config/dmoc:dmo-topology';
var nameConfigUrl = '/api/restconf/operations/dmoc:config-node';
var obdConfigUrl = '/api/restconf/operations/dmoc:config-obd-pid';
var groupsUrl = ''; //TODO: CHANGE to correct address
var newGroupUrl = ''; //TODO: Change to correct address

// Internal Configurations
var anchorName = 'IoT VizConf';
