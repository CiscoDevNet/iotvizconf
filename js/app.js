(function(angular) {

    // defining angular module 'iotvizconf', with ngMaterial and leaflet-directive as dependencies
    // ngMaterial supplies material design and leaflet-directive supplies a directive for leaflet maps
    angular.module('iotvizconf', ['ngMaterial', 'leaflet-directive'])

        // configures the color theme in cyan and orange
        .config(function($mdThemingProvider) {
            $mdThemingProvider.theme('default')
                .primaryPalette('cyan')
                .accentPalette('orange');
        })

        // defines a gps service which handles the setting/storing of gps markers
        .service('gpsService', function() {
            this.markers = []; // holds the markers for geographical map
            this.center = { // holds the map's startup coordinates (over USA)
                lat: 38,
                lng: -97,
                zoom: 4
            };
            // the setGPS function is called when the data is loaded from the HTTP request
            // it processes that data and pushes it into an array for the leaflet directive
            this.setGps = function(nodes) {
                for (var x=0;x<nodes.length;x++) { //for every node...
                    if (nodes[x]['latitude'] && nodes[x]['longitude']) { //if a lat % long exists...

                        //push object into 'markers' array
                        this.markers.push({
                            lat: parseFloat(nodes[x]['latitude']),
                            lng: parseFloat(nodes[x]['longitude']),
                            focus: true,
                            message: 'DMO: '+nodes[x].dmoNodeId,
                            draggable: false,
                            icon: {
                                iconUrl: 'resources/truck-marker.png'
                            }
                        });
                    }
                }
            }
        })

        //toast service which supplies push notification
        .service('toastService', function($mdToast) {
            this.showToast = function(content) { //showToast method displays the notification
                var toast = $mdToast.simple()
                    .content(content)
                    .action('OK')
                    .position('bottom left');
                $mdToast.show(toast);
            }
        })

        //httpService provides methods which carry out http requests for the app.
        .service('httpService', function(dataService, gpsService, toastService, $http, $log) {

            //does a POST with configuration of the dmo
            this.updateDmoConfig = function(dmo, cancelCallback) {
                $http.post(nameConfigUrl,
                    '{"input": { "dmo-node-id": "'+dmo.dmoNodeId+'", "name": "'+dmo.name+'", "config-oper": CONFIG, "operation" : "CREATE-UPDATE" }}',
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            "Authorization": "Basic " + btoa(username + ":" + password)
                        }
                    }).then(function successCallback(response) {
                    $log.info(response);
                    if (response.data.output.status === 'OK') {

                        //show notification once successful
                        toastService.showToast('Updated!');
                        cancelCallback(true);
                    } else {

                        //show an error notification if unsuccessful
                        toastService.showToast('Error updating.');
                        cancelCallback(false);
                    }
                }, function errorCallback(response) {
                    //show an error notification if unsuccessful
                    toastService.showToast('An error occured.');
                    $log.error(response);

                    cancelCallback(false);
                });
            };

            //does an HTTP GET to retrieve pre-configured data (from past policy settings) and fills in that data.
            this.getSensorPreConfigData = function(sensorConfigData, finishedRetrievingPreConfigData) {
                $http.get(dmoConfigUrl+'/node/'+sensorConfigData.dmoNodeId, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": "Basic " + btoa(username + ":" + password),
                        "X-M2M-Origin":'dmo',
                        "X-M2M-RI":'dmo'
                    }
                }).then(function successCallback(response) {
                    var allPids = response.data.node[0]['obd-pids'];
                    var matchedPid = _.find(allPids, { 'pid': sensorConfigData.pid.toString() });
                    if (matchedPid) {
                        console.log(matchedPid);
                        var preConfigData = JSON.parse(matchedPid['content-json-string']);
                        // fills in pre configured policies
                        sensorConfigData.dest = preConfigData.obd_data_collector_ip_address;
                        sensorConfigData.timer = preConfigData.obd_pid_timer;
                        sensorConfigData.sendData = preConfigData.obd_send_data;
                    }
                    finishedRetrievingPreConfigData(true);
                }, function errorCallback(response) {
                    console.log(response);
                    finishedRetrievingPreConfigData(false);
                });
            };

            //does an HTTP POST of configured policy data
            this.updatePolicies = function(sensorConfigData, finishedUpdatingSuccessfully) {
                $http.post(obdConfigUrl,
                    '{"input": { "dmo-node-id": "'+sensorConfigData.dmoNodeId+'", "pid": "'+sensorConfigData.pid+'", "data-collector-ip-address": "'+sensorConfigData.dest+'", "timer" :"'+sensorConfigData.timer+'", "send-data" : "'+sensorConfigData.sendData+'", "operation" : "CREATE-UPDATE" }}',
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            "Authorization": "Basic " + btoa(username + ":" + password)
                        }
                    }).then(function successCallback(response) {
                    $log.info(response);
                    if (response.data.output.status === 'OK') {
                        toastService.showToast('Policies updated!'); //show toast notification is successful
                        finishedUpdatingSuccessfully(true);
                    } else {
                        toastService.showToast('Error updating policies.'); //show error notification if unsuccessful
                        finishedUpdatingSuccessfully(false);
                    }
                }, function errorCallback(response) {
                    toastService.showToast('An error occured.'); //show error notification if unsuccessful
                    $log.error(response);
                    finishedUpdatingSuccessfully(false);
                });
            };

            this.getDmoData = function(finishedLoadingDmoData) {
                //does an HTTP GET for all DMO devices
                $http.get(dmoOpUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": "Basic " + btoa(username + ":" + password)
                    }
                }).then(function successCallback(response) {

                    // processes that data and stored in topologyData
                    dataService.setTopologyData(processTopologyData(response.data));

                    //does another HTTP GET for the configuration settings for the DMO devices (eg. names configured by the user).
                    $http.get(dmoConfigUrl, {
                        headers: {
                            'Content-Type': 'application/json',
                            "Authorization": "Basic " + btoa(username + ":" + password)
                        }
                    }).then(function successCallback(response) {
                        dataService.names = response.data['dmo-topology'].node;

                        //for each name, match and assign it to the DMO device internal datastore.
                        for (var x = 0; x < dataService.nodes.length; x++) {
                            dataService.nodes[x].name = _.result(_.find(dataService.names, { 'dmo-node-id': dataService.nodes[x].dmoNodeId }), 'name');
                            //angular.forEach(dataService.nodes, function (node) {
                            //    node.dmoNodeIdFloat = parseFloat(node.dmoNodeId);
                            //});
                        }
                        //sets GPS location
                        gpsService.setGps(dataService.nodes);
                        finishedLoadingDmoData(); //callback
                    }, function errorCallback(response) {
                        $log.error(response); // log an error it unsuccessful
                        finishedLoadingDmoData(); //callback
                    });
                }, function errorCallback(response) {
                    $log.error(response); // log an error it unsuccessful
                    dataService.topologyData=[];
                    finishedLoadingDmoData()
                });
            };
        })
        .service('dataService', function() {
            nx.graphic.Icons.registerIcon("truck", "resources/moddedtruck.svg", 45, 45); //registers truck icon
            this.topo = new nx.graphic.Topology({ //creates topology with configuration
                adaptive:true,
                scalable: true,
                theme:'blue', //set theme to blue
                enableGradualScaling:true,
                nodeConfig: {
                    label: 'model.label', //set label
                    scale: 'model.scale', //set scale
                    color: '#00bcd4', //set color
                    iconType:function(vertex) { //assigns icon type
                        if (vertex.get("name") === anchorName) {
                            return 'host'
                        } else {
                            return 'truck'
                        }
                    }
                },
                linkConfig: {
                    color: '#00bcd4',
                    linkType: 'parallel'
                },
                showIcon: true,
                dataProcessor:'force', //auto layout, with 'force'
                autoLayout: true,
                enableSmartNode: true
            });
            this.nxApp = new nx.ui.Application;
            this.nxApp.container(document.getElementById('next-app')); //assigns element to div with id 'next-app'
            this.topologyData = undefined;
            this.names = undefined;
            this.sensorData = undefined;
            this.nodes = [];
            this.setTopologyData = function(topoData) { //sets topology data
                this.topologyData = topoData;
                angular.copy(_.slice(this.topologyData.nodes,1), this.nodes); //removes anchor by copying data starting from index '1' of the array
                this.topo.data(this.topologyData); //sets data to the NeXt topology
                this.topo.attach(this.nxApp); // attaches the NeXt topology
            };
        })

        //Main App Controller
        .controller('AppController',['$timeout', '$mdSidenav', '$log', '$mdDialog', '$mdToast', 'gpsService', 'dataService',
            function ($timeout, $mdSidenav, $log, $mdDialog, $mdToast, gpsService, dataService) {
                var vm = this;

                vm.geo = false;
                vm.center = gpsService.center;
                vm.markers = gpsService.markers;


                dataService.topo.on('topologyGenerated', function() { //when topology is generated...
                    dataService.topo.tooltipManager().showNodeTooltip(false); //disable tooltip (node)
                    dataService.topo.tooltipManager().showLinkTooltip(false); //disable tooltip (link)
                    dataService.topo.on('clickNode',function(topo,node) {
                        console.log(node.model().get());
                        if(!node.model().get().dmoNodeId) {
                            dataService.topo.tooltipManager().nodeTooltip().close();
                        }
                    });
                    window.addEventListener('resize', function(){
                        dataService.topo.adaptToContainer(); //adapt to container on window resize...
                    });
                });

                //opens right panel
                vm.openRight = function() {
                    $mdSidenav('right').open();
                };

                //toggles left panel
                vm.toggleLeft = function() {
                    $mdSidenav('left').toggle();
                };

                //function called when use clicks 'configure' on DMO Card (left hand side)
                vm.openDmoDialog = function(receivedDmo) {
                    //show dialog
                    $mdDialog.show({
                            controller: function(httpService) {
                                var vm = this;
                                vm.waiting = false;
                                vm.dmo = receivedDmo;

                                //function called when the cancel button ( 'x' in the top right) is clicked
                                vm.cancel = function() {
                                    $mdDialog.cancel();
                                };

                                vm.finishedUpdatingSuccessfully = function(success) {
                                    vm.waiting = false;
                                    if (success) {
                                        vm.cancel();
                                    }
                                };

                                //function called when the update button is clicked
                                vm.updateConfig = function() {
                                    vm.waiting = true;

                                    //send a POST with the entered content in the form field
                                    httpService.updateDmoConfig(vm.dmo, vm.finishedUpdatingSuccessfully);
                                };
                            },
                            controllerAs: 'DmoDialogCtrl',
                            templateUrl: '../templates/dmo-dialog-template.html',
                            parent: angular.element(document.body),
                            clickOutsideToClose:true
                        })
                };

                // function called when user clicks 'set policy' on a sensor card (right hand side)
                vm.openSensorDialog = function(receivedSensor, receivedDmoNodeId) {

                    // show dialog
                    $mdDialog.show({
                            controller: function(httpService) {
                                var vm = this;
                                vm.waiting = false;
                                vm.waitingPreConfig = true;
                                vm.sensor = receivedSensor;
                                vm.dmoNodeId = receivedDmoNodeId;
                                console.log(receivedSensor);

                                //stores configuration data (policies)
                                vm.sensorConfigData = {
                                    ip: receivedSensor['http_addr'],
                                    dmoNodeId: receivedDmoNodeId,
                                    pid: vm.sensor.pid,
                                    dest: '',
                                    timer: '',
                                    sendData: false
                                };

                                vm.cancel = function() {
                                    $mdDialog.cancel();
                                };

                                vm.finishedRetrievingPreConfigData = function() {
                                    vm.waitingPreConfig = false;
                                };

                                vm.finishedUpdatingSuccessfully = function(success) {
                                    vm.waiting = false;
                                    if (success) {
                                        vm.cancel();
                                    }
                                };

                                //retrieve sensor's pre-configuration data
                                httpService.getSensorPreConfigData(vm.sensorConfigData, vm.finishedRetrievingPreConfigData);

                                // function called when user clicks the 'update' policy button
                                vm.updatePolicies = function() {
                                    vm.waiting = true;
                                    $log.info(vm.sensorConfigData);

                                    //calls http service to update policies. Callback passed (finishedUpdatingSuccessfully)
                                    httpService.updatePolicies(vm.sensorConfigData, vm.finishedUpdatingSuccessfully);
                                };

                            },
                            controllerAs: 'SensorDialogCtrl',
                            templateUrl: '../templates/sensor-dialog-template.html',
                            parent: angular.element(document.body),
                            clickOutsideToClose:true
                        })
                };
        }])

        //directive handles the dmo cards (left hand side)
        .directive('dmoCard', function() {
            return {
                restrict: 'E',
                templateUrl: '../templates/dmo-card-template.html',
                controller: function(httpService, dataService) {
                    var vm = this;
                    vm.waiting = true;
                    vm.nodes = dataService.nodes;
                    vm.finishedLoadingDmoData = function(data) {
                        vm.waiting = false;
                        vm.targetData = data;
                    };
                    httpService.getDmoData(vm.finishedLoadingDmoData); //retrieves dmo data
                },
                controllerAs: 'DmoCtrl'
            }
        })

        .directive('sensorCard', function() {
            return {
                restrict: 'E',
                templateUrl: '../templates/sensor-card-template.html'
            }
        })

        //Controller to manage sensors.
        .controller('SensorController',['$log','dataService', function($log, dataService) {
            var vm = this;
            vm.waiting = false;
            vm.targetDmoNodeId = "";
            vm.obdVendorString = "";

            // function called when the user clicks 'view sensors'
            vm.loadSensors = function(dmo) {
                var dmoNodeId = dmo.dmoNodeId;
                //searches topologyData nodes and matches dmo ID
                var sensorData= _.result(_.find(dataService.topologyData.nodes, { 'dmoNodeId': dmoNodeId }), 'obd-pids');
                if (sensorData) { //if there was a match..
                    $log.log('Success! Sensor data loaded!');
                    vm.targetData = processSensorData(sensorData); //set targetData
                    vm.targetDmoNodeId = dmoNodeId;
                    vm.obdVendorString = dmo.obdVendorString;
                } else {
                    $log.error('Sensor Data Error.. Yikes!');
                    vm.targetData = {};
                    vm.dmoNodeId = "";
                    vm.obdVendorString = "";
                }
            }
        }]);
})(angular);