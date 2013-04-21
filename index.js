var options = {
    canvasClass: "canballs-canvas",
    ballSize: 5,
    ballColor: "red",
    ballMass: 1,
    ballInitialSpeed: 10,
    spawnerOutsideColor: "#888",
    spawnerInsideColor: "#444",
    stringLineColor: "#aaa",
    solidLineColor: "orange",
    lineWidth: 3,
    element: '#canballs',
    width: 'auto',
    height: 500,
    gravity: 100,
    fps: 30,
    lineBounce: 1.05
};

var container;
var stage;
var canvas;
var borders;
var audioContext;

var balls = [];
var lines = [];
var spawners = [];

var tick = function () {
    var nLines = lines.length;
    var nSpawners = spawners.length;

    for (var s = spawners.length - 1; s >= 0; s -= 1) {
        spawners[s].tick();
    }

    for (var i = balls.length - 1; i >= 0; i -= 1) {
        balls[i].tick();
    }

    for (var l = lines.length - 1; l >= 0; l -= 1) {
        lines[l].tick();
    }
    stage.update();
};

var Line = function (x1, y1, x2, y2) {
    this.start = {
        x: x1,
        y: y1
    };
    this.end = {
        x: x2,
        y: y2
    };

    var boundExtra = 0.5 * options.lineWidth + 0.5 * options.ballSize;
    this.bbox = {
        x1: Math.min(x1, x2) - boundExtra,
        y1: Math.min(y1, y2) - boundExtra,
        x2: Math.max(x1, x2) + boundExtra,
        y2: Math.max(y1, y2) + boundExtra
    };
    var dX = this.end.x - this.start.x;
    var dY = this.end.y - this.start.y;
    this.length = Math.sqrt(dX*dX + dY*dY);
    this.unit = {
        x: dX / this.length,
        y: dY / this.length
    };
    this.perp = {
        x: -this.unit.y,
        y: this.unit.x
    };

    this.obj = new createjs.Shape();
    this.pass = true;

    this.obj.x = 0;
    this.obj.y = 0;
    this.obj.graphics.
        setStrokeStyle(options.lineWidth).
        beginStroke(options.stringLineColor).
        moveTo(x1, y1).lineTo(x2, y2).
        endStroke();

    // this.obj.graphics.
    //     beginStroke("black").
    //     moveTo(x1, y1).lineTo(x1 - this.unit.y * 100, y1 + this.unit.x * 100).
    //     endStroke();

    var self = this;
    this.obj.addEventListener('click', function () {
        if (self.pass === true) {
            self.pass = false;
            self.obj.graphics.clear().
                setStrokeStyle(options.lineWidth).
                beginStroke(options.solidLineColor).
                moveTo(x1, y1).lineTo(x2, y2).
                endStroke();
        } else {
            self.obj.removeAllEventListeners();
            stage.removeChild(self.obj);
            lines.splice(lines.indexOf(self), 1);
        }
    });
};

Line.prototype.tick = function () {

};

Line.prototype.touch = function (ball, speed, angle) {
    // console.log("My " + this.length + " length is being touched with " + speed + " speed!");

    var angled = 360 * (angle / (2.0 * Math.PI));
    // console.log("At an angle " + angle + " of: " + angled + " degrees");

    this.sound(ball.mass, speed, angle);

    // reflect the ball
    if (this.pass === false) {
        var cs = Math.cos(Math.PI + angle * 2);
        var sn = Math.sin(Math.PI + angle * 2);
        ball.speed = {
            x: (ball.speed.x*cs + ball.speed.y*sn) * options.lineBounce,
            y: (-ball.speed.x*sn + ball.speed.y*cs) * options.lineBounce
        };
    }
};

Line.prototype.sound = function(mass, speed, angle) {
    if (typeof audioContext !== 'undefined' && audioContext !== null) {
        var source = audioContext.createOscillator();
        source.type = "sine";
        source.frequency.value = 1000 - speed;
        source.connect(audioContext.destination);
        source.noteOn(0);
        setTimeout(function () {
            source.noteOff(0);
        }, 50);
    }
};

Line.prototype.inBounds = function (bbox) {
    var mybox = this.bbox;
    return mybox.x1 <= bbox.x1 && mybox.y1 <= bbox.y1 && mybox.x2 >= bbox.x2 && mybox.y2 >= bbox.y2;
};

var Ball = function (x, y, mass) {
    this.obj = new createjs.Shape();
    this.obj.graphics.
        beginFill(options.ballColor).
        drawCircle(0, 0, options.ballSize).
        endFill();
    this.obj.x = x;
    this.obj.y = y;
    this.updateBbox();

    if (typeof mass === 'undefined' || mass === null) {
        mass = options.ballMass;
    }
    this.mass = mass;
    this.speed = {
        x: 0,
        y: options.ballInitialSpeed
    };
    this.tickTime = createjs.Ticker.getTime();
    this.lastTouch = [];
};
Ball.prototype.tick = function () {
    var currentTime = createjs.Ticker.getTime();
    var timeSpent = currentTime - this.tickTime;
    this.tickTime = currentTime;
    var accel = this.mass * options.gravity * (timeSpent / 1000);
    this.speed.y += accel;

    this.obj.x += this.speed.x * (timeSpent / 1000);
    this.obj.y += this.speed.y * (timeSpent / 1000);
    this.updateBbox();

    if (this.obj.x < borders.minX || this.obj.y < borders.minY || this.obj.x > borders.maxX || this.obj.y > borders.maxY) {
        this.obj.removeAllEventListeners();
        stage.removeChild(this.obj);
        balls.splice(balls.indexOf(this), 1);
    } else {
        var touches = [];
        for (var l = lines.length - 1; l >= 0; l -= 1) {
            var line = lines[l];
            if (line.inBounds(this.bbox)) {
                var subs = {
                    x: line.start.x - this.obj.x,
                    y: line.start.y - this.obj.y
                };
                var len = subs.x*line.unit.x + subs.y*line.unit.y;
                var projection = {
                    x: line.unit.x * len,
                    y: line.unit.y * len
                };
                var component = {
                    x: subs.x - projection.x,
                    y: subs.y - projection.y
                };
                var distance = Math.sqrt(component.x*component.x + component.y*component.y);
                if (distance < options.ballSize) {
                    touches.push(line);
                    if (this.lastTouch.indexOf(line) === -1) {
                        var speed = Math.sqrt(this.speed.x*this.speed.x + this.speed.y*this.speed.y);
                        var norm = {
                            x: this.speed.x / speed,
                            y: this.speed.y / speed
                        };
                        // var dotprod = line.perp.x*norm.x + line.perp.y*norm.y;
                        var angle = Math.atan2(norm.y, norm.x) - Math.atan2(line.perp.y, line.perp.x);
                        line.touch(this, speed, angle);
                    }
                }
            }
        }
        this.lastTouch = touches;
    }
};

Ball.prototype.updateBbox = function () {
    this.bbox = {
        x1: this.obj.x - options.ballSize,
        y1: this.obj.y - options.ballSize,
        x2: this.obj.x + options.ballSize,
        y2: this.obj.y + options.ballSize
    };
};

var Spawner = function (x, y, wait) {
    this.obj = new createjs.Shape();
    this.obj.graphics.
        beginStroke(options.spawnerOutsideColor).
        beginFill(options.spawnerInsideColor).
        drawCircle(0, 0, options.ballSize + 2).
        endFill().
        endStroke();
    this.obj.x = x;
    this.obj.y = y;

    this.wait = wait;
    this.lastSpawn = -1;
    var self = this;
    this.obj.addEventListener('click', function () {
        self.obj.removeAllEventListeners();
        stage.removeChild(self.obj);
        spawners.splice(spawners.indexOf(self), 1);
    });
};
Spawner.prototype.tick = function () {
    var time = createjs.Ticker.getTime();
    if (this.lastSpawn + this.wait < time) {
        // var diff = time - this.lastSpawn - this.wait;
        // var frac = diff / (1000 * (1.0 / createjs.Ticker.getMeasuredFPS()));
        // update spawn time to current index
        this.lastSpawn = time;

        // spawn ball
        var ball = new Ball(this.obj.x, this.obj.y);
        stage.addChild(ball.obj);
        balls.push(ball);
    }
};

var init = function () {
    container = $(options.element);
    canvas = $('<canvas />');
    if (options.width === 'auto') {
        canvas.attr('width', container.innerWidth());
    } else {
        canvas.attr('width', options.width);
    }

    if (options.height === 'auto') {
        canvas.attr('height', container.innerHeight());
    } else {
        canvas.attr('height', options.height);
    }

    canvas.addClass(options.canvasClass);

    container.append(canvas);
    stage = new createjs.Stage(canvas[0]);
    createjs.Ticker.setFPS(options.fps);
    createjs.Ticker.addEventListener('tick', tick);

    var lastdown;
    stage.addEventListener('stagemousedown', function (e) {
        lastdown = {stageX: e.stageX, stageY: e.stageY};
    });

    var min = -0.5 * options.ballSize;
    borders = {
        minX: min,
        minY: min,
        maxX: canvas.attr('width') - min,
        maxY: canvas.attr('height') - min
    };

    stage.addEventListener('stagemouseup', function (e) {
        if (typeof lastdown !== 'undefined' && lastdown !== null) {
            if (lastdown.stageX === e.stageX && lastdown.stageY === e.stageY) {
                if (stage.getObjectUnderPoint(e.stageX, e.stageY) === null) {
                    var spawner = new Spawner(e.stageX, e.stageY, 1000);
                    stage.addChildAt(spawner.obj, 0);
                    spawners.push(spawner);
                }
            } else {
                var diffX = Math.abs(e.stageX - lastdown.stageX);
                var diffY = Math.abs(e.stageY - lastdown.stageY);
                var length = Math.sqrt(diffX*diffX + diffY*diffY)
                if (length > 10) {
                    var line = new Line(lastdown.stageX, lastdown.stageY, e.stageX, e.stageY);
                    stage.addChildAt(line.obj, spawners.length);
                    lines.push(line);
                }
            }
            lastdown = null;
        }
    });

    try {
        audioContext = new AudioContext();
    } catch (e) {
        try {
            audioContext = new webkitAudioContext();
        } catch (e) {
            alert("Sorry, your browser doesn't support generating sounds");
        }
    }
};

init();
canvas.css('border', '1px solid #000');
canvas.css('background', "#444");
