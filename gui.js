angular
    .module('app', [])
    .controller('ctrl', function ($scope, $http) {
        $scope.userSubstr = "";
        $scope.status = "start";
        $scope.refresh = function () {
            $scope.status = "fetching . . .";
            $http.get('events', {params: {'userSubstr': $scope.userSubstr}})
                .success(function (result) {
                    $scope.status = "got "+result.events.length+" rows";
                    var now = +new Date();
                    $scope.events = result.events.map(function (raw) {
                        var rowTime = new Date(raw.timestamp);
                        return {
                            raw: raw,
                            pretty: rowTime.toISOString(),
                            minsAgo: (now - (+rowTime)) / 1000 / 60
                        };
                    });
                                                      
                });
        }
        $scope.refresh();
        $scope.$watch('userSubstr', $scope.refresh);
    })
