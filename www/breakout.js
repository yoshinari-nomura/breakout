////////////////////////////////////////////////////////////////
/// Breakout Game
///
/// Yoshinari Nomura <nom@quickhack.net>
///
/// Created: 2024-06-16
/// LICENSE: MIT
///

const debug = false;

////////////////////////////////////////////////////////////////
/// Screen
///
/// + Screen object is a wrapper of canvas object.
/// + Left-top is (0, 0), right-bottom is (w-1, h-1)
////////////////////////////////////////////////////////////////

class Screen {
  constructor(w, h, ctx) {
    this.w = w;
    this.h = h;
    this.ctx = ctx;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  circle(x, y, r, color) {
    this.ctx.beginPath();
    this.ctx.fillStyle = color;
    this.ctx.arc(x, y, r, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  rectangle(x, y, w, h, color) {
    this.ctx.beginPath();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - w/2, y - h/2, w, h);
    this.ctx.stroke();
    this.ctx.closePath();
  }
}

////////////////////////////////////////////////////////////////
/// Collision calculator
////////////////////////////////////////////////////////////////

class Collider {
  // Circle vs Rectangle (Axis Aligned)
  // https://www.gamedevelopment.blog/collision-detection-circles-rectangles-and-polygons/
  //
  circle_rectangle(circle, rect) {
    // distance between the centers
    // rect.x, rect.y is the center of the rectangle
    let dx = Math.abs(circle.x - rect.x);
    let dy = Math.abs(circle.y - rect.y);

    // impossible to collide if greater than radius+width
    if (dx > circle.r + rect.w/2 || dy > circle.r + rect.h/2)
      return null;

    // cirle.x is inside the rectangle width; top/bottom is crossed.
    if (dx <= rect.w/2)
      return "TOP_OR_BOTTOM";

    // circle.y is inside the rectangle height; left/right is crossed.
    if (dy <= rect.h/2)
      return "LEFT_OR_RIGHT";

    // distance between the nearest corner to circle's center
    if ((dx - rect.w/2) ** 2 + (dy - rect.h/2) ** 2 <= circle.r ** 2)
      return "CORNER";

    return null;
  }
}

////////////////////////////////////////////////////////////////
/// Game characters: Brick, Paddle, and Ball
///
/// Note: Reference point is at the center of the object.
////////////////////////////////////////////////////////////////

class Brick {
  static get WIDTH()  { return 44; }
  static get HEIGHT() { return 22; }

  constructor(x, y, color = 'white') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.alive = true;
  }
  get w() { return Brick.WIDTH; }
  get h() { return Brick.HEIGHT; }

  draw(screen) {
    if (this.alive)
      screen.rectangle(this.x, this.y, this.w, this.h, this.color);
  }

  update(delta) {
    // do nothing
  }
}

class Paddle {
  static get WIDTH()  { return 90; }
  static get HEIGHT() { return 15; }
  static get COLOR()  { return 'white'; }
  static get ACTION() { return {Left: 0, Right: 1}}

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  get w() { return Paddle.WIDTH; }
  get h() { return Paddle.HEIGHT; }

  draw(screen) {
    screen.rectangle(this.x, this.y, this.w, this.h, Paddle.COLOR);
  }

  update(delta, keystates) {
    if (keystates[Paddle.ACTION.Left]) {
      if (debug) console.log(`action: Left`);
      this.x -= delta;
    }
    if (keystates[Paddle.ACTION.Right]) {
      if (debug) console.log(`action: Right`);
      this.x += delta;
    }
    this.x = this.#crop_x(0, Game.SCREEN_WIDTH);
  }

  #crop_x(min, max) {
    return Math.min(Math.max(min + this.w/2, this.x), max - this.w/2);
  }
}

class Ball {
  static get RADIUS() { return 10; }
  static get COLOR()   { return 'white'; }

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.v = {x: 0.1, y:1};
  }
  get r() { return Ball.RADIUS; }

  draw(screen) {
    screen.circle(this.x, this.y, this.r, Ball.COLOR);
  }

  update(delta) {
    this.x += this.v.x * delta * 0.3;
    this.y += this.v.y * delta * 0.3;
  }

  // flip velocity
  flip(x_axis = -1, y_axis = -1) {
    this.v.x *= x_axis;
    this.v.y *= y_axis;
  }
}

////////////////////////////////////////////////////////////////
/// Game state
////////////////////////////////////////////////////////////////

class Game {
  static get BRICK_COLS() { return 20; }
  static get BRICK_ROWS() { return 5; }
  static get SCREEN_WIDTH() { return 900; }

  constructor(screen, keybind) {
    this.screen = screen;
    this.keybind = keybind;

    this.bricks = this.#place_bricks(Game.BRICK_COLS, Game.BRICK_ROWS,
      Brick.WIDTH/2, Brick.HEIGHT/2 + 100);
    this.paddle = new Paddle(screen.w/2, screen.h - 100);
    this.ball = new Ball(screen.w/2, screen.h/2);
    this.keystates = [];
  }

  update_keystate(keysym, state) {
    let action = this.keybind[keysym];
    if (action != undefined) {
      if (debug) console.log(`action: ${action}`);
      this.keystates[action] = state
    }
  }

  update(delta) {
    this.bricks.forEach(brick => {
      brick.update(delta);
    });
    this.ball.update(delta);
    this.paddle.update(delta, this.keystates);

    // check collision
    let collider = new Collider();

    // ball vs paddle
    let collision = collider.circle_rectangle(this.ball, this.paddle);
    if (collision) {
      this.ball.v.x = (this.ball.x - this.paddle.x) * 0.01
      this.ball.v.y = -Math.abs(this.ball.v.y);
    }

    // ball vs bricks
    let flip_x = 1, flip_y = 1;

    this.bricks.forEach(brick => {
      if (!brick.alive) return;
      collision = collider.circle_rectangle(this.ball, brick);

      if (collision) {
        brick.alive = false;
      }
      switch (collision) {
        case "LEFT_OR_RIGHT":
        flip_x = -1;
        break;
      case "TOP_OR_BOTTOM":
        flip_y = -1;
        break;
      case "CORNER":
        flip_y = -1;
        flip_x = -1;
        break;
      }
    });
    this.ball.flip(flip_x, flip_y);

    // ball vs wall
    // hit the left wall
    if (this.ball.x - this.ball.r < 0) {
      this.ball.v.x = Math.abs(this.ball.v.x);
    }
    // hit the right wall
    if (this.ball.x + this.ball.r > this.screen.w) {
      this.ball.v.x = -Math.abs(this.ball.v.x);
    }
    // hit the roof
    if (this.ball.y - this.ball.r < 0) {
      this.ball.v.y = Math.abs(this.ball.v.y);
    }

  }

  draw() {
    let screen = this.screen;
    screen.clear();

    this.bricks.forEach(brick => {
      brick.draw(screen);
    });

    this.ball.draw(screen);

    this.paddle.draw(screen);
  }

  // private methods

  #place_bricks(cols, rows, start_x, start_y) {
    const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple'];
    const gap = 1;

    let brick;
    let bricks = [];

    let y = start_y;
    for (let row = 0; row < rows; row++) {
      let x = start_x;

      for (let col = 0;  col < cols; col++) {
        brick = new Brick(x, y, colors[row % colors.length]);
        bricks.push(brick);
        x += brick.w + gap;
      }
      y += brick.h + gap;
    }
    return bricks;
  }
}

////////////////////////////////////////////////////////////////
/// Setup and kick main loop
////////////////////////////////////////////////////////////////

const KeyBind = {
  "ArrowLeft":  Paddle.ACTION.Left,
  "ArrowRight": Paddle.ACTION.Right,
};

let screen = new Screen(
  900, // width should be same as in index.html
  780, // height hould be same as in index.html
  document.getElementById('canvas').getContext('2d'), // canvas object
);

let game = new Game(screen, KeyBind);
let start = null, prev_timestamp = null;

let game_loop = (timestamp) => {
  if (!prev_timestamp) { // fist iteration
    start = timestamp;
    prev_timestamp = timestamp;
    requestAnimationFrame(game_loop);
    return;
  }

  let delta = (timestamp - prev_timestamp);

  game.update(delta);
  game.draw();

  prev_timestamp = timestamp;
  requestAnimationFrame(game_loop);
};

function start_game() {
  document.addEventListener('keydown', e => game.update_keystate(e.key, true));
  document.addEventListener('keyup',   e => game.update_keystate(e.key, false));
  game_loop();
}

start_game();
