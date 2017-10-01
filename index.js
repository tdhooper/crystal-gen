var THREE = require('three');
var OrbitControls = require('three-orbit-controls')(THREE);
var mda = require('mda');

var width = window.innerWidth;
var height = window.innerHeight;

var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
camera.position.z = 5;

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


function polygon(sides, size) {
    var points = Array.apply(null, Array(sides));
    points = points.map(function(u, i) {
        var angle = i / sides * Math.PI * 2.;
        return [
            Math.sin(angle) * size,
            Math.cos(angle) * size
        ];
    });
    return points;
}


// var box = new THREE.IcosahedronGeometry(1);

// var mesh = new mda.Mesh();
// var vertices = box.vertices.map(function(vert) {
//     return [vert.x, vert.y, vert.z];
// });
// var cells = box.faces.map(function(face) {
//     return [face.a, face.b, face.c];
// });
// mesh.setPositions( vertices );
// mesh.setCells( cells );
// mesh.process();

var shape = polygon(5, .5);
var mesh = mda.ProfileGenerator(shape);

mda.ExtrudeOperator(mesh, 0, 1, 0);

// console.log(mesh)
mda.MeshIntegrity(mesh);

mda.TriangulateOperator(mesh);
var positions = mesh.getPositions();
var cells = mesh.getCells();

var geometry = new THREE.Geometry();

geometry.vertices = positions.map(function(position) {
    return new THREE.Vector3().fromArray(position);
});

geometry.faces = cells.map(function(cell) {
    return new THREE.Face3(cell[0], cell[1], cell[2]);
});

var threeMesh = new THREE.Mesh(geometry, wireframeMaterial);
scene.add(threeMesh);

// geometry.computeBoundingSphere();

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

