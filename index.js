var THREE = require('three');
var OrbitControls = require('three-orbit-controls')(THREE);
var mda = require('mda');
var Benchmark = require('benchmark');
var crystalGen = require('./crystal-gen');

window.Benchmark = Benchmark;

var width = window.innerWidth;
var height = window.innerHeight;

var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
camera.position.x = 5;

var controls = new OrbitControls(camera);

renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
});
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

var scene = new THREE.Scene();


var material = new THREE.MeshNormalMaterial({
    flatShading: true
});

var wireframeMaterial = new THREE.MeshNormalMaterial({
    wireframe: true
});

var icoGeom = new THREE.IcosahedronGeometry(1, 1);
// var icoMesh = new THREE.Mesh(icoGeom, wireframeMaterial);
// scene.add(icoMesh);

var crystalSpec = {
    sides: 3,
    diameter: .2,
    height: 1,
    topFacets: 1
};

var testThree = function() {
    return crystalGen.create(crystalSpec, crystalGen.threeEngine);
};

var testMda = function() {
    return crystalGen.create(crystalSpec, crystalGen.mdaEngine);
};

// var geometry = testThree();
var geometry = testMda();
var mesh = new THREE.Mesh(geometry, wireframeMaterial);
scene.add(mesh);

// var suite = new Benchmark.Suite;

// // add tests
// suite.add('three', function() {
//   testThree();
// })
// .add('mda', function() {
//   testMda();
// })
// // add listeners
// .on('cycle', function(event) {
//   console.log(String(event.target));
// })
// .on('complete', function() {
//   console.log('Fastest is ' + this.filter('fastest').map('name'));
// })
// // run async
// .run({ 'async': true });


function render() {
    renderer.render(scene, camera);
}

function animate() {
    render();
    controls.update();
    requestAnimationFrame(animate);
}

function onWindowResize() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}


window.addEventListener('resize', onWindowResize, false);
onWindowResize();
animate();

