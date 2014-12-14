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
                        var recv_pretty = '?';
                        if (raw.recv_time) {
                            recv_pretty = new Date(raw.recv_time * 1000).toISOString();
                        }
                        return {
                            raw: raw,
                            pretty: rowTime.toISOString(),
                            recv_pretty: recv_pretty,
                            minsAgo: (now - (+rowTime)) / 1000 / 60,
                            user_trunc: raw.user.replace(/.*[#\/]/, '')
                        };
                    });
                                                      
                });
        }
        $scope.refresh();
        $scope.$watch('userSubstr', $scope.refresh);
    })
