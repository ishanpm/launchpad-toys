colorMap = [0x000000,0x212121,0x8b8b8b,0xfbfbfb,0xff6457,0xff2900,0x6e0a00,0x220100,0xffc572,0xff6c00,0x6e2400,0x2e1900,0xfbf725,0xfbf700,0x686600,0x191800,0x8bf634,0x3ef400,0x146500,0x103400,0x30f534,0x00f400,0x006500,0x001800,0x30f657,0x00f500,0x006500,0x001900,0x30f68f,0x00f546,0x006519,0x002012,0x27f7bd,0x00f7a2,0x00663b,0x001912,0x3fcaff,0x00b6ff,0x004d63,0x00121a,0x5098ff,0x006cff,0x00266d,0x000320,0x5763fe,0x0433ff,0x01106d,0x000221,0x9665ff,0x6435ff,0x1b1277,0x0a0641,0xff6aff,0xff40ff,0x6e166d,0x210220,0xff6694,0xff2b62,0x6e0b21,0x290212,0xff3400,0xad4400,0x8c6200,0x4b7500,0x004500,0x006141,0x006490,0x0443ff,0x00525d,0x232adb,0x8b8b8b,0x282828,0xff2900,0xc4f600,0xb7eb00,0x60f600,0x009500,0x00f68b,0x00b5fe,0x033dff,0x4333ff,0x8836ff,0xc33090,0x532900,0xff5e00,0x91e200,0x71f600,0x00f500,0x00f500,0x47f672,0x00f8d2,0x6199ff,0x2d64d2,0x9590ef,0xdd3fff,0xff2c6d,0xff9100,0xc6ba00,0x95f600,0x956c00,0x473500,0x005b02,0x006147,0x121435,0x122c6d,0x7d4d19,0xbb1800,0xe8663f,0xe47c00,0xfee300,0xa4e200,0x6fbd00,0x21223b,0xe2f762,0x80f7c0,0xa7aaff,0x9a7bff,0x4d4d4d,0x868686,0xe2fbfb,0xb21700,0x420300,0x00d100,0x004b00,0xc6ba00,0x4d3b00,0xc36e00,0x591c00]

displayMap = colorMap.map(color=>"#"+lighten(color).toString(16).padStart(6,"0"));

ctx = $("#board")[0].getContext("2d");
midi = null;
webcam = null;
outName = "output-2";
board = Array(10).fill(0).map(e=>Array(10).fill(0));
dirty = Array(10).fill(0).map(e=>Array(10).fill(false));

mode = null;
lastTime = 0;
boardKeyHold = null;

$("#board").on("mousedown",boardDown)
$("#board").on("mousemove",boardMove)
$("#board").on("mouseup",boardUp)

function init() {
  lastTime = Date.now();
  console.log("Connecting to MIDI")
  navigator.requestMIDIAccess()
    .then(m1=>{
      console.log("Connecting to MIDI with SysEx")
      navigator.requestMIDIAccess({sysex:true})
        .then(midiConnectSuccess, _=>{
          midiConnectSuccess(m1)
        })
    }, midiConnectFail)
}

function midiConnectSuccess(m) {
  console.log(m)
  midi = m;
  
  for (e of midi.inputs.entries()) {
    var name = e[0];
    var inp = e[1];
    inp.onmidimessage = evt => {
      midiRecieve(name, evt.data)
    }
  }
  
  updateLights(true)
}

function midiConnectFail() {
  console.log("Failed to connect to MIDI")
}

function midiRecieve(name, data) {
  //console.log(name, data);
  
  var x = data[1]%10
  var y = Math.floor(data[1]/10)%10
  
  // Press/release
  // 144 is pad buttons and 176 is control buttons
  if (data[0] == 144 || data[0] == 176) {
    if (data[2] == 0) {
      mode.keyRelease(x, y)
    } else {
      mode.keyPress(x, y, data[2]);
    }
  }
  
  // Aftertouch
  if (data[0] == 208) {
    mode.keyAftertouch(data[1])
  }
}

function midiSend(data) {
  if (midi) {
    var o = midi.outputs.get(outName);
    if (o) o.send(data);
  }
}

function boardDown(event) {
  var x = Math.floor(event.offsetX/20)
  var y = 10 - Math.floor(event.offsetY/20) - 1
  
  if (0 <= x && x <= 9 && 0 <= y && y <= 9) {
    boardKeyHold = [x,y];
    mode.keyPress(x, y, 127);
  }
}

function boardMove(event) {
  var x = Math.floor(event.offsetX/20)
  var y = 10 - Math.floor(event.offsetY/20) - 1
  
  if (0 <= x && x <= 9 && 0 <= y && y <= 9) {
    if (boardKeyHold !== null && (x != boardKeyHold[0] || y != boardKeyHold[1])) {
      mode.keyRelease(boardKeyHold[0],boardKeyHold[1])
      boardKeyHold = [x,y];
      mode.keyPress(x, y, 127);
    }
  }
}

function boardUp(event) {
  mode.keyRelease(boardKeyHold[0],boardKeyHold[1])
  boardKeyHold = null;
}

function setMode(newMode) {
  if (mode) {
    mode.destroy()
  }
  if (newMode) {
    for (var k=0; k<100; k++) {
      setLight(k%10, Math.floor(k/10), 0);
    }
    mode = new modes[newMode]();
  }
  updateLights(true);
}

class ModeBase {
  keyPress(x, y, velocity) {}
  keyRelease(x, y) {}
  keyAftertouch(x, y, velocity) {}
  tick() {}
  destroy() {}
}
class PaintMode extends ModeBase {
  constructor() {
    super()
    //this.pallete = [0,1,7,15,23,39,47,55];
    this.pallete = [0,3,5,13,21,37,45,53];
    this.brush = this.pallete[1];
    this.frames = [];
    this.frameNum = 0;
    
    this.showPallete = false;
    this.palleteHold = -1;
    this.palleteHoldTime = 0;
    
    for (var i=0; i<8; i++) {
      setLight(9, i+1, this.pallete[i])
    }
    setLight(0,1,this.brush);
  }

  saveFrame(i) {
    this.frames[i] = Array(8).fill(0).map((r,y)=>Array(8).fill(0).map((c,x)=>board[y+1][x+1]));
  }

  loadFrame(i) {
    if (!this.frames[i]) {
      this.frames[i] = Array(8).fill(0).map(r=>Array(8).fill(0));
    }
    this.frames[i].forEach((r,y)=>r.forEach((c,x)=>setLight(x+1,y+1,c)));
  }

  keyPress(x, y, velocity) {
    if (x == 9) {
      this.brush = this.pallete[y-1];
      setLight(0,1,this.brush);
      this.palleteHold = y;
      this.palleteHoldTime = Date.now() + 500;
      return;
    }
    
    if (this.showPallete) {
      this.pallete[this.palleteHold-1] = mod((y-1)*8 + x-1,128);
      setLight(9, this.palleteHold, this.pallete[this.palleteHold-1]);
      this.brush = this.pallete[this.palleteHold-1];
      setLight(0,1,this.brush);
      
      this.loadFrame(this.frameNum);
      this.showPallete = false;
      this.palleteHold = -1;
    } else {
      if (x == 0) {
        if (y == 1) {
          for (var x=1; x<9; x++) {
            for (var y=1; y<9; y++) {
              setLight(x, y, this.brush);
            }
          }
        }
        return;
      }
      
      if (y == 9) {
        if (x == 3 && this.frameNum > 0) {
          this.saveFrame(this.frameNum);
          this.frameNum--;
          this.loadFrame(this.frameNum);
        } else if (x == 4) {
          this.saveFrame(this.frameNum);
          this.frameNum++;
          this.loadFrame(this.frameNum);
        }
        return;
      }
      
      setLight(x, y, this.brush);
    }
  }
  
  keyRelease(x, y) {
    if (x == 9 && y == this.palleteHold && !this.showPallete)
      this.palleteHold = -1;
  }
  
  tick() {
    if (this.palleteHold != -1 && Date.now() > this.palleteHoldTime && !this.showPallete) {
      this.saveFrame(this.frameNum)
      for (var i=0; i<64; i++) {
        setLight(i%8+1, Math.floor(i/8)+1, i);
      }
      this.showPallete = true;
      setLight(9, this.palleteHold, 1);
    }
  }
}
class LightsOutMode extends ModeBase {
  constructor() {
    super()
    this.randomize();
    setLight(9,1,45);
  }
  randomize() {
    for (var i=0; i<64; i++) {
      setLight(i%8+1,Math.floor(i/8)+1,Math.round(Math.random())*3)
    }
  }
  toggleIfInRange(x,y) {
    if (1<=x && x<=8 && 1<=y && y<=8) {
      setLight(x,y,3-board[y][x])
    }
  }
  keyPress(x, y, velocity) {
    if (x == 9 && y == 1) {
      this.randomize();
      return;
    }
    
    if (1<=x && x<=8 && 1<=y && y<=8) {
      this.toggleIfInRange(x,y)
      this.toggleIfInRange(x+1,y)
      this.toggleIfInRange(x-1,y)
      this.toggleIfInRange(x,y+1)
      this.toggleIfInRange(x,y-1)
    }
  }
}
class PulseMode extends ModeBase {
  constructor() {
    super()
    this.pulses = [];
  }
  
  keyPress(x, y, velocity) {
    this.pulses.push({x, y, life: 1})
  }

  tick() {
    for (let i=0; i<this.pulses.length; i++) {
      if (this.pulses[i].life <= 0) {
        setLight(this.pulses[i].x, this.pulses[i].y, 0)
        this.pulses.splice(i,1)
        i--;
      } else {
        var color = [1,2,3][Math.floor(this.pulses[i].life*3)]
        this.pulses[i].life -= 1/60;
        setLight(this.pulses[i].x, this.pulses[i].y, color)
      }
    }
  }
}
class PressureMode extends ModeBase {
  constructor() {
    super();
    //this.grid = Array(10).fill().map(e=>Array(10).fill(0));
  }
  
  keyAftertouch(velocity) {
    for (var i=0; i<64; i++) {
      var x = i%8 + 1;
      var y = Math.floor(i/8) + 1;
      
      var n = i*2 + 1;
      var color;
      
      if (n == velocity) {
        color = 45;
      } else if (n < velocity) {
        color = 5;
      } else {
        color = 0;
      }
      
      setLight(x, y, color)
    }
  }
  
/*
  keyPress(x, y, velocity) {
    this.pulses.push({x, y, life: 1})
  }

  tick() {
    for (let i=0; i<this.pulses.length; i++) {
      if (this.pulses[i].life <= 0) {
        setLight(this.pulses[i].x, this.pulses[i].y, 0)
        this.pulses.splice(i,1)
        i--;
      } else {
        var color = [1,2,3][Math.floor(this.pulses[i].life*3)]
        this.pulses[i].life -= 1/60;
        setLight(this.pulses[i].x, this.pulses[i].y, color)
      }
    }
  }*/
}
class ChaseMode extends ModeBase {
  constructor() {
    super()
    
    this.targets = [];
    
    for (var i=0; i<3; i++) {
      if (this.targets.length <= i) {
        var newX = 0;
        var newY = 0;
        do {
          newX = Math.floor(Math.random()*8)+1
          newY = Math.floor(Math.random()*8)+1
        } while (this.targets.find(e=>e.x==newX&&e.y==newY) != null);
        this.targets.push({x:newX,y:newY})
      }
      
      setLight(this.targets[i].x, this.targets[i].y, [21,3,1][i]);
    }
  }

  keyPress(x, y, velocity) {
    if (x == this.targets[0].x && y == this.targets[0].y) {
      setLight(this.targets[0].x, this.targets[0].y, 0);
      this.targets.splice(0,1);
    }
    
    for (var i=0; i<3; i++) {
      if (this.targets.length <= i) {
        var newX = 0;
        var newY = 0;
        do {
          newX = Math.floor(Math.random()*8)+1
          newY = Math.floor(Math.random()*8)+1
        } while (this.targets.find(e=>e.x==newX&&e.y==newY) != null);
        this.targets.push({x:newX,y:newY})
      }
      
      setLight(this.targets[i].x, this.targets[i].y, [21,3,1][i]);
    }
  }
}
class ConwayMode extends ModeBase {
  constructor() {
    super()
    
    this.maxDelay = 250;
    this.delay = 250;
    this.paused = true;
    
    for (var y=2; y<=8; y++) {
      setLight(9,y,3);
    }
    setLight(9,1,5);
  }
  keyPress(x, y, velocity) {
    if (x==9) {
      for (var y1=1; y1<=8; y1++) {
        setLight(9,y1,3);
      }
      
      if (y == 1) {
        if (this.paused) {
          this.lifeStep();
        } else {
          this.paused = true;
        }
        setLight(9,y,5);
      } else {
        this.paused = false;
        this.maxDelay = 405 - 50*y;
        setLight(9,y,21);
      }
    } else {
      setLight(x, y, 3-board[y][x]);
    }
  }
  tick() {
    if (this.paused) return;
    this.delay -= Date.now() - lastTime
    if (this.delay > 0) return;
    this.delay = this.maxDelay;
    
    this.lifeStep();
  }
  
  lifeStep() {
    var last = board.map(row=>row.map(e=>e));
    for (var y=1; y<9; y++) {
      for (var x=1; x<9; x++) {
        var count = 0;
        for (var dy=-1; dy<2; dy++) {
          var y1 = mod((y+dy)-1,8)+1
          for (var dx=-1; dx<2; dx++) {
            var x1 = mod((x+dx)-1,8)+1
            count += Math.min(last[y1][x1],1);
          }
        }
        
        var next = 0;
        if (board[y][x] == 0) {
          next = count == 3 ? 3 : 0
        } else {
          next = (count == 3 || count == 4) ? 3 : 0
        }
        
        setLight(x, y, next);
      }
    }
  }
}
class ColortestMode extends ModeBase {
  constructor() {
    super()
    for (var i=0; i<64; i++) {
      setLight(i%8+1, Math.floor(i/8)+1, i);
    }
  }
  keyPress(x, y, velocity) {
    var offset = 0;
    if (board[1][1] == 0) {
      offset = 64;
    }
    
    for (var i=0; i<64; i++) {
      setLight(i%8+1, Math.floor(i/8)+1, i+offset);
    }
  }
}
class WebcamMode extends ModeBase {
  constructor() {
    super()
    
    if (midi && midi.sysexEnabled) {
      this.camElement = $("#webcamDisplay")[0];
      this.camCanvas = $("#webcamCanvas")[0];
      this.camContext = this.camCanvas.getContext("2d");
      this.delay = 0;
      this.maxDelay = 100;
      
      var that = this
      if (!webcam) {
        navigator.mediaDevices.getUserMedia({video:true}).then(s=>{
          webcam = s;
          that.onCamAccess(s)
        });
      } else {
        this.onCamAccess(webcam)
      }
    } else {
      console.warn("SysEx required for webcam display")
    }
  }
  
  onCamAccess(stream) {
    this.camElement.srcObject = stream;
  }
  
  tick() {
    this.delay -= Date.now() - lastTime
    if (this.delay > 0) return;
    this.delay = this.maxDelay;
    if (!webcam) return;
    
    this.camContext.drawImage(this.camElement,0,0,8,8)
    var pixels = this.camContext.getImageData(0,0,8,8).data

    for (var i=0; i<64; i++) {
      setLightRaw(i%8+1,8-Math.floor(i/8),pixels[i*4]/4,pixels[i*4+1]/4,pixels[i*4+2]/4)
      drawButtonRaw(i%8+1,8-Math.floor(i/8),pixels[i*4]/4,pixels[i*4+1]/4,pixels[i*4+2]/4)
    }
  }
}
/*class RhythmMode extends ModeBase {
  // This is horribly unfinished, don't bother with it
  
  constructor() {
    super()
    
    this.baseSpeed = 120 / 60;
    this.spawnSpeed = this.baseSpeed;
    this.spawnNext = Date.now() + this.spawnSpeed * 1000;
    this.sparks = [];
  }
  
  keyPress(x, y, velocity) {
    for (var i=0; i<this.sparks.length; i++) {
      var spark = this.sparks[i];
      
      if (spark.x+1 == x && spark.y+1 == y) {
        this.sparks.splice(i,1);
        i--;
      }
    }
  }
  
  tick() {
    var now = Date.now();
    
    for (let x=1; x<=8; x++) {
      for (let y=1; y<=8; y++) {
        setLight(x,y,0);
      }
    }
    
    if (this.spawnNext < now) {
      this.spawnNext = Math.max(now, this.spawnNext + 1000/this.spawnSpeed*(Math.random()<0.2?0.5:1));
      var ox = Math.floor(Math.random()*6)+1;
      var oy = Math.floor(Math.random()*6)+1;
      var delay = 1000/(this.baseSpeed*4);
      var color = 45;
      var ot = now + delay*8;
      this.sparks.push({ox, oy, ot, delay, dx: 1, dy: 0, color});
      this.sparks.push({ox, oy, ot, delay, dx: 0, dy: 1, color});
      this.sparks.push({ox, oy, ot, delay, dx:-1, dy: 0, color});
      this.sparks.push({ox, oy, ot, delay, dx: 0, dy:-1, color});
    }
    
    for (var i=0; i<this.sparks.length; i++) {
      var spark = this.sparks[i];
      spark.t = (now-spark.ot)/spark.delay;
      spark.x = spark.ox + spark.dx*Math.floor(spark.t);
      spark.y = spark.oy + spark.dy*Math.floor(spark.t);
      
      if (spark.x>=0 && spark.y>=0 && spark.x<8 && spark.y<8) {
        setLight(spark.x+1, spark.y+1, spark.color);
      }
      
      if (-spark.t < 7) {
        setLight(spark.ox+1, spark.oy+1, Math.floor([3,3,3,2,2,1,1][Math.floor(-spark.t)]))
      }
    }
    
    this.sparks = this.sparks.filter(spark => {
      return !(   (spark.dx>=0 && spark.x>7)
               || (spark.dy>=0 && spark.y>7)
               || (spark.dx<=0 && spark.x<0)
               || (spark.dy<=0 && spark.y<0)
               || this.sparks.findIndex(s2 => spark !== s2 && spark.x == s2.x && spark.y == s2.y)>-1);
    })
  }
}*/
class ChompMode extends ModeBase {
  constructor() {
    super();
    this.turn = 0;
    this.reset();
  }
  
  keyPress(x, y, velocity) {
    if (x<1 || x>8 || y<1 || y>8) return;
    
    if (x==1 && y==1) {
      this.reset();
    } else {
      if (board[y][x] == 0) {
        for (var x1=x; x1<=8; x1++) {
          for (var y1=y; y1<=8; y1++) {
            if (board[y1][x1] == 0) {
              setLight(x1,y1,[45,5][this.turn]);
            }
          }
        }
        this.turn = (this.turn+1)%2
      }
    }
  }
  
  reset() {
    this.turn = 0;
    for (var x=1; x<=8; x++) {
      for (var y=1; y<=8; y++) {
        setLight(x,y,0);
      }
    }
    setLight(1,1,53);
  }
}

modes = {paint: PaintMode, pulse: PulseMode, pressure: PressureMode, chase: ChaseMode, conway: ConwayMode, colortest: ColortestMode, lightsout: LightsOutMode, chomp: ChompMode, /*rhythm: RhythmMode,*/ webcam: WebcamMode};

for (let m in modes) {
  $("#modeSelect").append(`<option>${m}</option>`)
}

$("#modeSelect").on("change",e=>{
  setMode(e.target.value)
})

function setLight(x, y, color, force) {
  if (force) {
    board[y][x] = color;
    midiSend([144, (y*10+x)%100, color%128])
  } else if (board[y][x] != color) {
    board[y][x] = color;
    dirty[y][x] = true;
  }
}

function setLightRaw(x, y, r, g, b) {
  midiSend([240,0,32,41,2,16,11,y*10+x,r,g,b,247])
}

function updateLights(force) {
  if (force) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0,0,2000,2000);
  }
  
  for (var y=0; y<board.length; y++) {
    for (var x=0; x<board[0].length; x++) {
      if (dirty[y][x] || force) {
        drawButton(x, y, board[y][x]%128)
        midiSend([144, (y*10+x)%100, board[y][x]%128]);
        dirty[y][x] = false;
      }
    }
  }
}

function drawButton(x, y, color) {
  var sideh = (x == 0 || x == 9);
  var sidev = (y == 0 || y == 9);
  
  ctx.fillStyle = displayMap[board[y][x]]
  if (sideh || sidev) {
    ctx.fillRect(4 + x*20, 4 + (10-y-1)*20, 12, 12)
  } else {
    ctx.fillRect(1 + x*20, 1 + (10-y-1)*20, 18, 18)
  }
}

function drawButtonRaw(x, y, r, g, b) {
  var sideh = (x == 0 || x == 9);
  var sidev = (y == 0 || y == 9);
  
  ctx.fillStyle = "#" + lighten((r << 18)+(g << 10)+(b << 2)).toString(16).padStart(6,"0")
  if (sideh || sidev) {
    ctx.fillRect(4 + x*20, 4 + (10-y-1)*20, 12, 12)
  } else {
    ctx.fillRect(1 + x*20, 1 + (10-y-1)*20, 18, 18)
  }
}

function loop() {
  if (mode) {
    if (mode.tick) mode.tick();
    updateLights();
  }
  lastTime = Date.now();
}

function mod(a, b) {
  return ((a%b)+b)%b
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2))
}

function lighten(color) {
  var r = Math.floor(color>>16)%256;
  var g = Math.floor(color>>8)%256;
  var b = color%256;
  
  var s1=10
  var s2=20
  var s2g=10
  var s3=50
  
  //r = Math.log2((r+s1 )/(256+s1 )*1+1)*256
  //g = Math.log2((g+s1g)/(256+s1g)*1+1)*256
  //b = Math.log2((b+s1 )/(256+s1 )*1+1)*256
  
  //r = Math.log10((r+s2 )/(256+s2 )*9+1)*256
  //g = Math.log10((g+s2g)/(256+s2g)*9+1)*256
  //b = Math.log10((b+s2 )/(256+s2 )*9+1)*256
  
  r = (r+s3)/(255+s3)*255;
  g = (g+s3)/(255+s3)*255;
  b = (b+s3)/(255+s3)*255;
  
  r = Math.floor(r)
  g = Math.floor(g)
  b = Math.floor(b)
  
  return (r<<16) + (g<<8) + b
}

setMode("paint")
init();
setInterval(loop, 1000/60);