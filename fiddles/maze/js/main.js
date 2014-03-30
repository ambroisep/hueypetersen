(function() {
  var GridBorder, GridComponent, GridPath, GridPathSegment, GridWall, GridWallGroups, GridWalls, g, line, m, map, rand_nth, rg, svg, time, _ref;

  _ref = React.DOM, svg = _ref.svg, g = _ref.g, line = _ref.line;

  m = mori;

  rand_nth = function(coll) {
    return m.nth(coll, (Math.random() * m.count(coll)) | 0);
  };

  rg = (function() {
    var adjacent_offsets, borders, cells, create, neighbors, offset_positions, position_offsets, remove_wall, wall_groups, walls, _add_borders, _adjacent_cells, _diff, _group_size, _wall_group_hash;
    adjacent_offsets = m.vector(m.vector(0, 1), m.vector(0, -1), m.vector(1, 0), m.vector(-1, 0));
    offset_positions = m.hash_map(m.vector(0, -1), 'north', m.vector(0, 1), 'south', m.vector(1, 0), 'east', m.vector(-1, 0), 'west');
    position_offsets = m.hash_map('north', m.vector(0, -1), 'south', m.vector(0, 1), 'east', m.vector(1, 0), 'west', m.vector(-1, 0));
    _diff = function(a, b) {
      return b - a;
    };
    _adjacent_cells = function(cells, cell) {
      var possible_cells;
      possible_cells = m.set(m.map((function(offset) {
        return m.into(m.vector(), m.map(m.sum, cell, offset));
      }), adjacent_offsets));
      return m.intersection(possible_cells, cells);
    };
    _add_borders = function(borders, cells, direction) {
      return m.into(borders, m.map((function(c) {
        return m.vector(c, direction);
      }), cells));
    };
    _group_size = 5;
    _wall_group_hash = function(wall) {
      var x, y;
      x = m.get_in(wall, [0, 0]);
      y = m.get_in(wall, [0, 1]);
      return m.vector((x / _group_size) | 0, (y / _group_size) | 0);
    };
    create = function(width, height) {
      var borders, cells, connections, east, north, south, wall_groups, walls, west, xs, ys;
      xs = m.range(0, width);
      ys = m.range(0, height);
      cells = m.set(m.mapcat((function(x) {
        return m.map((function(y) {
          return m.vector(x, y);
        }), ys);
      }), xs));
      connections = m.into(m.hash_map(), m.map((function(cell) {
        return m.vector(cell, m.set(_adjacent_cells(cells, cell)));
      }), cells));
      walls = m.reduce_kv((function(ws, cell, neighbors) {
        return m.into(ws, m.map((function(n) {
          return m.vector(cell, m.get(offset_positions, m.map(_diff, cell, n)));
        }), neighbors));
      }), m.set(), connections);
      north = m.map((function(x) {
        return m.vector(x, 0);
      }), xs);
      south = m.map((function(x) {
        return m.vector(x, height - 1);
      }), xs);
      west = m.map((function(y) {
        return m.vector(0, y);
      }), ys);
      east = m.map((function(y) {
        return m.vector(width - 1, y);
      }), ys);
      borders = m.pipeline(m.set(), m.curry(_add_borders, north, 'north'), m.curry(_add_borders, south, 'south'), m.curry(_add_borders, east, 'east'), m.curry(_add_borders, west, 'west'));
      wall_groups = m.reduce((function(groups, wall) {
        return m.update_in(groups, [_wall_group_hash(wall)], m.fnil(m.conj, m.set()), wall);
      }), m.hash_map(), walls);
      return m.hash_map('cells', cells, 'connections', connections, 'walls', walls, 'borders', borders, 'wall_groups', wall_groups);
    };
    borders = function(grid) {
      return m.get(grid, 'borders');
    };
    walls = function(grid) {
      return m.get(grid, 'walls');
    };
    cells = function(grid) {
      return m.get(grid, 'cells');
    };
    wall_groups = function(grid) {
      return m.vals(m.get(grid, 'wall_groups'));
    };
    neighbors = function(grid, cell) {
      return m.get_in(grid, ['connections', cell]);
    };
    remove_wall = function(grid, cell1, cell2) {
      var cell1_direction, cell2_direction, wall1, wall2;
      cell1_direction = m.get(offset_positions, m.map(_diff, cell1, cell2));
      cell2_direction = m.get(offset_positions, m.map(_diff, cell2, cell1));
      wall1 = m.vector(cell1, cell1_direction);
      wall2 = m.vector(cell2, cell2_direction);
      return m.pipeline(grid, m.curry(m.update_in, ['connections', cell1], m.disj, cell2), m.curry(m.update_in, ['connections', cell2], m.disj, cell1), m.curry(m.update_in, ['walls'], m.disj, wall1), m.curry(m.update_in, ['walls'], m.disj, wall2), m.curry(m.update_in, ['wall_groups', _wall_group_hash(wall1)], m.disj, wall1), m.curry(m.update_in, ['wall_groups', _wall_group_hash(wall2)], m.disj, wall2));
    };
    return {
      create: create,
      cells: cells,
      walls: walls,
      wall_groups: wall_groups,
      borders: borders,
      neighbors: neighbors,
      remove_wall: remove_wall
    };
  })();

  map = (function() {
    var advance, complete, generator, solve;
    generator = function(grid) {
      var start;
      start = rand_nth(m.into(m.vector(), rg.cells(grid)));
      return m.hash_map('grid', grid, 'stack', m.vector(start), 'current', start, 'visited', m.set([start]));
    };
    advance = function(generator) {
      var available_neighbors, current, grid, neighbors, next, visited, visited_neighbors;
      grid = m.get(generator, 'grid');
      current = m.get(generator, 'current');
      visited = m.get(generator, 'visited');
      neighbors = rg.neighbors(grid, current);
      visited_neighbors = m.intersection(neighbors, visited);
      available_neighbors = m.difference(neighbors, visited_neighbors);
      if (m.is_empty(available_neighbors)) {
        return m.pipeline(generator, m.curry(m.update_in, ['stack'], m.pop), function(g) {
          return m.assoc(g, 'current', m.peek(m.get(g, 'stack')));
        });
      } else {
        next = rand_nth(m.into(m.vector(), available_neighbors));
        return m.pipeline(generator, m.curry(m.update_in, ['grid'], rg.remove_wall, current, next), m.curry(m.assoc, 'current', next), m.curry(m.update_in, ['stack'], m.conj, next), m.curry(m.update_in, ['visited'], m.conj, next));
      }
    };
    complete = function(generator) {
      return m.is_empty(m.get(generator, 'stack'));
    };
    solve = function(grid) {
      return m.pipeline(generator(grid), m.partial(m.iterate, advance), m.partial(m.drop_while, function(g) {
        return !map.complete(g);
      }), m.partial(m.take, 1), m.first, m.curry(m.get, 'grid'));
    };
    return {
      generator: generator,
      advance: advance,
      complete: complete,
      solve: solve
    };
  })();

  time = function(name, fn) {
    var end, start;
    start = (new Date()).getTime();
    fn();
    end = (new Date()).getTime();
    return console.log(name, end - start);
  };

  GridWall = React.createClass({
    wallOffsets: {
      north: [0, 0, 1, 0],
      south: [0, 1, 1, 1],
      east: [1, 0, 1, 1],
      west: [0, 0, 0, 1]
    },
    shouldComponentUpdate: function(np, ns) {
      return !(m.equals(np.wall, this.props.wall));
    },
    render: function() {
      var direction, x, x1, x2, y, y1, y2, _ref1, _ref2, _ref3;
      _ref1 = m.clj_to_js(this.props.wall), (_ref2 = _ref1[0], x = _ref2[0], y = _ref2[1]), direction = _ref1[1];
      _ref3 = this.wallOffsets[direction], x1 = _ref3[0], y1 = _ref3[1], x2 = _ref3[2], y2 = _ref3[3];
      return line({
        x1: (x + x1) * this.props.cellWidth,
        y1: (y + y1) * this.props.cellWidth,
        x2: (x + x2) * this.props.cellWidth,
        y2: (y + y2) * this.props.cellWidth
      });
    }
  });

  GridPathSegment = React.createClass({
    shouldComponentUpdate: function(np, ns) {
      return !(m.equals(np.segment, this.props.segment));
    },
    render: function() {
      var mid, x1, x2, y1, y2, _ref1, _ref2, _ref3;
      _ref1 = m.clj_to_js(this.props.segment), (_ref2 = _ref1[0], x1 = _ref2[0], y1 = _ref2[1]), (_ref3 = _ref1[1], x2 = _ref3[0], y2 = _ref3[1]);
      mid = this.props.cellWidth / 2;
      return line({
        x1: x1 * this.props.cellWidth + mid,
        y1: y1 * this.props.cellWidth + mid,
        x2: x2 * this.props.cellWidth + mid,
        y2: y2 * this.props.cellWidth + mid
      });
    }
  });

  GridBorder = React.createClass({
    shouldComponentUpdate: function(np, ns) {
      return !(m.equals(np.borders, this.props.borders));
    },
    key: function(wall) {
      var pos, x, y;
      x = m.get_in(wall, [0, 0]);
      y = m.get_in(wall, [0, 1]);
      pos = m.get(wall, 1);
      return "" + x + "-" + y + "-" + pos;
    },
    createWall: function(wall) {
      return GridWall({
        key: this.key(wall),
        wall: wall,
        cellWidth: this.props.cellWidth
      });
    },
    render: function() {
      return g({
        className: 'borders'
      }, m.into_array(m.map(this.createWall, this.props.borders)));
    }
  });

  GridPath = React.createClass({
    shouldComponentUpdate: function(np, ns) {
      return !(m.equals(np.segments, this.props.segments));
    },
    key: function(segment) {
      var x1, x2, y1, y2;
      x1 = m.get_in(segment, [0, 0]);
      y1 = m.get_in(segment, [0, 1]);
      x2 = m.get_in(segment, [1, 0]);
      y2 = m.get_in(segment, [1, 1]);
      return "" + x1 + "-" + y1 + "-" + x2 + "-" + y2;
    },
    createSegment: function(segment) {
      return GridPathSegment({
        key: this.key(segment),
        segment: segment,
        cellWidth: this.props.cellWidth
      });
    },
    render: function() {
      return g({
        className: 'path'
      }, m.into_array(m.map(this.createSegment, this.props.segments)));
    }
  });

  GridWalls = React.createClass({
    shouldComponentUpdate: function(np, ns) {
      return !(m.equals(np.walls, this.props.walls));
    },
    key: function(wall) {
      var pos, x, y;
      x = m.get_in(wall, [0, 0]);
      y = m.get_in(wall, [0, 1]);
      pos = m.get(wall, 1);
      return "" + x + "-" + y + "-" + pos;
    },
    createWall: function(wall) {
      return GridWall({
        key: this.key(wall),
        wall: wall,
        cellWidth: this.props.cellWidth
      });
    },
    render: function() {
      return g({
        className: 'walls'
      }, m.into_array(m.map(this.createWall, this.props.walls)));
    }
  });

  GridWallGroups = React.createClass({
    shouldComponentUpdate: function(np, ns) {
      return !(m.equals(np.wall_groups, this.props.wall_groups));
    },
    key: function(walls) {
      return m.hash(walls);
    },
    createWalls: function(walls) {
      return GridWalls({
        key: this.key(walls),
        cellWidth: this.props.cellWidth,
        walls: walls
      });
    },
    render: function() {
      return g({}, m.into_array(m.map(this.createWalls, this.props.wall_groups)));
    }
  });

  GridComponent = React.createClass({
    cellWidth: 10,
    padding: 10,
    delay: 50,
    generate: true,
    getDefaultProps: function() {
      return {
        width: 60,
        height: 30
      };
    },
    getInitialState: function() {
      time('create grid', (function(_this) {
        return function() {
          return _this.grid = rg.create(_this.props.width, _this.props.height);
        };
      })(this));
      return {
        grid: this.grid,
        path: m.vector()
      };
    },
    componentWillMount: function() {
      if (this.generate) {
        this.generator = map.generator(this.state.grid);
        this.interval = setInterval(this.advance, this.delay);
        return this.setState({
          grid: m.get(this.generator, 'grid'),
          path: m.vector()
        });
      }
    },
    advance: function() {
      return time('advance', (function(_this) {
        return function() {
          if (map.complete(_this.generator)) {
            return clearTimeout(_this.interval);
          } else {
            _this.generator = map.advance(_this.generator);
            return _this.setState({
              grid: m.get(_this.generator, 'grid'),
              path: m.get(_this.generator, 'stack')
            });
          }
        };
      })(this));
    },
    segments: function() {
      return m.map(m.vector, this.state.path, m.rest(this.state.path));
    },
    render: function() {
      return svg({
        width: this.cellWidth * this.props.width + 2 * this.padding,
        height: this.cellWidth * this.props.height + 2 * this.padding
      }, g({
        transform: "translate(" + this.padding + ", " + this.padding + ")"
      }, GridBorder({
        cellWidth: this.cellWidth,
        borders: rg.borders(this.state.grid)
      }), GridWallGroups({
        cellWidth: this.cellWidth,
        wall_groups: rg.wall_groups(this.state.grid)
      }), GridPath({
        cellWidth: this.cellWidth,
        segments: this.segments()
      })));
    }
  });

  React.renderComponent(GridComponent(), document.getElementById('content'));

}).call(this);
