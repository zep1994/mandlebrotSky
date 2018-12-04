function main() {

  function clamp(n) {
    n *= 255;
    if( n <   0 ) return   0;
    if( n > 255 ) return 255;
    return Math.floor(n);
}

function toPix(c) {
    return {r:clamp(c.r), g:clamp(c.g), b:clamp(c.b)};
}

function drawPal(canvas) {
    var ctx = canvas.getContext('2d');
    var dat = ctx.getImageData(0, 0, canvas.width, canvas.height);

    for(var x = 0; x < canvas.width; x++) {
        var t = x/canvas.width;
        var c = getPal(t);
        var p = toPix(c);

        for(var y = 0; y < canvas.height; y++) {
            var offset = 4*(y*canvas.width + x);
            dat.data[offset + 0] = p.r;
            dat.data[offset + 1] = p.g;
            dat.data[offset + 2] = p.b;
            dat.data[offset + 3] = 255;
        }
    }

    ctx.putImageData(dat, 0, 0);
}

function computeOrbit(c) {

    orbit[0].re = 0;
    orbit[0].im = 0;

    orbit.escaped = false;
    orbit.numPoints = 1;

    var er = escapeRadius*escapeRadius;

    for(var i = 1; i < maxIters; i++) {
        var zp = orbit[i - 1];
        var zn = orbit[i];

        //z[i] = z[i - 1]^2 + c
        zn.re = zp.re*zp.re - zp.im*zp.im + c.re;
        zn.im = zp.re*zp.im + zp.im*zp.re + c.im;

        orbit.numPoints++;

        var mr = zn.re*zn.re + zn.im*zn.im;

        if( mr > er ) {
            orbit.escaped = true;
            break;
        }
    }
}

function mag(z) {
    var s = z.re*z.re + z.im*z.im;

    if( s != 0 ) {
        s = Math.sqrt(s);
    }

    return s;
}

//sets global var avgSum
function triangleInEq(orbit, numPoints, c) {

    avgSum.s1 = 0;
    avgSum.s2 = 0;

    if( numPoints < 3 ) {
        return 0;
    }

    var mc = mag(c);

    for(var i = 2; i < numPoints; i++) {
        var zp = orbit[i - 1];
        var zc = orbit[i];

        //tc = zp^2
        tc.re = zp.re*zp.re - zp.im*zp.im;
        tc.im = zp.re*zp.im + zp.im*zp.re;

        var mp = mag(tc);

        var m = Math.abs( mp - mc);
        var M =           mp + mc;

        avgSum.s1 = avgSum.s2;
        avgSum.s2 += (mag(zc) - m)/(M - m);
    }

    avgSum.s1 /= numPoints - 3;
    avgSum.s2 /= numPoints - 2;
}

//pre: orbit.escaped && orbit.numPoints >= 2
function computeSmooth(orbit) {
    var zc = orbit[orbit.numPoints - 1];
    var mc = mag(zc);

    return 1 + 1/Math.log(2)*Math.log( Math.log(escapeRadius)/Math.log(mc) );
}

function genNextTile() {
    if( tiles.length === 0) {
        return;
    }

    var tile = tiles.pop();
    var dat = ctx.getImageData(tile.x, tile.y, tile.w, tile.h);

    for(var j = 0; j < tile.h; j++) {
        for(var i = 0; i < tile.w; i++) {

            var offset = 4*(j*tile.w + i);
            var p = {r:0, g:0, b:0};

            for(var sj = 0; sj < superSamples; sj++) {
                for(var si = 0; si < superSamples; si++) {
                    var x = tile.x + i + si/superSamples;
                    var y = tile.y + j + sj/superSamples;
                    var c = {
                        re:x/img.width *(maxRe - minRe) + minRe,
                        im:y/img.height*(maxIm - minIm) + minIm};

                    computeOrbit(c);

                    if( orbit.escaped ) {

                        var sm = computeSmooth(orbit);

                        triangleInEq(
                            orbit,
                            orbit.numPoints,
                            c);

                        var t = avgSum.s1*(1 - sm) + avgSum.s2*(sm);
                        var m = getPal(t);

                        p.r += m.r;
                        p.g += m.g;
                        p.b += m.b;
                    }

                    else {
                        p.r += inColor.r;
                        p.g += inColor.g;
                        p.b += inColor.b;
                    }
                }
            }

            p.r /= samplesPerPixel;
            p.g /= samplesPerPixel;
            p.b /= samplesPerPixel;

            var rgb = toPix(p);

            dat.data[offset + 0] = rgb.r;
            dat.data[offset + 1] = rgb.g;
            dat.data[offset + 2] = rgb.b;
            dat.data[offset + 3] = 255;
        }
    }

    ctx.putImageData(dat, tile.x, tile.y);
    statusDiv.innerHTML = tiles.length + ' tile(s)';
    setTimeout(genNextTile, 1);
}

function getPal(t) {
    t = 1 - t;
    return {
        r:Math.pow(t, 3.0),
        g:Math.pow(t, 1.0),
        b:Math.pow(t, 0.2)
        };
}


var avgSum = {s1:0, s2:0};
var inColor = {r:1, g:1, b:1};
var superSamples = 3;
var samplesPerPixel = superSamples*superSamples;
var center = {
    re:-0.740,
    im:0.208
};

var radius = 0.01; //0.005;
var tc = {re:0,im:0};
var img = document.getElementById('img');
var aspectRatio = img.height/img.width;
var minRe = center.re - radius;
var maxRe = center.re + radius;
var minIm = center.im - radius*aspectRatio;
var maxIm = center.im + radius*aspectRatio;
var escapeRadius = 1000;
var maxIters = 1000;
var statusDiv = document.getElementById('tilesLeft');
var ctx = img.getContext('2d');
var tileSize = 20;

drawPal(document.getElementById('pal'));

//pre allocated orbit to avoid doing it over and over
var orbit = [];

for(var i = 0; i < maxIters; i++) {
    orbit[i] = {re:0,im:0};
}

//only draw a tile at a time on the main event queue
//so that the browser does not complain
//about the script taking too long
var tiles = [];

for(var y = 0; y < img.height; y += tileSize) {
    for(var x = 0; x < img.width; x += tileSize) {
        tiles.push({
            x:x,
            y:y,
            w:Math.min(img.width  - x, tileSize),
            h:Math.min(img.height - y, tileSize)});
    }
}

genNextTile();

}
