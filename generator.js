paper.install(window);

const colors = [
    ['black', '#240038', '#440069', '#670295', '#B239FF'],
    ['black', '#12002F', '#2A005E', '#41008B', '#6800E7'],
    ['black', '#002A3A', '#025D84', '#0076A9', '#05B9EC'],
    ['black', '#002600', '#882200', '#008800', '#00DD00'];
];
const pixelSize = 100;
let currentColor = 0;
let pixels;
let overlay;
let textContent = 'rc3';
let dragging = false;
let timer = null;

function setTextFromHash() {
  let hash = window.location.hash;
  let paramString = (hash.length > 1) ? hash.substring(1) : "";

  let params = {};
  paramString.split("&").forEach(param => {
    let [name, value] = param.split("=", 2)
    params[name] = decodeURIComponent(value);
  });

  let text = (params['text'] != null) ? params['text'] : textContent;

  let color = parseInt(params['color'], 10);
  if (isNaN(color) || color < 0 || color > 2) color = 0;

  let interval = parseInt(params['interval'], 10);
  if (isNaN(interval) || interval < 0 || interval > 10 * 60) interval = 5;

  currentColor = color;
  setText(text);

  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }

  if (interval > 0) {
    timer = setInterval(generatePixels, interval * 1000);
  }

  window.location.hash = "color=" + currentColor + "&interval=" + interval + "&text=" + encodeURIComponent(text);

  generatePixels();
}

window.onload = function() {
	paper.setup('paperCanvas');

  window.onhashchange = setTextFromHash;
  setTextFromHash();

  //generation process
  generatePixels();
  generateOverlay();
}

//Set one of 3 colors via radio buttons
function setColor(colNr){
    currentColor = colNr;

    pixels.children.forEach(pixel => {
        pixel.tweenTo({ fillColor: colors[currentColor][pixel.colStep]}, { duration:  _.random(200, 1000)});
    });
}

//generate text
function setText(text){
    opentype.load("Orbitron-Bold.ttf", function(err, font) {

        if (err) {
            console.log(err.toString());
            return;
        }

        //remove old text if it exists
        if(overlay.children[1]){
            overlay.children[1].remove();
            overlay.removeChildren(1);
        }

        //prepare text input
        textContent = text;
        text = text.substr(0,16).toUpperCase();
        text = text.split('').reverse().join('');

        //iterate through letters and set in grid
        let allLetters = new Group();
        for(let i = 0; i<text.length; i++){
            let fontPath = font.getPath(text[i],0,0,150);
            let paperPath = paper.project.importSVG(fontPath.toSVG());
            paperPath.fillColor = 'white';
            paperPath.strokeColor = null;
            paperPath.bounds.bottomCenter = new Point(300+ (4-(i%4))*120, 300+ (4-Math.floor(i/4))*120 );
            if(i>=4){

                //special case for umlauts
                let letterBelow = allLetters.children[i-4];
                if(letterBelow._class == "CompoundPath" && letterBelow.intersects(paperPath)){
                    letterBelow.children
                        .filter(path => path.position.y - letterBelow.bounds.topLeft.y < 25)
                        .forEach(path => path.scale(1.2));
                    let tmp = paperPath.subtract(letterBelow);
                    tmp.fillColor = 'white';
                    paperPath.remove();
                    paperPath = tmp;
                    letterBelow.children
                        .filter(path => path.position.y - letterBelow.bounds.topLeft.y < 25)
                        .forEach(path => path.remove());
                }
            }
            allLetters.addChild(paperPath);

        }

        allLetters.bounds.bottomRight = overlay.firstChild.bounds.bottomRight.subtract([25,25]);
        overlay.addChild(allLetters);
    });

}

//generate white box
function generateOverlay(){
    if(overlay){
        overlay.removeChildren();
    }
    overlay = new Group();

    let lineRect = new Path.Rectangle([200, 200], [pixelSize*6, pixelSize*6]);
    lineRect.strokeWidth = 6;
    lineRect.strokeColor = 'white';
    overlay.addChild(lineRect);

    overlay.position = project.view.bounds.center.add([-pixelSize/2, -pixelSize/2]);
}

//generate pixel grid using simplex noise
function generatePixels(){
    let oldPixelPos = null;
    if(pixels){
        oldPixelPos = pixels.position;
        pixels.removeChildren();
    }
    pixels = new Group();

    let simplex = new SimplexNoise();
    let values = [];

    for(let x = 0; x<6; x++){
        for(let y = 0; y<6; y++){
            values.push(simplex.noise2D(x/10, y/10));
        }
    }

    //scale noise to complete range
    let min = _.min( values ),
        max = _.max( values );

    let strechedValues = values.map( value => translateValue(value, min, max, -1, 1));
    strechedValues = strechedValues.map( val => val<0 ? 0 : Math.ceil(val / 0.25) )

    strechedValues.forEach(function(val, idx){
        let x = idx % 6;
        let y = Math.floor(idx / 6);
        let rect = new Path.Rectangle([pixelSize*x+200, pixelSize*y+200], [pixelSize, pixelSize]);
        rect.fillColor = colors[currentColor][val];
        rect.applyMatrix= false;
        rect.scaling = 1.01;
        rect.colStep = val;
        rect.strokeWidth = 3;
        rect.strokeCap = 'round';
        rect.dashArray = [4, 10];
        rect.tweenFrom({ scaling: 0.0001 }, { duration:  _.random(0, 200) + val*200});
        pixels.addChild(rect);

    });

    pixels.position = project.view.bounds.center;
    if(oldPixelPos){
        pixels.position = oldPixelPos;
    }
    pixels.sendToBack();
}

function clampValue(value, min, max){
    return Math.max(Math.min(value, max), min);
}

function translateValue(value, leftMin, leftMax, rightMin, rightMax){
    leftSpan = leftMax - leftMin;
    rightSpan = rightMax - rightMin;

    return rightMin + ( (value - leftMin) / (leftSpan) * rightSpan);
}

function removeBlackPixels(){
    pixels.children
        .filter(pixel => pixel.colStep == 0)
        .forEach(pixel => pixel.fillColor = null);
}

function restoreBlackPixels(){
    pixels.children
        .filter(pixel => pixel.fillColor == null)
        .forEach(pixel => pixel.fillColor = 'black');
}
