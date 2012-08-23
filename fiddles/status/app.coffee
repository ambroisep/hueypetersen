demo = angular.module('demo', [])

demo.directive('timeline', () ->
  (scope, element, attrs) ->

    timelineLength = 2000
    timelinePadding = 20
    connectionWidth = 50
    timelineWidth = 6
    connectionPadding = 2
    eventHeader = 15


    startTime = moment([2012, 7, 9]).sod() # 2012-8-9 ... f js
    endTime = moment([2012, 7, 9]).eod()

    # console.log startTime.format(), endTime.format()

    y = d3.time.scale().domain([endTime, startTime]).range([timelinePadding, timelineLength + timelinePadding])

    $svg = d3.select(element[0]).append('svg').attr('width', '200px').attr('height', timelinePadding * 2 + timelineLength)
    $timeline = $svg.append('g').attr('class', 'timeline')
    $vline = $timeline.append('svg:line')
      .attr('class', 'vline')
      .attr('x1', timelinePadding)
      .attr('x2', timelinePadding)
      .attr('y1', timelinePadding)
      .attr('y2', timelinePadding + timelineLength)

    bubbleRadius = 7

    $timeline.append('svg:circle')
      .attr('class', 'vbubble')
      .attr('cx', timelinePadding)
      .attr('cy', timelinePadding - bubbleRadius)
      .attr('r', bubbleRadius)

    $timeline.append('svg:circle')
      .attr('class', 'vbubble')
      .attr('cx', timelinePadding)
      .attr('cy', timelinePadding + timelineLength - bubbleRadius)
      .attr('r', bubbleRadius)

    $lineEvents = $timeline.append('g').attr('class', 'lineEvents')

    $connections = $timeline.append('g').attr('class', 'connections')

    layout = (datas, o) ->
      console.log 'layout!'
      $events = $(element).find('.event')

      # go from top to bottom setting positioning each element in the timeline
      # avoid overlap by passing the bottom of the element to the next element
      # so it can check if it overlaps and adjust accordingly
      [tops, bottomOfLastElement] = d3.zip(datas, $events.toArray()).reduce((previous, current) ->
        $current = $(current[1])
        data = current[0]
        tops = previous[0]
        previousBottom = previous[1]

        linearTop = y(moment(data.endTime)) # just scale by time -- can result in overlap
        top = d3.max([previousBottom, linearTop]) # avoid overlap by picking the larger of the two

        $current.css('top', top - eventHeader + 'px')

        bottom = top + $current.outerHeight(true)
        tops.push(top)
        [tops, bottom]
      , [[], 0]) # initialize with an empty array of tops and a zero for the starting bottom

      # console.log tops, bottomOfLastElement

      # console.log datas

      $svg.attr('height', d3.max([bottomOfLastElement, timelineLength + timelinePadding * 2]))

      positionLineEvent = (selection) ->
        selection
          .attr('class', (d) -> "lineEvent #{d.severity}")
          .attr('x', timelinePadding - timelineWidth/2)
          .attr('y', (d, i) -> y(moment(d.endTime)))
          .attr('width', timelineWidth)
          .attr('height', (d, i) -> y(moment(d.startTime)) - y(moment(d.endTime)))

      $f = $lineEvents.selectAll('.lineEvent')
        .data(datas)
        .call(positionLineEvent)

      $f.enter()
          .append('svg:rect')
          .call(positionLineEvent)

      diagonal = d3.svg.diagonal()
                        .source((d) -> { y: timelinePadding + timelineWidth / 2 + connectionPadding, x: y(moment(d[0].endTime)) + connectionPadding })
                        .target((d) -> { y: connectionWidth - connectionPadding, x: d[1] + connectionPadding })
                        .projection((d) -> [d.y, d.x])

      $c = $connections.selectAll('.connection')
        .data(d3.zip(datas, tops))
        .attr('d', diagonal)

      $c.enter()
        .append('svg:path')
        .attr('class', 'connection')
        .attr('d', diagonal)


    delayedLayout = (n, o) ->
      setTimeout((-> layout(n, o)), 1)

    scope.$watch 'events', delayedLayout
    # scope.$watch 'events', layout

)

TimelineController = ($scope) ->

  descendingTime = (t1, t2) ->
    if moment(t1.endTime) < moment(t2.endTime)
      1
    else if moment(t1.endTime) > moment(t2.endTime)
      -1
    else
      0

  $scope.events = [
    startTime: "2012-08-09T03:10:00"
    endTime: "2012-08-09T03:55:00"
    severity: "medium"
    headline: "Shared Database Server Offline"
    summary: "The database server is back online with no data loss."
  ,
    startTime: "2012-08-09T10:30:00"
    endTime: "2012-08-09T10:40:00"
    severity: "high"
    headline: "Issues Provisioning Legacy Shared Database"
    summary: "The issue has been resolved."
  ,
    startTime: "2012-08-09T12:30:00"
    endTime: "2012-08-09T14:40:00"
    severity: "info"
    headline: "Lunch"
    summary: "Meatball sub was enjoyed."
  ,
    startTime: "2012-08-09T21:30:00"
    endTime: "2012-08-09T21:40:00"
    severity: "low"
    headline: "Issues Provisioning Legacy Shared Database"
    summary: "The issue has been resolved."
  ,
    startTime: "2012-08-09T21:45:00"
    endTime: "2012-08-09T22:50:00"
    severity: "high"
    headline: "SSL Hostname Issue"
    summary: "We are continuing to optimize our load balancer configuration, but due to changes already made, applications are still seeing an issue with SSL connectivity, please open a support tick."
  ,
    startTime: "2012-08-09T23:10:00"
    endTime: "2012-08-09T23:50:00"
    severity: "high"
    headline: "Elevated SSL Hostname Error Rates"
    summary: "The majority of SSL hostnames are operating normally.  We have directly contacted a small number of affected customers to resolve this issue one-on-one."
  ].sort(descendingTime)

  $scope.timelineLength = 2000

  $scope.duration = (event) ->
    start = moment(event.startTime)
    end = moment(event.endTime)
    duration = end.diff(start)
    moment.duration(duration).humanize()

  $scope.eventTime = (event) ->
    start = moment(event.startTime)
    start.format("MMM D, YYYY HH:mm")

  randomNumber = (min, max) ->
    range = max - min + 1
    Math.floor(range * Math.random()) + min

  randomSeverity = () ->
    n = randomNumber(0, 3)
    ["info", "low", "medium", "high"][n]

  zeroFill = (n, w) ->
    ns = n.toString()
    while ns.length < w
      ns = "0" + ns
    ns

  $scope.addEvent = () ->
    startTime = moment("2012-08-09T#{zeroFill($scope.eventStartTimeHour, 2)}:#{zeroFill($scope.eventStartTimeMinute, 2)}:00")
    endTime = moment(startTime).add('m', $scope.eventDuration)

    event = {
      headline: $scope.eventHeadline
      summary: $scope.eventSummary
      severity: $scope.eventSeverity
      startTime: startTime.format()
      endTime: endTime.format()
    }
    $scope.events = $scope.events.concat(event).sort(descendingTime)

  $scope.addRandomEvent = () ->
    hour = randomNumber(0, 23)
    minute = randomNumber(0, 59)
    duration = randomNumber(0, 30)

    startTime = moment("2012-08-09T#{zeroFill(hour, 2)}:#{zeroFill(minute, 2)}:00")
    endTime = moment(startTime).add('m', duration)

    if endTime.day() != startTime.day()
      endTime = endTime.day(startTime.day()).eod()

    event = {
      headline: "Not a big deal"
      summary: "I wouldn't worry about it!"
      severity: randomSeverity()
      startTime: startTime.format()
      endTime: endTime.format()
    }
    $scope.events = $scope.events.concat(event).sort(descendingTime)
    console.log $scope.events

  return